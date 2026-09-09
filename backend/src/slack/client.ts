/**
 * Bolt + ExpressReceiver.
 *
 * O `ExpressReceiver` traz a verificacao de assinatura embutida (o Slack assina
 * cada requisicao com o `SLACK_SIGNING_SECRET`) e ainda expoe o router do
 * Express, onde penduramos `/health` e `/admin/*` — um servico so, dentro das
 * horas gratuitas do Render (secao 4).
 */
import { App, ExpressReceiver, SocketModeReceiver } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { env } from '../env';
import { createLogger, describeError } from '../lib/logger';

const log = createLogger('slack');

export const receiver = new ExpressReceiver({
  signingSecret: env.slackSigningSecret,
  endpoints: '/slack/events',
  /*
    `false` (o padrao) e o certo para um processo que fica de pe.

    Com `true` o Bolt so devolve o HTTP depois que o handler INTEIRO termina
    — e o handler de aprovar le itens e ocupacao, roda a transacao, grava o
    evento, edita o card e manda DM ao solicitante. O Slack exige resposta em
    3 s: num servico acordando, isso estoura. A administradora via "algo deu
    errado" mesmo quando tinha funcionado, e o Slack REENVIAVA o clique, que
    caia em "ja decidida". `true` existe para funcoes serverless, que morrem
    ao responder; aqui o `ack()` responde na hora e o trabalho segue.
  */
  processBeforeResponse: false,
});

/**
 * Como o Slack entrega os cliques a este processo.
 *
 * O `ExpressReceiver` acima e criado SEMPRE, porque e dele que sai o router do
 * Express onde moram `/health`, `/admin/*` e o site. O que muda e quem escuta
 * as interacoes: com `SLACK_APP_TOKEN` preenchido, o Bolt abre a conexao
 * WebSocket do Modo Socket; sem ele, continua recebendo por HTTP no
 * `/slack/events`.
 *
 * Os dois modos compartilham exatamente os mesmos handlers.
 */
export const usingSocketMode = Boolean(env.slackAppToken);

/**
 * Estado da conexao WebSocket, para o `/health` poder dizer se ela esta viva.
 *
 * Sem isso, "o clique nao chegou" tem duas leituras — o Slack nao mandou, ou a
 * conexao caiu — e nao ha como escolher entre elas sem os logs do Render.
 */
export const socketState = {
  conectado: false,
  conexoes: 0,
  desconexoes: 0,
  ultimoEvento: null as string | null,
  ultimoEventoEm: null as string | null,
  /** Preenchido quando a conexao nem chega a subir (token invalido, por exemplo). */
  erro: null as string | null,
};

/*
 * O receiver do Modo Socket e criado a mao (em vez de deixar o Bolt cria-lo com
 * `socketMode: true`) so para termos referencia ao cliente e poder observar os
 * eventos de conexao.
 */
const socketReceiver = usingSocketMode
  ? new SocketModeReceiver({ appToken: env.slackAppToken })
  : null;

if (socketReceiver) {
  const mark = (evento: string, conectado: boolean) => {
    socketState.conectado = conectado;
    socketState.ultimoEvento = evento;
    socketState.ultimoEventoEm = new Date().toISOString();
    if (conectado) socketState.conexoes += 1;
    else socketState.desconexoes += 1;
    log.info(`socket: ${evento}`);
  };

  socketReceiver.client.on('connected', () => mark('connected', true));
  socketReceiver.client.on('disconnected', () => mark('disconnected', false));
  socketReceiver.client.on('error', (error: unknown) => {
    log.error('socket: erro', describeError(error));
  });
}

export const slackApp = new App({
  token: env.slackBotToken,
  receiver: socketReceiver ?? receiver,
});

log.info(usingSocketMode ? 'Slack em Modo Socket (WebSocket)' : 'Slack em modo HTTP (/slack/events)');

export const slack = slackApp.client;

