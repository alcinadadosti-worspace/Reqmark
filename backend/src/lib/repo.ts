/**
 * Leitura do Firestore pelo Admin SDK, ja no formato dos tipos compartilhados.
 *
 * Concentrar as conversoes aqui evita `as any` espalhado pelo backend e mantem
 * o motor de disponibilidade recebendo exatamente a mesma forma que recebe no
 * frontend.
 */
import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { collections } from '../firebase';
import { addDays, today } from '../shared/dates';
import type {
  AppSettings,
  AppUser,
  CityRef,
  Item,
  MarketingRequest,
  RequestEvent,
  RequestItem,
  UserRole,
} from '../shared/types';
import { DEFAULT_PURPOSE_TYPES } from '../shared/types';

type AnySnapshot = DocumentSnapshot | QueryDocumentSnapshot;

/** Mesma janela do frontend: 60 dias para tras (secao 7). */
export const OCCUPANCY_WINDOW_DAYS = 60;

export function toRequest(snapshot: AnySnapshot): MarketingRequest {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    number: Number(data.number ?? 0),
    requesterId: String(data.requesterId ?? ''),
    requesterName: String(data.requesterName ?? ''),
    items: Array.isArray(data.items) ? (data.items as RequestItem[]) : [],
    purposeType: String(data.purposeType ?? 'Outro'),
    purpose: String(data.purpose ?? ''),
    city: (data.city as CityRef) ?? { name: '', state: '', lat: 0, lng: 0, displayName: '' },
    locationDetail: data.locationDetail ?? undefined,
    startDate: String(data.startDate ?? ''),
    endDate: String(data.endDate ?? ''),
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

export function toItem(snapshot: AnySnapshot): Item {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    name: String(data.name ?? ''),
    slug: String(data.slug ?? snapshot.id),
    category: String(data.category ?? 'Geral'),
    icon: String(data.icon ?? 'package'),
    emoji: data.emoji ?? undefined,
    imageUrl: data.imageUrl ?? undefined,
    description: String(data.description ?? ''),
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

export function toUser(snapshot: AnySnapshot): AppUser {
  const data = snapshot.data() ?? {};
  return {
    slackId: snapshot.id,
    name: String(data.name ?? ''),
    role: (data.role as UserRole) ?? 'requester',
    active: data.active !== false,
    createdAt: data.createdAt ?? null,
  };
}

export function toEvent(snapshot: AnySnapshot): RequestEvent {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    type: data.type ?? 'message',
    authorId: String(data.authorId ?? ''),
    authorName: String(data.authorName ?? ''),
    authorRole: (data.authorRole as UserRole) ?? 'requester',
    text: data.text ?? undefined,
    meta: data.meta ?? undefined,
    notify: data.notify ?? { pending: false },
    createdAt: data.createdAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function getRequest(requestId: string): Promise<MarketingRequest | null> {
  const snapshot = await collections.requests().doc(requestId).get();
  return snapshot.exists ? toRequest(snapshot) : null;
}

export async function getItems(): Promise<Item[]> {
  const snapshot = await collections.items().get();
  return snapshot.docs.map(toItem);
}

export async function getUser(slackId: string): Promise<AppUser | null> {
  const snapshot = await collections.users().doc(slackId).get();
  return snapshot.exists ? toUser(snapshot) : null;
}

/**
 * Requisicoes que afetam a disponibilidade — a mesma janela do frontend, para
 * a revalidacao no backend enxergar exatamente o mesmo cenario.
 */
export async function getOccupancyRequests(): Promise<MarketingRequest[]> {
  const snapshot = await collections
    .requests()
    .where('status', 'in', ['pending', 'approved'])
    .where('endDate', '>=', addDays(today(), -OCCUPANCY_WINDOW_DAYS))
    .get();

  return snapshot.docs.map(toRequest);
}

export async function getSettings(): Promise<AppSettings> {
  const snapshot = await collections.settingsApp().get();
  const data = snapshot.data();

  return {
    adminSlackId: String(data?.adminSlackId ?? ''),
    appUrl: String(data?.appUrl ?? ''),
    cities: Array.isArray(data?.cities) ? data.cities : [],
    purposeTypes: Array.isArray(data?.purposeTypes) ? data.purposeTypes : DEFAULT_PURPOSE_TYPES,
  };
}

/** Forma reduzida que o motor de disponibilidade consome. */
export function stockMap(items: Item[]): Map<string, { id: string; name: string; quantity: number }> {
  return new Map(items.map((item) => [item.id, { id: item.id, name: item.name, quantity: item.quantity }]));
}
