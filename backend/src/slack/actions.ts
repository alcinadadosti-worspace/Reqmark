/**
 * Interacoes do Slack: os tres botoes do card e o modal de reprovacao.
 *
 * Regra de ouro do Slack: `ack()` em ate 3 s. Todos os handlers confirmam
 * primeiro e so depois vao ao Firestore — o Web Service gratuito do Render pode
 * levar alguns segundos para acordar, e o `ack` nao pode esperar por isso.
 */
import type { BlockAction, ButtonAction } from '@slack/bolt';
import { createLogger, describeError } from '../lib/logger';
import { getRequest } from '../lib/repo';
import { DecisionError, adminActor, decideRequest } from '../services/decisions';
import { ACTION_APPROVE, ACTION_OPEN_APP, ACTION_REJECT, VIEW_REJECT, rejectModal } from './blocks';
import { postDm, postEphemeral, slackApp } from './client';

const log = createLogger('slack:actions');

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

    const requestId = action.value;
    const user = body.user.id;
    const channel = body.channel?.id;

    if (!requestId) return;

    try {
      const actor = await adminActor();
      await decideRequest({
        requestId,
        decision: 'approve',
        channel: 'slack',
        actor,
        // O botao ja mostrou o dialogo de confirmacao quando havia conflito
        // (ver `adminRequestBlocks`), entao chegar aqui significa "sim, mesmo assim".
        force: true,
      });
    } catch (error) {
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

    try {
      const request = await getRequest(requestId);
      if (!request) return;

      if (request.status !== 'pending') {
        await warnAlreadyDecided(
          channel,
          user,
          `Esta requisição já foi decidida (status: ${request.status}).`
        );
        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: rejectModal(requestId, request),
      });
    } catch (error) {
      log.error(`falha ao abrir o modal de reprovação de ${requestId}`, describeError(error));
      if (channel) {
        await postEphemeral(
          channel,
          user,
          'Não consegui abrir a janela de reprovação. Tente pelo botão "Abrir no app".'
        );
      }
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