/**
 * Quantas interacoes o Slack ja entregou a este processo.
 *
 * Existe para responder, sem acesso aos logs do Render, a pergunta que trava
 * qualquer diagnostico de botao: "o clique chegou ate aqui?". Se a pessoa
 * clica e este contador nao sobe, o problema esta na CONFIGURACAO do Slack
 * (Request URL ausente, Modo Socket ligado), nao no nosso codigo. Exposto em
 * `/health`, sem nenhum dado sensivel.
 */
export const slackStats = {
  interactions: 0,
  lastAt: null as string | null,
  lastKind: null as string | null,
};

export function recordSlackInteraction(kind: string): void {
  slackStats.interactions += 1;
  slackStats.lastAt = new Date().toISOString();
  slackStats.lastKind = kind;
}

/** Cache de `users.conversations`: o canal de DM de alguem nao muda. */
const dmChannelCache = new Map<string, string>();

/**
 * Abre (ou reusa) o canal de DM com uma pessoa.
 * Devolve `null` em vez de lancar: uma DM que falha nao pode derrubar a
 * aprovacao que ja foi gravada no Firestore.
 */
export async function openDm(slackUserId: string): Promise<string | null> {
  const cached = dmChannelCache.get(slackUserId);
  if (cached) return cached;

  try {
    const result = await slack.conversations.open({ users: slackUserId });
    const channel = result.channel?.id;
    if (!channel) {
      log.warn(`conversations.open nao devolveu canal para ${slackUserId}`);
      return null;
    }
    dmChannelCache.set(slackUserId, channel);
    return channel;
  } catch (error) {
    log.error(`falha ao abrir DM com ${slackUserId}`, describeError(error));
    return null;
  }
}

export interface PostResult {
  channel: string;
  ts: string;
}

/** Manda uma DM. Nunca lanca — devolve `null` quando nao consegue. */
export async function postDm(
  slackUserId: string,
  text: string,
  blocks?: KnownBlock[],
  threadTs?: string
): Promise<PostResult | null> {
  const channel = await openDm(slackUserId);
  if (!channel) return null;

  try {
    const result = await slack.chat.postMessage({
      channel,
      text,
      blocks,
      thread_ts: threadTs,
      unfurl_links: false,
      unfurl_media: false,
    });

    return result.ts ? { channel, ts: result.ts } : null;
  } catch (error) {
    /*
      O canal em cache pode ter morrido — a pessoa saiu do workspace, ou o
      Slack invalidou a DM. Sem tirar do cache, TODA DM futura para ela
      falharia ate o proximo boot, mesmo que o `conversations.open` de novo
      resolvesse. Um erro desses joga o canal fora; a proxima tentativa reabre.
    */
    const code = (error as { data?: { error?: string } })?.data?.error;
    if (code === 'channel_not_found' || code === 'not_in_channel' || code === 'is_archived') {
      dmChannelCache.delete(slackUserId);
      log.warn(`canal de DM de ${slackUserId} descartado do cache (${code})`);
    }
    log.error(`falha ao enviar DM para ${slackUserId}`, describeError(error));
    return null;
  }
}

/** Atualiza uma mensagem ja enviada (remove botoes, marca a decisao). */
export async function updateMessage(
  channel: string,
  ts: string,
  text: string,
  blocks: KnownBlock[]
): Promise<boolean> {
  try {
    await slack.chat.update({ channel, ts, text, blocks });
    return true;
  } catch (error) {
    log.error(`falha no chat.update em ${channel}/${ts}`, describeError(error));
    return false;
  }
}

/** Resposta so para quem clicou, sem poluir a DM. */
export async function postEphemeral(
  channel: string,
  user: string,
  text: string
): Promise<void> {
  try {
    await slack.chat.postEphemeral({ channel, user, text });
  } catch (error) {
    log.warn(`falha no postEphemeral para ${user}`, describeError(error));
  }
}
