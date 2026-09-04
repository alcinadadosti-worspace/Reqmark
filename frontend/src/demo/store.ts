/**
 * Loja em memória do modo demonstração.
 *
 * Substitui o Firestore E o backend: guarda tudo em memória, notifica os
 * assinantes a cada mudança (imitando o `onSnapshot`) e implementa as mesmas
 * operações — criar requisição, mensagem, cancelar, aprovar, reprovar, devolver
 * e o CRUD de itens.
 *
 * As decisões passam pelo MESMO motor de disponibilidade da produção, então o
 * conflito que aparece aqui é o conflito de verdade.
 */
import { buildOccupancy, evaluatePeriod, type Conflict } from '@/shared/availability';
import { today } from '@/shared/dates';
import type {
  AppSettings,
  AppUser,
  CityPreset,
  Item,
  ItemInput,
  MarketingRequest,
  RequestEvent,
  UserRole,
} from '@/shared/types';
import {
  DEMO_COUNTER,
  DEMO_EVENTS,
  DEMO_ITEMS,
  DEMO_MINE_IDS,
  DEMO_REQUESTS,
  DEMO_SETTINGS,
  DEMO_USERS,
  stamp,
} from './fixtures';

type Listener = () => void;

/** Atraso artificial: sem ele, tudo é instantâneo demais e some o feedback de carregando. */
const LATENCY_MS = 220;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class DemoStore {
  users: AppUser[] = clone(DEMO_USERS);
  items: Item[] = clone(DEMO_ITEMS);
  settings: AppSettings = clone(DEMO_SETTINGS);
  requests: MarketingRequest[] = clone(DEMO_REQUESTS);
  events: Record<string, RequestEvent[]> = clone(DEMO_EVENTS);

  private counter = DEMO_COUNTER;
  private listeners = new Set<Listener>();
  private adopted = false;

  // --- Assinatura ---------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  // --- Identidade ---------------------------------------------------------

  /**
   * Passa duas requisições de exemplo para quem acabou de entrar, para a aba
   * "Minhas requisições" e o sino terem conteúdo seja quem for a pessoa.
   */
  adoptIdentity(slackId: string, name: string): void {
    if (this.adopted) return;
    this.adopted = true;

    for (const id of DEMO_MINE_IDS) {
      const request = this.requests.find((entry) => entry.id === id);
      if (!request) continue;

      const previousId = request.requesterId;
      request.requesterId = slackId;
      request.requesterName = name;

      for (const event of this.events[id] ?? []) {
        if (event.authorId === previousId) {
          event.authorId = slackId;
          event.authorName = name;
        }
      }
    }

    this.emit();
  }

  // --- Escritas do solicitante -------------------------------------------

  async createRequest(input: {
    requesterId: string;
    requesterName: string;
    items: MarketingRequest['items'];
    purposeType: string;
    purpose: string;
    city: MarketingRequest['city'];
    locationDetail?: string;
    startDate: string;
    endDate: string;
    days: number;
  }): Promise<{ id: string; number: number }> {
    await wait();

    this.counter += 1;
    const id = `req-demo-${this.counter}`;

    this.requests.unshift({
      id,
      number: this.counter,
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      items: input.items,
      purposeType: input.purposeType,
      purpose: input.purpose,
      city: input.city,
      locationDetail: input.locationDetail,
      startDate: input.startDate,
      endDate: input.endDate,
      days: input.days,
      status: 'pending',
      slack: {},
      notify: { adminPending: true },
      unread: { admin: 1, requester: 0 },
      createdAt: stamp(),
      updatedAt: stamp(),
    });

    this.events[id] = [
      {
        id: 'e1',
        type: 'created',
        authorId: input.requesterId,
        authorName: input.requesterName,
        authorRole: 'requester',
        createdAt: stamp(),
        notify: { pending: false },
      },
    ];

    this.emit();
    return { id, number: this.counter };
  }

  async addMessage(input: {
    requestId: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    text: string;
  }): Promise<void> {
    await wait(120);

    const list = this.events[input.requestId] ?? [];
    list.push({
      id: `e${list.length + 1}-${Date.now()}`,
      type: 'message',
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      text: input.text,
      createdAt: stamp(),
      notify: { pending: false },
    });
    this.events[input.requestId] = list;

    const request = this.find(input.requestId);
    if (request) {
      const side = input.authorRole === 'admin' ? 'requester' : 'admin';
      request.unread = { ...request.unread, [side]: (request.unread?.[side] ?? 0) + 1 };
      request.updatedAt = stamp();
    }

    this.emit();
  }

  async cancelRequest(requestId: string, actorId: string, actorName: string): Promise<void> {
    await wait();

    const request = this.find(requestId);
    if (!request) return;

    request.status = 'cancelled';
    request.cancelledAt = stamp();
    request.updatedAt = stamp();

    this.pushEvent(requestId, {
      type: 'cancelled',
      authorId: actorId,
      authorName: actorName,
      authorRole: 'requester',
    });

    this.emit();
  }

  markRead(requestId: string, side: 'admin' | 'requester'): void {
    const request = this.find(requestId);
    if (!request || (request.unread?.[side] ?? 0) === 0) return;

    request.unread = { ...request.unread, [side]: 0 };
    this.emit();
  }

  // --- Ações da administradora -------------------------------------------

  /** Conflitos de uma requisição contra as demais — o mesmo cálculo da produção. */
  conflictsFor(requestId: string): Conflict[] {
    const request = this.find(requestId);
    if (!request) return [];

    const index = buildOccupancy(this.requests, { excludeRequestId: requestId });
    const stock = new Map(
      this.items.map((item) => [item.id, { id: item.id, name: item.name, quantity: item.quantity }])
    );

    return evaluatePeriod({
      selection: request.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      items: stock,
      index,
      startDate: request.startDate,
      endDate: request.endDate,
    }).blocking;
  }

  async decide(
    requestId: string,
    decision: 'approve' | 'reject',
    note: string | undefined,
    force: boolean | undefined,
    actor: { slackId: string; name: string }
  ): Promise<void> {
    await wait();

    const request = this.find(requestId);
    if (!request) throw new Error('Requisição não encontrada.');

    if (request.status !== 'pending') {
      throw new Error(`Esta requisição já foi decidida (status: ${request.status}).`);
    }

    if (decision === 'approve' && !force && this.conflictsFor(requestId).length > 0) {
      throw new Error('Há conflito com uma reserva já aprovada. Confirme para aprovar mesmo assim.');
    }

    request.status = decision === 'approve' ? 'approved' : 'rejected';
    request.decision = {
      by: actor.slackId,
      byName: actor.name,
      at: stamp(),
      channel: 'app',
      ...(note ? { note } : {}),
    };
    request.updatedAt = stamp();
    request.unread = { admin: 0, requester: (request.unread?.requester ?? 0) + 1 };

    this.pushEvent(requestId, {
      type: decision === 'approve' ? 'approved' : 'rejected',
      authorId: actor.slackId,
      authorName: actor.name,
      authorRole: 'admin',
      meta: note ? { note } : undefined,
    });

    this.emit();
  }

  async markReturned(requestId: string, actor: { slackId: string; name: string }): Promise<void> {
    await wait();

    const request = this.find(requestId);
    if (!request) throw new Error('Requisição não encontrada.');
    if (request.status !== 'approved') throw new Error('Só dá para devolver uma requisição aprovada.');

    const returnedOn = today();
    request.status = 'returned';
    request.returnedAt = stamp();
    request.returnedOn = returnedOn;
    request.updatedAt = stamp();
    request.unread = { ...request.unread, requester: (request.unread?.requester ?? 0) + 1 };

    this.pushEvent(requestId, {
      type: 'returned',
      authorId: actor.slackId,
      authorName: actor.name,
      authorRole: 'admin',
      meta: { returnedOn },
    });

    this.emit();
  }

  // --- Catálogo e configurações -------------------------------------------

  async createItem(input: ItemInput): Promise<string> {
    await wait();

    const id = `item-demo-${Date.now()}`;
    this.items.push({
      id,
      slug: id,
      createdAt: stamp(),
      updatedAt: stamp(),
      createdBy: 'demo',
      ...input,
    });

    this.emit();
    return id;
  }

  async updateItem(itemId: string, input: ItemInput): Promise<void> {
    await wait();

    const index = this.items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new Error('Item não encontrado.');

    this.items[index] = { ...this.items[index], ...input, updatedAt: stamp() };
    this.emit();
  }

  async deleteItem(itemId: string): Promise<void> {
    await wait();
    this.items = this.items.filter((item) => item.id !== itemId);
    this.emit();
  }

  async updateSettings(input: {
    cities?: CityPreset[];
    purposeTypes?: string[];
  }): Promise<void> {
    await wait();

    if (input.cities) this.settings.cities = input.cities;
    if (input.purposeTypes) this.settings.purposeTypes = input.purposeTypes;

    this.emit();
  }

  // --- Auxiliares ---------------------------------------------------------

  find(requestId: string): MarketingRequest | undefined {
    return this.requests.find((request) => request.id === requestId);
  }

  eventsOf(requestId: string): RequestEvent[] {
    return this.events[requestId] ?? [];
  }

  requestsOf(requesterId: string): MarketingRequest[] {
    return this.requests.filter((request) => request.requesterId === requesterId);
  }

  private pushEvent(
    requestId: string,
    input: Omit<RequestEvent, 'id' | 'createdAt' | 'notify'>
  ): void {
    const list = this.events[requestId] ?? [];
    list.push({
      id: `e${list.length + 1}-${Date.now()}`,
      createdAt: stamp(),
      notify: { pending: false },
      ...input,
    });
    this.events[requestId] = list;
  }
}

export const demoStore = new DemoStore();
