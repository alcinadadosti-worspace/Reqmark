/**
 * Bolt + ExpressReceiver.
 *
 * O `ExpressReceiver` traz a verificacao de assinatura embutida (o Slack assina
 * cada requisicao com o `SLACK_SIGNING_SECRET`) e ainda expoe o router do
 * Express, onde penduramos `/health` e `/admin/*` — um servico so, dentro das
 * horas gratuitas do Render (secao 4).
 */
import { App, ExpressReceiver } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { env } from '../env';
import { createLogger, describeError } from '../lib/logger';

const log = createLogger('slack');

export const receiver = new ExpressReceiver({
  signingSecret: env.slackSigningSecret,
  endpoints: '/slack/events',
  processBeforeResponse: true,
});

export const slackApp = new App({
  token: env.slackBotToken,
  receiver,
});

export const slack = slackApp.client;

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
