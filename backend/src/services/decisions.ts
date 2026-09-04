/**
 * Regras de negocio das acoes privilegiadas.
 *
 * Uma unica implementacao serve aos dois caminhos da secao 9: os botoes do
 * Slack e o painel admin (`POST /admin/*`). Assim "aprovar pelo Slack" e
 * "aprovar pelo app" produzem exatamente os mesmos efeitos — status, evento na
 * timeline, `chat.update` no card original e DM ao solicitante.
 */
import { FieldValue, collections, serverTimestamp } from '../firebase';
import { env } from '../env';
import { createLogger, describeError } from '../lib/logger';
import { analyseRequest } from '../lib/conflicts';
import { getItems, getOccupancyRequests, getRequest, stockMap } from '../lib/repo';
import { buildOccupancy } from '../shared/availability';
import { today } from '../shared/dates';
import type { MarketingRequest, RequestEventType, RequestStatus } from '../shared/types';
import {
  decidedBlocks,
  decisionForRequesterBlocks,
  fallbackText,
  messageBlocks,
  returnedBlocks,
  ticketNumber,
} from '../slack/blocks';
import { postDm, updateMessage } from '../slack/client';

const log = createLogger('decisions');

export class DecisionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface Actor {
  slackId: string;
  name: string;
}

export interface DecideInput {
  requestId: string;
  decision: 'approve' | 'reject';
  note?: string;
  /** Confirmacao explicita para aprovar apesar de um conflito. */
  force?: boolean;
  channel: 'slack' | 'app';
  actor: Actor;
}

export interface DecideResult {
  request: MarketingRequest;
  status: RequestStatus;
}

/**
 * Aprova ou reprova uma requisicao.
 *
 * A revalidacao do conflito acontece AQUI, no momento da decisao: entre o envio
 * e o clique podem ter se passado dias, e outra requisicao pode ter sido
 * aprovada para os mesmos dias.
 */
export async function decideRequest(input: DecideInput): Promise<DecideResult> {
  const request = await getRequest(input.requestId);
  if (!request) throw new DecisionError('not_found', 'Requisição não encontrada.', 404);

  if (request.status !== 'pending') {
    throw new DecisionError(
      'already_decided',
      `Esta requisição já foi decidida (status: ${request.status}).`,
      409,
      { status: request.status }
    );
  }

  const status: RequestStatus = input.decision === 'approve' ? 'approved' : 'rejected';
  const note = input.note?.trim() || undefined;

  if (status === 'rejected' && !note) {
    throw new DecisionError('note_required', 'O motivo da reprovação é obrigatório.');
  }

  if (status === 'approved') {
    const [items, occupancy] = await Promise.all([getItems(), getOccupancyRequests()]);
    const index = buildOccupancy(occupancy, { excludeRequestId: request.id });
    const analysis = analyseRequest(request, index, stockMap(items));

    if (!analysis.ok && !input.force) {
      throw new DecisionError(
        'conflict',
        'Há conflito com uma reserva já aprovada. Confirme para aprovar mesmo assim.',
        409,
        { conflicts: analysis.blocking }
      );
    }
  }

  const decision = {
    by: input.actor.slackId,
    byName: input.actor.name,
    at: serverTimestamp(),
    channel: input.channel,
    ...(note ? { note } : {}),
  };

  await collections.requests().doc(request.id).update({
    status,
    decision,
    updatedAt: serverTimestamp(),
    'notify.adminPending': false,
    // Quem recebe a novidade agora é o solicitante.
    'unread.requester': FieldValue.increment(1),
    'unread.admin': 0,
  });

  await appendEvent(request.id, {
    type: status === 'approved' ? 'approved' : 'rejected',
    authorId: input.actor.slackId,
    authorName: input.actor.name,
    authorRole: 'admin',
    meta: note ? { note } : undefined,
  });

  const updated: MarketingRequest = { ...request, status, decision: { ...decision, at: null } };

  // O Firestore ja tem a verdade; o Slack e melhor-esforco a partir daqui.
  await Promise.all([
    refreshAdminCard(updated, status, input.actor.name, note),
    notifyRequesterDecision(updated, status, input.actor.name, note),
  ]);

  log.info(`${ticketNumber(request.number)} ${status} por ${input.actor.name} (${input.channel})`);

  return { request: updated, status };
}

/**
 * Marca uma requisicao aprovada como devolvida.
 * Guardamos o dia (`returnedOn`) alem do timestamp: e ele que o motor de
 * disponibilidade usa para liberar o item a partir da data da devolucao.
 */
