/**
 * Interacoes do Slack: os tres botoes do card e o modal de reprovacao.
 *
 * Regra de ouro do Slack: `ack()` em ate 3 s. Todos os handlers confirmam
 * primeiro e so depois vao ao Firestore — o Web Service gratuito do Render pode
 * levar alguns segundos para acordar, e o `ack` nao pode esperar por isso.
 */
import type { BlockAction, ButtonAction } from '@slack/bolt';
import { env } from '../env';
import { createLogger, describeError } from '../lib/logger';
import { describeConflict } from '../lib/conflicts';
import { getRequest } from '../lib/repo';
import { DecisionError, adminActor, decideRequest } from '../services/decisions';
import {
  ACTION_APPROVE,
  ACTION_OPEN_APP,
  ACTION_REJECT,
  VIEW_REJECT,
  alreadyDecidedModal,
  rejectModal,
} from './blocks';
import { postDm, postEphemeral, recordSlackInteraction, slackApp } from './client';

const log = createLogger('slack:actions');

/**
 * So a administradora decide.
 *
 * O card e enviado apenas para a DM dela, mas uma mensagem do Slack pode ser
 * encaminhada, e o botao continua funcionando no card encaminhado. Sem esta
 * checagem, quem recebesse o encaminhamento aprovaria a requisicao — e ficaria
 * registrado no nome dela, porque `adminActor()` sempre usa o ADMIN_SLACK_ID.
 */
async function refuseIfNotAdmin(
  userId: string,
  channel: string | undefined
): Promise<boolean> {
  if (userId === env.adminSlackId) return false;

  log.warn(`${userId} tentou decidir pelo Slack sem ser a administradora`);
  if (channel) {
    await postEphemeral(
      channel,
      userId,
      'Só a administradora do Marketing pode aprovar ou reprovar requisições.'
    );
  }
  return true;
}

/** Mensagem efemera de "ja decidida" (fluxo 7 da secao 9). */
async function warnAlreadyDecided(
  channel: string | undefined,
  user: string,
  message: string
): Promise<void> {
  if (!channel) return;
  await postEphemeral(channel, user, message);
}

