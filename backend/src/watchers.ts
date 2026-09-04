/**
 * Ponte Firestore -> Slack.
 *
 * O frontend escreve direto no Firestore (para nao depender do backend estar
 * acordado) e marca o que precisa virar mensagem:
 *   - `requests.notify.adminPending == true`  -> avisar a administradora
 *   - `events.notify.pending == true`         -> encaminhar a mensagem do chat
 *
 * Dois mecanismos cuidam disso:
 *   1. LISTENERS em tempo real, enquanto o servico esta de pe.
 *   2. CATCH-UP no boot, que varre tudo que ficou pendente enquanto o Web
 *      Service gratuito do Render dormia (secao 9). Sem isso, uma requisicao
 *      feita as 3h da manha nunca chegaria ao Slack.
 *
 * A flag so e zerada DEPOIS do envio, entao uma falha de rede vira reenvio no
 * proximo boot em vez de silencio.
 */
import { FieldValue, collections, serverTimestamp } from './firebase';
import { env } from './env';
import { createLogger, describeError } from './lib/logger';
import { analyseRequest } from './lib/conflicts';
import { getItems, getOccupancyRequests, getRequest, stockMap, toEvent, toRequest } from './lib/repo';
import { buildOccupancy } from './shared/availability';
import type { MarketingRequest, RequestEvent } from './shared/types';
import {
  adminRequestBlocks,
  decidedBlocks,
  fallbackText,
  messageBlocks,
  receiptBlocks,
  ticketNumber,
} from './slack/blocks';
import { postDm, updateMessage } from './slack/client';

const log = createLogger('watchers');

/**
 * Requisicoes ja processadas nesta execucao.
 *
 * O listener dispara de novo assim que gravamos `notify.adminPending = false`
 * (a propria escrita e uma mudanca no documento). Sem esta trava, uma
 * requisicao poderia gerar duas DMs.
 */
const processingRequests = new Set<string>();
const processingEvents = new Set<string>();

// ---------------------------------------------------------------------------
// Nova requisicao -> DM para a administradora
// ---------------------------------------------------------------------------

export async function notifyNewRequest(request: MarketingRequest): Promise<void> {
  if (processingRequests.has(request.id)) return;
  processingRequests.add(request.id);

  try {
    // Requisicao ja decidida enquanto o servico estava fora: nao faz sentido
    // mandar um card com botoes.
    if (request.status !== 'pending') {
      await collections.requests().doc(request.id).update({ 'notify.adminPending': false });
      return;
    }

    const [items, occupancy] = await Promise.all([getItems(), getOccupancyRequests()]);
    const index = buildOccupancy(occupancy, { excludeRequestId: request.id });
    const analysis = analyseRequest(request, index, stockMap(items));

    const posted = await postDm(
      env.adminSlackId,
      fallbackText(request, '🟡 Nova requisição'),
      adminRequestBlocks({ request, blocking: analysis.blocking, warnings: analysis.warnings })
    );

    if (!posted) {
      log.warn(`nao consegui avisar a administradora sobre ${ticketNumber(request.number)}`);
      // Mantem `adminPending` para o proximo boot tentar de novo.
      return;
    }

    await collections.requests().doc(request.id).update({
      'slack.adminChannel': posted.channel,
      'slack.adminMessageTs': posted.ts,
      'notify.adminPending': false,
      updatedAt: serverTimestamp(),
    });

    // Confirmacao curta para quem pediu.
    if (request.requesterId && request.requesterId !== env.adminSlackId) {
      await postDm(
        request.requesterId,
        fallbackText(request, '🟡 Recebida'),
        receiptBlocks(request)
      );
    }

    log.info(`${ticketNumber(request.number)} anunciada no Slack`);
  } catch (error) {
    log.error(`falha ao anunciar ${request.id}`, describeError(error));
  } finally {
    processingRequests.delete(request.id);
  }
}

// ---------------------------------------------------------------------------
// Mensagens e cancelamentos -> Slack
// ---------------------------------------------------------------------------

async function notifyEvent(requestId: string, event: RequestEvent): Promise<void> {
  const key = `${requestId}/${event.id}`;
  if (processingEvents.has(key)) return;
  processingEvents.add(key);

  try {
    const request = await getRequest(requestId);
    if (!request) {
      await collections.events(requestId).doc(event.id).update({ 'notify.pending': false });
      return;
    }

    if (event.type === 'message') {
      await forwardMessage(request, event);
    } else if (event.type === 'cancelled') {
      await forwardCancellation(request, event);
    }

    await collections.events(requestId).doc(event.id).update({ 'notify.pending': false });
  } catch (error) {
    log.error(`falha ao encaminhar evento ${key}`, describeError(error));
  } finally {
    processingEvents.delete(key);
  }
}

