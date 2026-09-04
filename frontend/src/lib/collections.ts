/**
 * Acesso ao Firestore: consultas, conversores e as (poucas) escritas que o
 * cliente pode fazer.
 *
 * O cliente so pode: criar uma requisicao `pending`, mandar mensagem no ticket,
 * cancelar a propria requisicao enquanto pendente e zerar o proprio contador de
 * nao lidas. Qualquer mudanca de `status` alem do cancelamento passa pelo
 * backend — e as `firestore.rules` garantem isso.
 */
import {
  addDoc,
  collection,
  doc,
  documentId,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { demoStore, isDemoMode } from '@/demo';
import { addDays, today } from '@/shared/dates';
import type {
  AppSettings,
  AppUser,
  CityRef,
  CountersSettings,
  DayString,
  Item,
  MarketingRequest,
  RequestEvent,
  RequestItem,
  UserRole,
} from '@/shared/types';
import { DEFAULT_PURPOSE_TYPES } from '@/shared/types';

/**
 * Janela da consulta de disponibilidade. Sessenta dias para tras cobrem o
 * historico util sem transformar a tela inicial num "leia a colecao inteira" —
 * o plano Spark cobra por documento lido.
 */
export const OCCUPANCY_WINDOW_DAYS = 60;

// ---------------------------------------------------------------------------
// Conversores
// ---------------------------------------------------------------------------

type Snap = QueryDocumentSnapshot<DocumentData>;

export function docToItem(snapshot: Snap): Item {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name ?? '',
    slug: data.slug ?? snapshot.id,
    category: data.category ?? 'Geral',
    icon: data.icon ?? 'package',
    emoji: data.emoji ?? undefined,
    imageUrl: data.imageUrl ?? undefined,
    description: data.description ?? '',
    quantity: Number(data.quantity ?? 0),
    attributes: Array.isArray(data.attributes) ? data.attributes : [],
    storageLocation: data.storageLocation ?? undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    active: data.active !== false,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: data.createdBy ?? undefined,
  };
}

export function docToUser(snapshot: Snap): AppUser {
  const data = snapshot.data();
  return {
    slackId: snapshot.id,
    name: data.name ?? '',
    role: (data.role as UserRole) ?? 'requester',
    active: data.active !== false,
    createdAt: data.createdAt ?? null,
  };
}

export function docToRequest(snapshot: Snap): MarketingRequest {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    number: Number(data.number ?? 0),
    requesterId: data.requesterId ?? '',
    requesterName: data.requesterName ?? '',
    items: Array.isArray(data.items) ? (data.items as RequestItem[]) : [],
    purposeType: data.purposeType ?? 'Outro',
    purpose: data.purpose ?? '',
    city: (data.city as CityRef) ?? { name: '', state: '', lat: 0, lng: 0, displayName: '' },
    locationDetail: data.locationDetail ?? undefined,
    startDate: data.startDate ?? '',
    endDate: data.endDate ?? '',
    days: Number(data.days ?? 0),
    status: data.status ?? 'pending',
    decision: data.decision ?? undefined,
    returnedAt: data.returnedAt ?? null,
    returnedOn: data.returnedOn ?? null,
    cancelledAt: data.cancelledAt ?? null,
    slack: data.slack ?? {},
    notify: data.notify ?? { adminPending: false },
    unread: data.unread ?? { admin: 0, requester: 0 },
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function docToEvent(snapshot: Snap): RequestEvent {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    type: data.type ?? 'message',
    authorId: data.authorId ?? '',
    authorName: data.authorName ?? '',
    authorRole: (data.authorRole as UserRole) ?? 'requester',
    text: data.text ?? undefined,
    meta: data.meta ?? undefined,
    notify: data.notify ?? { pending: false },
    createdAt: data.createdAt ?? null,
  };
}

export function mapSnapshot<T>(snapshot: QuerySnapshot<DocumentData>, convert: (doc: Snap) => T): T[] {
  return snapshot.docs.map(convert);
}

// ---------------------------------------------------------------------------
// Referencias e consultas
// ---------------------------------------------------------------------------

export const refs = {
  items: () => collection(getDb(), 'items'),
  item: (itemId: string) => doc(getDb(), 'items', itemId),
  users: () => collection(getDb(), 'users'),
  requests: () => collection(getDb(), 'requests'),
  request: (requestId: string) => doc(getDb(), 'requests', requestId),
  events: (requestId: string) => collection(getDb(), 'requests', requestId, 'events'),
  appSettings: () => doc(getDb(), 'settings', 'app'),
  counters: () => doc(getDb(), 'settings', 'counters'),
};