export function registerSlackActions(): void {
  /*
    Middleware global: roda em TODA interacao entregue pelo Slack, inclusive
    nas que nenhum handler reconhece. E o que permite ao `/health` dizer se o
    clique chegou — sem isso, um botao mudo e indistinguivel de um Slack mal
    configurado.
  */
  slackApp.use(async ({ body, next }) => {
    const payload = body as { type?: string; actions?: { action_id?: string }[]; view?: { callback_id?: string } };
    const kind =
      payload?.actions?.[0]?.action_id ??
      payload?.view?.callback_id ??
      payload?.type ??
      'desconhecida';
    recordSlackInteraction(kind);
    await next();
  });

  /**
   * O Slack exige `ack()` tambem para botoes que sao apenas links, senao a
   * interacao fica marcada como falha na interface.
   */
  slackApp.action(ACTION_OPEN_APP, async ({ ack }) => {
    await ack();
  });

  // --- Aprovar -------------------------------------------------------------

  slackApp.action<BlockAction<ButtonAction>>(ACTION_APPROVE, async ({ ack, body, action }) => {
    await ack();

    // `<id>|force` quando o card mostrou o dialogo de confirmacao (ver
    // `adminRequestBlocks`). Sem o sufixo, a aprovacao NAO pode forcar: entre o
    // envio do card e o clique podem ter se passado dias, e um conflito que
    // surgiu nesse meio-tempo nunca foi confirmado por ninguem.
    const [requestId, flag] = (action.value ?? '').split('|');
    const force = flag === 'force';
    const user = body.user.id;
    const channel = body.channel?.id;

    if (!requestId) return;
    if (await refuseIfNotAdmin(user, channel)) return;

    try {
      const actor = await adminActor();
      await decideRequest({
        requestId,
        decision: 'approve',
        channel: 'slack',
        actor,
        force,
      });
    } catch (error) {
      if (error instanceof DecisionError && error.code === 'conflict') {
        const details = error.details as { conflicts?: Parameters<typeof describeConflict>[0][] } | undefined;
        const conflicts = (details?.conflicts ?? []).map(describeConflict);
        if (channel) {
          await postEphemeral(
            channel,
            user,
            'Surgiu um conflito depois que este card foi enviado, então não aprovei:\n' +
              conflicts.map((line) => '• ' + line).join('\n') +
              '\nConfira pelo botão "Abrir no app" e, se quiser aprovar mesmo assim, faça por lá.'
          );
        }
        return;
      }

      if (error instanceof DecisionError && error.code === 'already_decided') {
        await warnAlreadyDecided(
          channel,
          user,
          `Esta requisição já foi decidida (status: ${
            (error.details as { status?: string })?.status ?? 'desconhecido'
          }).`
        );
        return;
      }

      log.error(`falha ao aprovar ${requestId} pelo Slack`, describeError(error));

      if (channel) {
        await postEphemeral(
          channel,
          user,
          'Não consegui registrar a aprovação agora. Tente pelo botão "Abrir no app".'
        );
      }
    }
  });

  // --- Reprovar: abre o modal do motivo ------------------------------------

  slackApp.action<BlockAction<ButtonAction>>(ACTION_REJECT, async ({ ack, body, action, client }) => {
    await ack();

    const requestId = action.value;
    const user = body.user.id;
    const channel = body.channel?.id;

    if (!requestId) return;
    if (await refuseIfNotAdmin(user, channel)) return;

    /*
      O modal abre ANTES de qualquer leitura. O `trigger_id` vale 3 s a partir
      do clique, e o Firestore pode gastar isso so para acordar no primeiro
      acesso do dia — ler primeiro era garantir que, exatamente de manha, o
      botao Reprovar nao abrisse nada.
    */
    let viewId: string | undefined;
    try {
      const opened = await client.views.open({
        trigger_id: body.trigger_id,
        view: rejectModal(requestId),
      });
      viewId = opened.view?.id;
    } catch (error) {
      log.error(`falha ao abrir o modal de reprovação de ${requestId}`, describeError(error));
      if (channel) {
        await postEphemeral(
          channel,
          user,
          'Não consegui abrir a janela de reprovação. Tente pelo botão "Abrir no app".'
        );
      }
      return;
    }

    // Com o modal ja na tela, completa os detalhes — ou avisa que ja foi decidida.
    try {
      const request = await getRequest(requestId);
      if (!request || !viewId) return;

      await client.views.update({
        view_id: viewId,
        view:
          request.status === 'pending' ? rejectModal(requestId, request) : alreadyDecidedModal(request),
      });
    } catch (error) {
      // O modal minimo ja esta aberto e funciona; so os detalhes ficaram de fora.
      log.warn(`nao consegui completar o modal de ${requestId}`, describeError(error));
    }
  });

  // --- Reprovar: envio do modal --------------------------------------------

  slackApp.view(VIEW_REJECT, async ({ ack, body, view }) => {
    const requestId = view.private_metadata;
    const reason = view.state.values.reason_block?.reason?.value?.trim() ?? '';

    if (!reason) {
      // Erro dentro do proprio modal, sem fecha-lo.
      await ack({
        response_action: 'errors',
        errors: { reason_block: 'Escreva o motivo para o solicitante entender.' },
      });
      return;
    }

    await ack();

    if (body.user.id !== env.adminSlackId) {
      log.warn(`${body.user.id} tentou reprovar pelo modal sem ser a administradora`);
      return;
    }

    try {
      const actor = await adminActor();
      await decideRequest({
        requestId,
        decision: 'reject',
        note: reason,
        channel: 'slack',
        actor,
      });
    } catch (error) {
      if (error instanceof DecisionError && error.code === 'already_decided') {
        // O modal ja fechou: nao ha canal para mensagem efemera, entao avisamos
        // por DM mesmo.
        await postDm(body.user.id, 'Esta requisição já havia sido decidida.');
        return;
      }
      log.error(`falha ao reprovar ${requestId} pelo Slack`, describeError(error));
    }
  });

  /**
   * Rede de seguranca: qualquer interacao nao mapeada recebe `ack` para o Slack
   * nao marcar erro na interface da administradora.
   */
  slackApp.error(async (error) => {
    log.error('erro nao tratado no Bolt', describeError(error));
  });

  log.info('handlers do Slack registrados');
}
