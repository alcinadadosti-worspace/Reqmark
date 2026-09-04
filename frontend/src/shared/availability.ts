// ATENCAO: arquivo gerado. Nao edite aqui.
// Fonte: /shared — rode `npm run sync:shared` na raiz para atualizar.
/**
 * Motor de disponibilidade — o coracao do app.
 *
 * Regras (secao 7 da especificacao):
 *  - `used(i, d)`      = soma das quantidades de `i` em requisicoes APROVADAS
 *                        cujo periodo contem `d`.
 *  - `available(i, d)` = `item.quantity - used(i, d)`.
 *  - Requisicoes PENDENTES nao bloqueiam: entram como pre-reserva (aviso).
 *  - Devolucao antecipada libera o item A PARTIR do dia da devolucao — ou seja,
 *    a ocupacao de uma requisicao devolvida termina no dia anterior.
 *  - Um periodo e valido quando, para TODOS os itens e TODOS os dias,
 *    `available >= quantidade pedida`.
 *
 * Modulo puro: o frontend usa para pintar o calendario e o backend reusa para
 * revalidar no momento da aprovacao. Nenhuma dependencia externa.
 */
import {
  addDays,
  compareDays,
  daysBetweenInclusive,
  eachDay,
  isWithin,
  minDay,
} from './dates';
import type { DayString, RequestStatus } from './types';

// ---------------------------------------------------------------------------
// Formas de entrada (estruturais, para os testes poderem passar objetos minimos)
// ---------------------------------------------------------------------------

export interface OccupancyItemRef {
  itemId: string;
  itemName?: string;
  quantity: number;
}

/** Subconjunto de `MarketingRequest` que o motor precisa conhecer. */
export interface OccupancySource {
  id: string;
  number?: number;
  status: RequestStatus;
  requesterId?: string;
  requesterName?: string;
  startDate: DayString;
  endDate: DayString;
  returnedOn?: DayString | null;
  items: OccupancyItemRef[];
  city?: { name?: string; state?: string } | null;
  locationDetail?: string;
}

/** Subconjunto de `Item` que o motor precisa conhecer. */
export interface StockItemRef {
  id: string;
  name: string;
  quantity: number;
}

/** Uma linha "quem esta com o item" — usada nas mensagens de conflito. */
export interface Holder {
  requestId: string;
  number: number;
  requesterId: string;
  requesterName: string;
  quantity: number;
  startDate: DayString;
  endDate: DayString;
  city: string;
  status: RequestStatus;
}

export interface OccupancyEntry {
  start: DayString;
  end: DayString;
  holder: Holder;
}

interface ItemOccupancy {
  approved: OccupancyEntry[];
  pending: OccupancyEntry[];
}

export type OccupancyIndex = Map<string, ItemOccupancy>;

export interface BuildOccupancyOptions {
  /** Ignora a propria requisicao ao reavaliar uma ja existente. */
  excludeRequestId?: string;
}

// ---------------------------------------------------------------------------
// Ocupacao efetiva de uma requisicao
// ---------------------------------------------------------------------------

/**
 * Intervalo que a requisicao efetivamente ocupa, ou `null` se nao ocupa nada.
 *
 * `approved` ocupa o periodo inteiro. `returned` ocupa apenas ate a vespera da
 * devolucao — e por isso costuma nao ocupar nada no futuro. `rejected` e
 * `cancelled` nunca ocupam. `pending` ocupa apenas como pre-reserva (soft).
 */
export function effectiveRange(
  request: Pick<OccupancySource, 'status' | 'startDate' | 'endDate' | 'returnedOn'>
): { start: DayString; end: DayString } | null {
  const { status, startDate, endDate } = request;

  if (status === 'rejected' || status === 'cancelled') return null;
  if (compareDays(startDate, endDate) > 0) return null;

  if (status === 'returned') {
    const returnedOn = request.returnedOn;
    if (!returnedOn) return null; // devolvida sem data: libera tudo
    const end = minDay(endDate, addDays(returnedOn, -1));
    if (compareDays(startDate, end) > 0) return null; // devolvida antes de comecar
    return { start: startDate, end };
  }

  return { start: startDate, end: endDate };
}

/** Requisicoes aprovadas (e devolvidas, ate a vespera) bloqueiam de fato. */
export function isBlockingStatus(status: RequestStatus): boolean {
  return status === 'approved' || status === 'returned';
}

/** Pendentes nao bloqueiam — apenas sinalizam pre-reserva. */
export function isSoftStatus(status: RequestStatus): boolean {
  return status === 'pending';
}

// ---------------------------------------------------------------------------
// Indice
// ---------------------------------------------------------------------------