export async function markReturned(requestId: string, actor: Actor): Promise<MarketingRequest> {
  const request = await getRequest(requestId);
  if (!request) throw new DecisionError('not_found', 'Requisição não encontrada.', 404);

  if (request.status !== 'approved') {
    throw new DecisionError(
      'invalid_status',
      `Só dá para marcar devolução de uma requisição aprovada (status atual: ${request.status}).`,
      409
    );
  }

  const returnedOn = today();

  await collections.requests().doc(requestId).update({
    status: 'returned',
    returnedAt: serverTimestamp(),
    returnedOn,
    updatedAt: serverTimestamp(),
    'unread.requester': FieldValue.increment(1),
  });

  await appendEvent(requestId, {
    type: 'returned',
    authorId: actor.slackId,
    authorName: actor.name,
    authorRole: 'admin',
    meta: { returnedOn },
  });

  const updated: MarketingRequest = { ...request, status: 'returned', returnedOn };

  await Promise.all([
    refreshAdminCard(updated, 'returned', actor.name),
    postDm(
      request.requesterId,
      fallbackText(request, '📦 Devolvida'),
      returnedBlocks(request)
    ),
  ]);

  log.info(`${ticketNumber(request.number)} devolvida em ${returnedOn}`);

  return updated;
}

/** Mensagem da administradora pelo painel — vira DM para o solicitante. */
export async function sendAdminMessage(
  requestId: string,
  text: string,
  actor: Actor
): Promise<void> {
  const request = await getRequest(requestId);
  if (!request) throw new DecisionError('not_found', 'Requisição não encontrada.', 404);

  const clean = text.trim();
  if (!clean) throw new DecisionError('empty_message', 'A mensagem não pode ficar vazia.');

  // `notify.pending: false`: o watcher de eventos ignora esta mensagem porque a
  // DM ja sai daqui — sem isso o solicitante receberia duas vezes.
  await collections.events(requestId).add({
    type: 'message',
    authorId: actor.slackId,
    authorName: actor.name,
    authorRole: 'admin',
    text: clean,
    notify: { pending: false },
    createdAt: serverTimestamp(),
  });

  await collections.requests().doc(requestId).update({
    updatedAt: serverTimestamp(),
    'unread.requester': FieldValue.increment(1),
  });

  await postDm(
    request.requesterId,
    `💬 ${actor.name} respondeu na requisição ${ticketNumber(request.number)}`,
    messageBlocks(request, actor.name, clean)
  );
}

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

export interface AppendEventInput {
  type: RequestEventType;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'requester';
  text?: string;
  meta?: Record<string, unknown>;
  /** Deixe `false` quando a notificacao ja foi enviada por outro caminho. */
  notifyPending?: boolean;
}

export async function appendEvent(requestId: string, input: AppendEventInput): Promise<void> {
  await collections.events(requestId).add({
    type: input.type,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    ...(input.text ? { text: input.text } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    notify: { pending: input.notifyPending ?? false },
    createdAt: serverTimestamp(),
  });
}

/** Troca o card da DM da administradora pelo card "ja decidido". */
async function refreshAdminCard(
  request: MarketingRequest,
  status: RequestStatus,
  byName: string,
  note?: string
): Promise<void> {
  const channel = request.slack?.adminChannel;
  const ts = request.slack?.adminMessageTs;
  if (!channel || !ts) return;

  try {
    await updateMessage(
      channel,
      ts,
      fallbackText(request, status === 'approved' ? '✅ Aprovada' : '❌ Reprovada'),
      decidedBlocks({ request, status, byName, at: new Date(), note })
    );
  } catch (error) {
    log.warn(`nao consegui atualizar o card de ${ticketNumber(request.number)}`, describeError(error));
  }
}

/** DM ao solicitante com o resultado. */
async function notifyRequesterDecision(
  request: MarketingRequest,
  status: RequestStatus,
  byName: string,
  note?: string
): Promise<void> {
  if (!request.requesterId) return;

  await postDm(
    request.requesterId,
    fallbackText(request, status === 'approved' ? '✅ Aprovada' : '❌ Reprovada'),
    decisionForRequesterBlocks(request, status, byName, note)
  );
}

/** Nome da administradora, para assinar as decisões vindas do Slack. */
export async function adminActor(): Promise<Actor> {
  const snapshot = await collections.users().doc(env.adminSlackId).get();
  const name = (snapshot.data()?.name as string | undefined) ?? 'Administradora do Marketing';
  return { slackId: env.adminSlackId, name };
}