/**
 * Mensagem do solicitante vira resposta NA THREAD do card original, na DM da
 * administradora — a conversa fica junto do pedido em vez de virar uma DM solta.
 */
async function forwardMessage(request: MarketingRequest, event: RequestEvent): Promise<void> {
  if (!event.text) return;

  if (event.authorRole === 'admin') {
    // Mensagem da administradora escrita fora do painel: avisa o solicitante.
    await postDm(
      request.requesterId,
      `💬 ${event.authorName} respondeu na requisição ${ticketNumber(request.number)}`,
      messageBlocks(request, event.authorName, event.text)
    );
  } else {
    await postDm(
      env.adminSlackId,
      `💬 ${event.authorName} — ${ticketNumber(request.number)}`,
      messageBlocks(request, event.authorName, event.text),
      request.slack?.adminMessageTs
    );
  }

  // O contador de nao lidas do outro lado e do backend (as regras nao deixam o
  // cliente incrementar o lado alheio).
  const side = event.authorRole === 'admin' ? 'requester' : 'admin';
  await collections.requests().doc(request.id).update({
    [`unread.${side}`]: FieldValue.increment(1),
    updatedAt: serverTimestamp(),
  });
}

/** Cancelamento: reply na thread + card sem botoes (fluxo 6 da secao 9). */
async function forwardCancellation(request: MarketingRequest, event: RequestEvent): Promise<void> {
  await postDm(
    env.adminSlackId,
    `🚫 ${ticketNumber(request.number)} cancelada`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚫 *${ticketNumber(request.number)} cancelada pelo solicitante* (${event.authorName}).`,
        },
      },
    ],
    request.slack?.adminMessageTs
  );

  const channel = request.slack?.adminChannel;
  const ts = request.slack?.adminMessageTs;
  if (channel && ts) {
    await updateMessage(
      channel,
      ts,
      fallbackText(request, '🚫 Cancelada'),
      decidedBlocks({
        request,
        status: 'cancelled',
        byName: event.authorName,
        at: new Date(),
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Catch-up no boot
// ---------------------------------------------------------------------------

export async function runCatchUp(): Promise<void> {
  log.info('catch-up: procurando pendências acumuladas…');

  try {
    const pendingRequests = await collections
      .requests()
      .where('notify.adminPending', '==', true)
      .limit(50)
      .get();

    for (const doc of pendingRequests.docs) {
      await notifyNewRequest(toRequest(doc));
    }

    // `collectionGroup` alcanca as subcolecoes `events` de todas as requisicoes
    // de uma vez — requer o indice de grupo declarado em firestore.indexes.json.
    const pendingEvents = await collections
      .requests()
      .firestore.collectionGroup('events')
      .where('notify.pending', '==', true)
      .limit(100)
      .get();

    for (const doc of pendingEvents.docs) {
      const requestId = doc.ref.parent.parent?.id;
      if (!requestId) continue;
      await notifyEvent(requestId, toEvent(doc));
    }

    log.info(
      `catch-up concluído: ${pendingRequests.size} requisição(ões) e ${pendingEvents.size} evento(s).`
    );
  } catch (error) {
    log.error('catch-up falhou', describeError(error));
  }
}

// ---------------------------------------------------------------------------
// Listeners em tempo real
// ---------------------------------------------------------------------------

let unsubscribers: (() => void)[] = [];

export function startWatchers(): void {
  stopWatchers();

  const requestsUnsub = collections
    .requests()
    .where('notify.adminPending', '==', true)
    .onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') continue;
          void notifyNewRequest(toRequest(change.doc));
        }
      },
      (error) => log.error('listener de requests caiu', describeError(error))
    );

  const eventsUnsub = collections
    .requests()
    .firestore.collectionGroup('events')
    .where('notify.pending', '==', true)
    .onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') continue;
          const requestId = change.doc.ref.parent.parent?.id;
          if (!requestId) continue;
          void notifyEvent(requestId, toEvent(change.doc));
        }
      },
      (error) => log.error('listener de events caiu', describeError(error))
    );

  unsubscribers = [requestsUnsub, eventsUnsub];
  log.info('listeners do Firestore ativos');
}

export function stopWatchers(): void {
  for (const unsubscribe of unsubscribers) {
    try {
      unsubscribe();
    } catch {
      /* ignora */
    }
  }
  unsubscribers = [];
}