/** Itens ativos e inativos: o painel admin precisa dos dois. */
export const queries = {
  items: () => query(refs.items(), orderBy('name')),

  users: () => query(refs.users(), orderBy('name')),

  /**
   * Consulta unica de ocupacao, compartilhada por catalogo, agenda e wizard.
   * Requer o indice composto (status ASC, endDate ASC) — ver firestore.indexes.json.
   */
  occupancy: () =>
    query(
      refs.requests(),
      where('status', 'in', ['pending', 'approved']),
      where('endDate', '>=', addDays(today(), -OCCUPANCY_WINDOW_DAYS)),
      orderBy('endDate', 'asc')
    ),

  myRequests: (requesterId: string) =>
    query(
      refs.requests(),
      where('requesterId', '==', requesterId),
      orderBy('createdAt', 'desc'),
      limit(80)
    ),

  allRequests: () => query(refs.requests(), orderBy('createdAt', 'desc'), limit(250)),

  /** Aprovadas que ainda nao voltaram — aba "Em uso" do painel. */
  inUse: () =>
    query(refs.requests(), where('status', '==', 'approved'), orderBy('endDate', 'asc'), limit(120)),

  events: (requestId: string) => query(refs.events(requestId), orderBy('createdAt', 'asc')),

  requestsByIds: (ids: string[]) => query(refs.requests(), where(documentId(), 'in', ids.slice(0, 30))),
};

// ---------------------------------------------------------------------------
// Escritas permitidas ao cliente
// ---------------------------------------------------------------------------

export interface CreateRequestInput {
  requesterId: string;
  requesterName: string;
  items: RequestItem[];
  purposeType: string;
  purpose: string;
  city: CityRef;
  locationDetail?: string;
  startDate: DayString;
  endDate: DayString;
  days: number;
}

export interface CreateRequestResult {
  id: string;
  number: number;
}

/**
 * Cria a requisicao numa transacao, junto com o numero sequencial legivel.
 *
 * A transacao garante que duas pessoas enviando ao mesmo tempo nao recebam o
 * mesmo `#0042`. As regras so aceitam incremento de exatamente +1 em
 * `settings/counters.requests`.
 */
export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
  if (isDemoMode()) return demoStore.createRequest(input);

  const db = getDb();
  const requestRef = doc(refs.requests());
  const eventRef = doc(refs.events(requestRef.id));

  const number = await runTransaction(db, async (transaction) => {
    const countersSnapshot = await transaction.get(refs.counters());
    const current = Number(countersSnapshot.data()?.requests ?? 0);
    const next = current + 1;

    transaction.set(refs.counters(), { requests: next }, { merge: true });

    transaction.set(requestRef, {
      number: next,
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      items: input.items,
      purposeType: input.purposeType,
      purpose: input.purpose,
      city: input.city,
      ...(input.locationDetail ? { locationDetail: input.locationDetail } : {}),
      startDate: input.startDate,
      endDate: input.endDate,
      days: input.days,
      status: 'pending',
      slack: {},
      notify: { adminPending: true },
      unread: { admin: 1, requester: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(eventRef, {
      type: 'created',
      authorId: input.requesterId,
      authorName: input.requesterName,
      authorRole: 'requester',
      // O evento `created` nao vira mensagem no Slack: quem avisa a
      // administradora e o listener de `requests` (notify.adminPending).
      notify: { pending: false },
      createdAt: serverTimestamp(),
    });

    return next;
  });

  return { id: requestRef.id, number };
}

/** Mensagem no chat do ticket. O backend encaminha ao Slack e zera `notify`. */
export async function sendMessage(input: {
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
}): Promise<void> {
  if (isDemoMode()) return demoStore.addMessage(input);

  await addDoc(refs.events(input.requestId), {
    type: 'message',
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    text: input.text.trim(),
    notify: { pending: true },
    createdAt: serverTimestamp(),
  });
}

/**
 * Cancelamento pelo solicitante. Unica transicao de status que o cliente pode
 * fazer, e apenas de `pending` para `cancelled`.
 */
export async function cancelRequest(input: {
  requestId: string;
  requesterId: string;
  requesterName: string;
}): Promise<void> {
  if (isDemoMode()) {
    return demoStore.cancelRequest(input.requestId, input.requesterId, input.requesterName);
  }

  await updateDoc(refs.request(input.requestId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(refs.events(input.requestId), {
    type: 'cancelled',
    authorId: input.requesterId,
    authorName: input.requesterName,
    authorRole: 'requester',
    notify: { pending: true },
    createdAt: serverTimestamp(),
  });
}

/** Zera o contador de nao lidas do proprio lado ao abrir o ticket. */
export async function markTicketRead(requestId: string, side: 'admin' | 'requester'): Promise<void> {
  if (isDemoMode()) {
    demoStore.markRead(requestId, side);
    return;
  }

  await updateDoc(refs.request(requestId), {
    [`unread.${side}`]: 0,
  });
}

/** Reexportado para os testes e para o painel admin. */
export const firestoreIncrement = increment;

export const FALLBACK_SETTINGS: AppSettings = {
  adminSlackId: 'U09F9LWM6MC',
  appUrl: '',
  cities: [],
  purposeTypes: DEFAULT_PURPOSE_TYPES,
};

export const FALLBACK_COUNTERS: CountersSettings = { requests: 0 };