function holderFrom(request: OccupancySource, line: OccupancyItemRef, range: { start: DayString; end: DayString }): Holder {
  const cityName = request.city?.name
    ? request.city.state
      ? `${request.city.name}/${request.city.state}`
      : request.city.name
    : '';
  return {
    requestId: request.id,
    number: request.number ?? 0,
    requesterId: request.requesterId ?? '',
    requesterName: request.requesterName ?? 'Alguem',
    quantity: line.quantity,
    startDate: range.start,
    endDate: range.end,
    city: cityName,
    status: request.status,
  };
}

/**
 * Agrupa as requisicoes por item para consultas rapidas por dia.
 * Chamado uma vez por render; as consultas seguintes varrem apenas as
 * requisicoes do item em questao.
 */
export function buildOccupancy(
  requests: readonly OccupancySource[],
  options: BuildOccupancyOptions = {}
): OccupancyIndex {
  const index: OccupancyIndex = new Map();

  for (const request of requests) {
    if (options.excludeRequestId && request.id === options.excludeRequestId) continue;

    const range = effectiveRange(request);
    if (!range) continue;

    const soft = isSoftStatus(request.status);
    const hard = isBlockingStatus(request.status);
    if (!soft && !hard) continue;

    for (const line of request.items) {
      if (!line.itemId || line.quantity <= 0) continue;

      let bucket = index.get(line.itemId);
      if (!bucket) {
        bucket = { approved: [], pending: [] };
        index.set(line.itemId, bucket);
      }

      const entry: OccupancyEntry = { ...range, holder: holderFrom(request, line, range) };
      (hard ? bucket.approved : bucket.pending).push(entry);
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Consultas por dia
// ---------------------------------------------------------------------------

export interface DayAvailability {
  itemId: string;
  /** Unidades existentes no estoque. */
  total: number;
  /** Unidades comprometidas por requisicoes aprovadas. */
  used: number;
  /** Unidades reservadas por requisicoes pendentes (nao bloqueiam). */
  pending: number;
  /** `total - used` — o que realmente pode ser aprovado hoje. */
  available: number;
  /** `total - used - pending` — pior caso se todas as pendentes forem aprovadas. */
  availableIfPendingApproved: number;
  approvedHolders: Holder[];
  pendingHolders: Holder[];
}

const EMPTY_OCCUPANCY: ItemOccupancy = { approved: [], pending: [] };

/** Disponibilidade de um item num dia especifico. */
export function availabilityOn(
  item: StockItemRef,
  index: OccupancyIndex,
  day: DayString
): DayAvailability {
  const bucket = index.get(item.id) ?? EMPTY_OCCUPANCY;

  let used = 0;
  const approvedHolders: Holder[] = [];
  for (const entry of bucket.approved) {
    if (!isWithin(day, entry.start, entry.end)) continue;
    used += entry.holder.quantity;
    approvedHolders.push(entry.holder);
  }

  let pending = 0;
  const pendingHolders: Holder[] = [];
  for (const entry of bucket.pending) {
    if (!isWithin(day, entry.start, entry.end)) continue;
    pending += entry.holder.quantity;
    pendingHolders.push(entry.holder);
  }

  const total = Math.max(0, item.quantity);
  return {
    itemId: item.id,
    total,
    used,
    pending,
    available: total - used,
    availableIfPendingApproved: total - used - pending,
    approvedHolders,
    pendingHolders,
  };
}

/** Menor disponibilidade de um item ao longo de um periodo (o gargalo). */
export function availabilityOverRange(
  item: StockItemRef,
  index: OccupancyIndex,
  start: DayString,
  end: DayString
): DayAvailability & { day: DayString } {
  const days = eachDay(start, end);
  let worst: (DayAvailability & { day: DayString }) | null = null;

  for (const day of days) {
    const snapshot = { ...availabilityOn(item, index, day), day };
    if (!worst || snapshot.available < worst.available) worst = snapshot;
  }

  return worst ?? { ...availabilityOn(item, index, start), day: start };
}

// ---------------------------------------------------------------------------
// Avaliacao de um periodo para uma selecao de itens
// ---------------------------------------------------------------------------

export type DayStatus = 'free' | 'pending' | 'blocked';

export interface SelectionLine {
  itemId: string;
  quantity: number;
}

export interface Conflict {
  kind: 'blocked' | 'pending';
  itemId: string;
  itemName: string;
  /** Quantidade pedida pelo solicitante. */
  requested: number;
  total: number;
  /** Menor disponibilidade observada nos dias afetados. */
  minAvailable: number;
  /** Dias afetados, em ordem. */
  days: DayString[];
  /** Os mesmos dias agrupados em intervalos continuos, para exibir. */
  ranges: { start: DayString; end: DayString }[];
  holders: Holder[];
}

export interface PeriodEvaluation {
  ok: boolean;
  /** Conflitos com requisicoes aprovadas — impedem a requisicao. */
  blocking: Conflict[];
  /** Concorrencia com pendentes — apenas alertam. */
  warnings: Conflict[];
  /** Estado de cada dia do periodo avaliado. */
  byDay: Map<DayString, DayStatus>;
}

export interface EvaluatePeriodInput {
  selection: readonly SelectionLine[];
  items: ReadonlyMap<string, StockItemRef>;
  index: OccupancyIndex;
  startDate: DayString;
  endDate: DayString;
}

/** Junta dias soltos em intervalos continuos: [01,02,03,07] -> [01..03, 07..07]. */
export function groupConsecutiveDays(days: readonly DayString[]): { start: DayString; end: DayString }[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort(compareDays);
  const ranges: { start: DayString; end: DayString }[] = [];

  let start = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === previous) continue;
    if (current === addDays(previous, 1)) {
      previous = current;
      continue;
    }
    ranges.push({ start, end: previous });
    start = current;
    previous = current;
  }

  ranges.push({ start, end: previous });
  return ranges;
}

function uniqueHolders(holders: readonly Holder[]): Holder[] {
  const seen = new Map<string, Holder>();
  for (const holder of holders) {
    if (!seen.has(holder.requestId)) seen.set(holder.requestId, holder);
  }
  return [...seen.values()];
}

/**
 * Avalia um periodo inteiro para a selecao de itens.
 * Retorna o estado dia a dia (para pintar o calendario) e os conflitos
 * agregados por item (para as mensagens ao usuario e ao Slack).
 */
export function evaluatePeriod(input: EvaluatePeriodInput): PeriodEvaluation {
  const { selection, items, index, startDate, endDate } = input;
  const byDay = new Map<DayString, DayStatus>();

  interface Accumulator {
    itemName: string;
    total: number;
    requested: number;
    blockedDays: DayString[];
    pendingDays: DayString[];
    minAvailable: number;
    blockedHolders: Holder[];
    pendingHolders: Holder[];
  }
  const perItem = new Map<string, Accumulator>();

  for (const day of eachDay(startDate, endDate)) {
    let status: DayStatus = 'free';

    for (const line of selection) {
      if (line.quantity <= 0) continue;
      const item = items.get(line.itemId);
      if (!item) continue;

      const snapshot = availabilityOn(item, index, day);

      let accumulator = perItem.get(line.itemId);
      if (!accumulator) {
        accumulator = {
          itemName: item.name,
          total: snapshot.total,
          requested: line.quantity,
          blockedDays: [],
          pendingDays: [],
          minAvailable: snapshot.available,
          blockedHolders: [],
          pendingHolders: [],
        };
        perItem.set(line.itemId, accumulator);
      }
      accumulator.minAvailable = Math.min(accumulator.minAvailable, snapshot.available);

      if (snapshot.available < line.quantity) {
        accumulator.blockedDays.push(day);
        accumulator.blockedHolders.push(...snapshot.approvedHolders);
        status = 'blocked';
      } else if (snapshot.availableIfPendingApproved < line.quantity) {
        accumulator.pendingDays.push(day);
        accumulator.pendingHolders.push(...snapshot.pendingHolders);
        if (status === 'free') status = 'pending';
      }
    }

    byDay.set(day, status);
  }

  const blocking: Conflict[] = [];
  const warnings: Conflict[] = [];

  for (const [itemId, accumulator] of perItem) {
    if (accumulator.blockedDays.length > 0) {
      blocking.push({
        kind: 'blocked',
        itemId,
        itemName: accumulator.itemName,
        requested: accumulator.requested,
        total: accumulator.total,
        minAvailable: accumulator.minAvailable,
        days: accumulator.blockedDays,
        ranges: groupConsecutiveDays(accumulator.blockedDays),
        holders: uniqueHolders(accumulator.blockedHolders),
      });
    }
    if (accumulator.pendingDays.length > 0) {
      warnings.push({
        kind: 'pending',
        itemId,
        itemName: accumulator.itemName,
        requested: accumulator.requested,
        total: accumulator.total,
        minAvailable: accumulator.minAvailable,
        days: accumulator.pendingDays,
        ranges: groupConsecutiveDays(accumulator.pendingDays),
        holders: uniqueHolders(accumulator.pendingHolders),
      });
    }
  }

  return { ok: blocking.length === 0, blocking, warnings, byDay };
}

/**
 * Estado de cada dia de uma janela (um mes do calendario, por exemplo) para a
 * selecao atual. Cada dia e avaliado como um periodo de um unico dia.
 */
export function dayStatesForWindow(input: {
  selection: readonly SelectionLine[];
  items: ReadonlyMap<string, StockItemRef>;
  index: OccupancyIndex;
  from: DayString;
  to: DayString;
}): Map<DayString, DayStatus> {
  const { selection, items, index, from, to } = input;
  const states = new Map<DayString, DayStatus>();

  for (const day of eachDay(from, to)) {
    let status: DayStatus = 'free';
    for (const line of selection) {
      if (line.quantity <= 0) continue;
      const item = items.get(line.itemId);
      if (!item) continue;
      const snapshot = availabilityOn(item, index, day);
      if (snapshot.available < line.quantity) {
        status = 'blocked';
        break;
      }
      if (snapshot.availableIfPendingApproved < line.quantity && status === 'free') {
        status = 'pending';
      }
    }
    states.set(day, status);
  }

  return states;
}

// ---------------------------------------------------------------------------
// Apoio a interface
// ---------------------------------------------------------------------------

export interface ScheduleBar {
  requestId: string;
  number: number;
  itemId: string;
  requesterId: string;
  requesterName: string;
  quantity: number;
  start: DayString;
  end: DayString;
  city: string;
  status: RequestStatus;
  /** Dias do periodo visivel ocupados por esta barra. */
  visibleStart: DayString;
  visibleEnd: DayString;
}

/** Barras de ocupacao de um item dentro de uma janela — base da Agenda. */
export function itemSchedule(
  itemId: string,
  index: OccupancyIndex,
  from: DayString,
  to: DayString
): ScheduleBar[] {
  const bucket = index.get(itemId) ?? EMPTY_OCCUPANCY;
  const bars: ScheduleBar[] = [];

  for (const entry of [...bucket.approved, ...bucket.pending]) {
    if (compareDays(entry.end, from) < 0 || compareDays(entry.start, to) > 0) continue;
    bars.push({
      requestId: entry.holder.requestId,
      number: entry.holder.number,
      itemId,
      requesterId: entry.holder.requesterId,
      requesterName: entry.holder.requesterName,
      quantity: entry.holder.quantity,
      start: entry.start,
      end: entry.end,
      city: entry.holder.city,
      status: entry.holder.status,
      visibleStart: compareDays(entry.start, from) < 0 ? from : entry.start,
      visibleEnd: compareDays(entry.end, to) > 0 ? to : entry.end,
    });
  }

  return bars.sort(
    (a, b) => compareDays(a.start, b.start) || a.requesterName.localeCompare(b.requesterName, 'pt-BR')
  );
}

/** Proxima devolucao de um item que esta em uso — alimenta o badge do catalogo. */
export function nextReturnAfter(
  itemId: string,
  index: OccupancyIndex,
  day: DayString
): Holder | null {
  const bucket = index.get(itemId) ?? EMPTY_OCCUPANCY;
  let soonest: Holder | null = null;

  for (const entry of bucket.approved) {
    if (!isWithin(day, entry.start, entry.end)) continue;
    if (!soonest || compareDays(entry.end, soonest.endDate) < 0) soonest = entry.holder;
  }

  return soonest;
}

/**
 * Primeiro dia, a partir de `from`, em que a selecao inteira cabe por
 * `durationDays` dias seguidos. Usado para sugerir uma alternativa quando o
 * periodo escolhido esta bloqueado.
 */
export function findNextFreeWindow(input: {
  selection: readonly SelectionLine[];
  items: ReadonlyMap<string, StockItemRef>;
  index: OccupancyIndex;
  from: DayString;
  durationDays: number;
  searchDays?: number;
}): { start: DayString; end: DayString } | null {
  const { selection, items, index, from, durationDays } = input;
  const horizon = input.searchDays ?? 120;
  const length = Math.max(1, durationDays);

  for (let offset = 0; offset <= horizon; offset += 1) {
    const start = addDays(from, offset);
    const end = addDays(start, length - 1);
    const evaluation = evaluatePeriod({ selection, items, index, startDate: start, endDate: end });
    if (evaluation.ok) return { start, end };
  }

  return null;
}

/** Quantidade total de itens (somando as unidades) de uma selecao. */
export function totalUnits(selection: readonly SelectionLine[]): number {
  return selection.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}

/** Duracao em dias de um periodo, inclusiva. Reexportado por conveniencia. */
export const periodLength = daysBetweenInclusive;
