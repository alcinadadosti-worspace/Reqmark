// ATENCAO: arquivo gerado. Nao edite aqui.
// Fonte: /shared — rode `npm run sync:shared` na raiz para atualizar.
/**
 * Tipos compartilhados entre o frontend e o backend.
 *
 * Este arquivo nao importa nada: precisa compilar tanto no bundle do navegador
 * (SDK modular do Firebase) quanto no Node (firebase-admin). Por isso o
 * `Timestamp` e descrito estruturalmente — as duas implementacoes satisfazem
 * a interface abaixo.
 */

/** Forma minima compartilhada pelo Timestamp do firebase-admin e do SDK web. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

/** Data com granularidade de dia, no formato `YYYY-MM-DD`. */
export type DayString = string;

export const APP_TIME_ZONE = 'America/Maceio';

// ---------------------------------------------------------------------------
// users/{slackId}
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'requester';

export interface AppUser {
  slackId: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt?: TimestampLike | null;
}

// ---------------------------------------------------------------------------
// items/{itemId}
// ---------------------------------------------------------------------------

export interface ItemAttribute {
  label: string;
  value: string;
}

export interface Item {
  id: string;
  name: string;
  slug: string;
  /** Ex.: "Estrutura", "Mobiliario", "Ativacao". */
  category: string;
  /** Chave do icone: um dos `custom:*` proprios ou o nome de um icone lucide. */
  icon: string;
  emoji?: string;
  /** Imagem apenas por URL externa — o plano Spark nao inclui Storage. */
  imageUrl?: string;
  description: string;
  /** Unidades existentes no estoque fisico. */
  quantity: number;
  attributes: ItemAttribute[];
  storageLocation?: string;
  tags: string[];
  active: boolean;
  createdAt?: TimestampLike | null;
  updatedAt?: TimestampLike | null;
  createdBy?: string;
}

/** Campos aceitos pelo backend ao criar/editar um item. */
export interface ItemInput {
  name: string;
  category: string;
  icon: string;
  emoji?: string;
  imageUrl?: string;
  description: string;
  quantity: number;
  attributes: ItemAttribute[];
  storageLocation?: string;
  tags: string[];
  active: boolean;
}

// ---------------------------------------------------------------------------
// requests/{requestId}
// ---------------------------------------------------------------------------

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'returned';

export const REQUEST_STATUSES: RequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'returned',
];

export type PurposeType =
  | 'Evento'
  | 'Ativacao em loja'
  | 'Feira/Exposicao'
  | 'Blitz'
  | 'Treinamento/Reuniao'
  | 'Outro';

export const DEFAULT_PURPOSE_TYPES: string[] = [
  'Evento',
  'Ativação em loja',
  'Feira/Exposição',
  'Blitz',
  'Treinamento/Reunião',
  'Outro',
];

export interface RequestItem {
  itemId: string;
  itemName: string;
  icon: string;
  quantity: number;
}

export interface CityRef {
  name: string;
  state: string;
  lat: number;
  lng: number;
  displayName: string;
}

export interface RequestDecision {
  by: string;
  byName: string;
  at?: TimestampLike | null;
  note?: string;
  channel: 'slack' | 'app';
}

export interface RequestSlackRefs {
  adminChannel?: string;
  adminMessageTs?: string;
}

export interface MarketingRequest {
  id: string;
  /** Sequencial legivel, exibido como #0042. */
  number: number;
  requesterId: string;
  requesterName: string;
  items: RequestItem[];
  purposeType: string;
  purpose: string;
  city: CityRef;
  locationDetail?: string;
  startDate: DayString;
  endDate: DayString;
  /** Dias do periodo, inclusivo nas duas pontas. */
  days: number;
  status: RequestStatus;
  decision?: RequestDecision;
  returnedAt?: TimestampLike | null;
  /**
   * Dia (`YYYY-MM-DD`) em que o item voltou. A disponibilidade e calculada por
   * dia, entao guardamos o dia junto do timestamp de auditoria: converter o
   * Timestamp para o fuso America/Maceio em todo calculo seria caro e sujeito
   * a erro no cliente.
   */
  returnedOn?: DayString | null;
  cancelledAt?: TimestampLike | null;
  slack?: RequestSlackRefs;
  /** `true` ao criar; o backend zera assim que avisa a administradora. */
  notify?: { adminPending: boolean };
  unread: { admin: number; requester: number };
  createdAt?: TimestampLike | null;
  updatedAt?: TimestampLike | null;
}

// ---------------------------------------------------------------------------
// requests/{requestId}/events/{eventId} — timeline + chat unificados
// ---------------------------------------------------------------------------

export type RequestEventType =
  | 'created'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'returned'
  | 'message';

export interface RequestEvent {
  id: string;
  type: RequestEventType;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text?: string;
  meta?: Record<string, unknown>;
  /** O backend encaminha ao Slack e zera. */
  notify?: { pending: boolean };
  createdAt?: TimestampLike | null;
}

// ---------------------------------------------------------------------------
// settings/*
// ---------------------------------------------------------------------------

export interface CityPreset {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export interface AppSettings {
  adminSlackId: string;
  appUrl: string;
  cities: CityPreset[];
  purposeTypes: string[];
}

export interface CountersSettings {
  requests: number;
}

// ---------------------------------------------------------------------------
// Contratos HTTP do backend (`/admin/*`)
// ---------------------------------------------------------------------------

export interface AdminLoginResponse {
  token: string;
  expiresAt: number;
  name: string;
  slackId: string;
}

export interface DecisionPayload {
  decision: 'approve' | 'reject';
  note?: string;
  /** Exigido para aprovar quando ha conflito com outra requisicao aprovada. */
  force?: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
