/**
 * Dados de demonstração.
 *
 * Existem para o app poder ser visto e navegado SEM Firebase e SEM backend —
 * útil para revisar o design e para mostrar o fluxo à Suzana antes do deploy.
 * Nada disso vai para produção com o Firebase configurado: veja `isDemoMode()`.
 *
 * As datas são relativas a HOJE, então a demonstração nunca "envelhece".
 * Os cenários foram escolhidos para exercitar o motor de disponibilidade:
 * item esgotado, pré-reserva concorrente, conflito com aprovada, e devolução.
 */
import { addDays, today } from '@/shared/dates';
import { USERS } from '@/shared/users';
import type {
  AppSettings,
  AppUser,
  Item,
  MarketingRequest,
  RequestEvent,
  TimestampLike,
} from '@/shared/types';
import { DEFAULT_PURPOSE_TYPES } from '@/shared/types';

/** Timestamp com a mesma forma do Firestore, para os componentes não notarem diferença. */
export function stamp(date: Date = new Date()): TimestampLike {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

function hoursAgo(hours: number): TimestampLike {
  return stamp(new Date(Date.now() - hours * 3_600_000));
}

const D = today();

// ---------------------------------------------------------------------------
// Pessoas — o Apêndice A inteiro
// ---------------------------------------------------------------------------

const ADMIN_SLACK_ID = 'U09F9LWM6MC';

/**
 * A equipe completa, do mesmo cadastro que o seed usa (`@/shared/users`).
 *
 * De propósito não é um recorte: a tela de identidade existe para achar uma
 * pessoa entre ~110, e uma demonstração com 15 nomes esconderia exatamente o
 * que a busca e a rolagem precisam resolver.
 */
export const DEMO_USERS: AppUser[] = USERS.map((user) => ({
  slackId: user.slackId,
  name: user.name,
  role: user.slackId === ADMIN_SLACK_ID ? 'admin' : 'requester',
  active: true,
}));

// ---------------------------------------------------------------------------
// Itens — os cinco do seed
// ---------------------------------------------------------------------------

export const DEMO_ITEMS: Item[] = [
  {
    id: 'item-tenda',
    name: 'Tenda 3x3',
    slug: 'tenda-3x3',
    category: 'Estrutura',
    icon: 'tent',
    description: 'Tenda branca de 3x3 m para ações ao ar livre. Protege de sol e chuva leve.',
    quantity: 2,
    attributes: [
      { label: 'Dimensões', value: '3 x 3 m' },
      { label: 'Cor', value: 'Branca' },
      { label: 'Montagem', value: '2 pessoas' },
    ],
    storageLocation: 'Depósito do escritório',
    tags: ['externo', 'chuva'],
    active: true,
    createdAt: hoursAgo(900),
  },
  {
    id: 'item-mesa',
    name: 'Mesa dobrável',
    slug: 'mesa-dobravel',
    category: 'Mobiliário',
    icon: 'table',
    description: 'Mesa dobrável para apoio, cadastro e exposição de produtos.',
    quantity: 6,
    attributes: [{ label: 'Dimensões', value: '1,80 x 0,75 m' }],
    storageLocation: 'Depósito do escritório',
    tags: ['apoio'],
    active: true,
    createdAt: hoursAgo(900),
  },
  {
    id: 'item-cadeira',
    name: 'Cadeira',
    slug: 'cadeira',
    category: 'Mobiliário',
    icon: 'chair',
    description: 'Cadeira plástica empilhável para treinamentos, reuniões e ações.',
    quantity: 30,
    attributes: [
      { label: 'Material', value: 'Plástico' },
      { label: 'Empilhável', value: 'Sim' },
    ],
    storageLocation: 'Depósito do escritório',
    tags: ['treinamento'],
    active: true,
    createdAt: hoursAgo(900),
  },
  {
    id: 'item-bancada',
    name: 'Bancada / balcão de degustação',
    slug: 'bancada-degustacao',
    category: 'Ativação',
    icon: 'counter',
    description: 'Balcão de degustação com prateleira interna para estoque de apoio.',
    quantity: 2,
    attributes: [
      { label: 'Dimensões', value: '1,20 x 0,50 m' },
      { label: 'Prateleira interna', value: 'Sim' },
    ],
    storageLocation: 'Loja Maceió Centro',
    tags: ['degustação'],
    active: true,
    createdAt: hoursAgo(900),
  },
  {
    id: 'item-carrinho',
    name: 'Carrinho do Marketing',
    slug: 'carrinho-do-marketing',
    category: 'Ativação',
    icon: 'cart',
    description:
      'Carrinho usado nas abordagens de rua e degustações, com espaço para produtos e material de apoio.',
    quantity: 1,
    attributes: [
      { label: 'Uso', value: 'Degustação e abordagem' },
      { label: 'Transporte', value: 'Precisa de 1 pessoa' },
    ],
    storageLocation: 'Depósito do escritório',
    tags: ['ativação', 'rua'],
    active: true,
    createdAt: hoursAgo(900),
  },
];

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

export const DEMO_SETTINGS: AppSettings = {
  adminSlackId: 'U09F9LWM6MC',
  appUrl: 'http://localhost:5173',
  cities: [
    { name: 'Penedo', state: 'AL', lat: -10.2906, lng: -36.5861 },
    { name: 'Arapiraca', state: 'AL', lat: -9.7519, lng: -36.6611 },
    { name: 'Palmeira dos Índios', state: 'AL', lat: -9.4058, lng: -36.6281 },
    { name: 'Maceió', state: 'AL', lat: -9.6658, lng: -35.7353 },
  ],
  purposeTypes: DEFAULT_PURPOSE_TYPES,
};

// ---------------------------------------------------------------------------
// Requisições
// ---------------------------------------------------------------------------

const city = (name: string, state: string, lat: number, lng: number) => ({
  name,
  state,
  lat,
  lng,
  displayName: `${name}, ${state} — Brasil`,
});

/**
 * `MINE_IDS` são as requisições que a demonstração transfere para quem entrar,
 * para a aba "Minhas requisições" nunca aparecer vazia (ver `adoptIdentity`).
 */
export const DEMO_MINE_IDS = ['req-0002', 'req-0005'];

export const DEMO_REQUESTS: MarketingRequest[] = [
  {
    // Aprovada e em campo: esgota a tenda e mostra "Em uso até…" no catálogo.
    id: 'req-0001',
    number: 1,
    requesterId: 'U07KP9J5BLP',
    requesterName: 'Rafaela Alves Mendes',
    items: [
      { itemId: 'item-tenda', itemName: 'Tenda 3x3', icon: 'tent', quantity: 2 },
      { itemId: 'item-mesa', itemName: 'Mesa dobrável', icon: 'table', quantity: 4 },
    ],
    purposeType: 'Ativação em loja',
    purpose:
      'Ativação de fim de semana na praça central de Penedo, com degustação de perfumaria e abordagem de fluxo. Sábado e domingo, das 9h às 17h.',
    city: city('Penedo', 'AL', -10.2906, -36.5861),
    locationDetail: 'Praça Barão de Penedo',
    startDate: D,
    endDate: addDays(D, 2),
    days: 3,
    status: 'approved',
    decision: {
      by: 'U09F9LWM6MC',
      byName: 'Suzana Martins Tavares',
      at: hoursAgo(30),
      channel: 'slack',
      note: 'Aprovado. A tenda está com um pé torto, cuidado na montagem.',
    },
    unread: { admin: 0, requester: 0 },
    createdAt: hoursAgo(52),
    updatedAt: hoursAgo(30),
  },
  {
    // Pendente, sem conflito: a fila da administradora fica verde.
    id: 'req-0002',
    number: 2,
    requesterId: 'U07KPE840MD',
    requesterName: 'Erick Café Santos Júnior',
    items: [
      { itemId: 'item-tenda', itemName: 'Tenda 3x3', icon: 'tent', quantity: 1 },
      { itemId: 'item-cadeira', itemName: 'Cadeira', icon: 'chair', quantity: 20 },
    ],
    purposeType: 'Treinamento/Reunião',
    purpose:
      'Treinamento de time das lojas de Arapiraca. Preciso das cadeiras para a sala e da tenda para o café da manhã na área externa.',
    city: city('Arapiraca', 'AL', -9.7519, -36.6611),
    locationDetail: 'Loja Arapiraca Shopping',
    startDate: addDays(D, 5),
    endDate: addDays(D, 6),
    days: 2,
    status: 'pending',
    unread: { admin: 1, requester: 0 },
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(6),
  },
  {
    // Pendente COM conflito: disputa o carrinho com a #0004, já aprovada.
    id: 'req-0003',
    number: 3,
    requesterId: 'U07Q9HE3KGA',
    requesterName: 'Amanda Santos Costa',
    items: [
      { itemId: 'item-carrinho', itemName: 'Carrinho do Marketing', icon: 'cart', quantity: 1 },
      { itemId: 'item-bancada', itemName: 'Bancada / balcão de degustação', icon: 'counter', quantity: 1 },
    ],
    purposeType: 'Blitz',
    purpose:
      'Blitz de lançamento na saída do shopping, com degustação rápida e captação de cadastros.',
    city: city('Maceió', 'AL', -9.6658, -35.7353),
    locationDetail: 'Maceió Shopping',
    startDate: addDays(D, 1),
    endDate: addDays(D, 2),
    days: 2,
    status: 'pending',
    unread: { admin: 2, requester: 0 },
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1),
  },
  {
    // Aprovada: é ela que cria o conflito vermelho da #0003.
    id: 'req-0004',
    number: 4,
    requesterId: 'U087M32A18B',
    requesterName: 'Luan Santos de Oliveira',
    items: [{ itemId: 'item-carrinho', itemName: 'Carrinho do Marketing', icon: 'cart', quantity: 1 }],
    purposeType: 'Feira/Exposição',
    purpose: 'Feira da cidade de Palmeira dos Índios — estande da marca por cinco dias.',
    city: city('Palmeira dos Índios', 'AL', -9.4058, -36.6281),
    startDate: D,
    endDate: addDays(D, 5),
    days: 6,
    status: 'approved',
    decision: {
      by: 'U09F9LWM6MC',
      byName: 'Suzana Martins Tavares',
      at: hoursAgo(70),
      channel: 'app',
    },
    unread: { admin: 0, requester: 0 },
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(70),
  },
  {
    // Reprovada, com motivo — mostra o estado vermelho e a nota na timeline.
    id: 'req-0005',
    number: 5,
    requesterId: 'U08JJ7VF0N6',
    requesterName: 'Nathália Vieira Lima',
    items: [{ itemId: 'item-tenda', itemName: 'Tenda 3x3', icon: 'tent', quantity: 2 }],
    purposeType: 'Evento',
    purpose: 'Evento de aniversário da loja, com estrutura na calçada.',
    city: city('Penedo', 'AL', -10.2906, -36.5861),
    startDate: D,
    endDate: addDays(D, 1),
    days: 2,
    status: 'rejected',
    decision: {
      by: 'U09F9LWM6MC',
      byName: 'Suzana Martins Tavares',
      at: hoursAgo(20),
      channel: 'slack',
      note: 'As duas tendas já estão com a Rafaela em Penedo nesse mesmo período. Consegue remarcar para a semana seguinte? Aí libero as duas.',
    },
    unread: { admin: 0, requester: 1 },
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(20),
  },
  {
    // Devolvida antes do prazo: liberou a bancada a partir do dia da devolução.
    id: 'req-0006',
    number: 6,
    requesterId: 'U08K69RC01H',
    requesterName: 'Letícia Soares Belo',
    items: [
      { itemId: 'item-bancada', itemName: 'Bancada / balcão de degustação', icon: 'counter', quantity: 2 },
    ],
    purposeType: 'Ativação em loja',
    purpose: 'Degustação de fim de mês nas duas lojas do centro.',
    city: city('Maceió', 'AL', -9.6658, -35.7353),
    startDate: addDays(D, -6),
    endDate: addDays(D, -1),
    days: 6,
    status: 'returned',
    decision: {
      by: 'U09F9LWM6MC',
      byName: 'Suzana Martins Tavares',
      at: hoursAgo(180),
      channel: 'slack',
    },
    returnedAt: hoursAgo(80),
    returnedOn: addDays(D, -3),
    unread: { admin: 0, requester: 0 },
    createdAt: hoursAgo(200),
    updatedAt: hoursAgo(80),
  },
];

// ---------------------------------------------------------------------------
// Timelines
// ---------------------------------------------------------------------------

function event(
  id: string,
  type: RequestEvent['type'],
  authorId: string,
  authorName: string,
  authorRole: RequestEvent['authorRole'],
  hours: number,
  extra: Partial<RequestEvent> = {}
): RequestEvent {
  return {
    id,
    type,
    authorId,
    authorName,
    authorRole,
    createdAt: hoursAgo(hours),
    notify: { pending: false },
    ...extra,
  };
}

export const DEMO_EVENTS: Record<string, RequestEvent[]> = {
  'req-0001': [
    event('e1', 'created', 'U07KP9J5BLP', 'Rafaela Alves Mendes', 'requester', 52),
    event('e2', 'message', 'U09F9LWM6MC', 'Suzana Martins Tavares', 'admin', 40, {
      text: 'Rafaela, você precisa das 2 tendas mesmo? Tenho outro pedido para o mesmo fim de semana.',
    }),
    event('e3', 'message', 'U07KP9J5BLP', 'Rafaela Alves Mendes', 'requester', 36, {
      text: 'Preciso sim! A praça é grande e vamos montar as duas em pontos diferentes de fluxo.',
    }),
    event('e4', 'approved', 'U09F9LWM6MC', 'Suzana Martins Tavares', 'admin', 30, {
      meta: { note: 'Aprovado. A tenda está com um pé torto, cuidado na montagem.' },
    }),
  ],
  'req-0002': [
    event('e1', 'created', 'U07KPE840MD', 'Erick Café Santos Júnior', 'requester', 6),
    event('e2', 'message', 'U07KPE840MD', 'Erick Café Santos Júnior', 'requester', 5, {
      text: 'Suzana, se as 20 cadeiras forem demais me avisa que eu consigo pegar algumas na loja mesmo.',
    }),
  ],
  'req-0003': [
    event('e1', 'created', 'U07Q9HE3KGA', 'Amanda Santos Costa', 'requester', 3),
    event('e2', 'message', 'U07Q9HE3KGA', 'Amanda Santos Costa', 'requester', 1, {
      text: 'É uma ação rápida, só a manhã de sábado. Se o carrinho estiver ocupado, dá para fazer só com a bancada.',
    }),
  ],
  'req-0004': [event('e1', 'created', 'U087M32A18B', 'Luan Santos de Oliveira', 'requester', 96)],
  'req-0005': [
    event('e1', 'created', 'U08JJ7VF0N6', 'Nathália Vieira Lima', 'requester', 26),
    event('e2', 'rejected', 'U09F9LWM6MC', 'Suzana Martins Tavares', 'admin', 20, {
      meta: {
        note: 'As duas tendas já estão com a Rafaela em Penedo nesse mesmo período. Consegue remarcar para a semana seguinte? Aí libero as duas.',
      },
    }),
    event('e3', 'message', 'U08JJ7VF0N6', 'Nathália Vieira Lima', 'requester', 18, {
      text: 'Sem problema! Vou abrir outra para a semana seguinte então. Obrigada pelo retorno rápido 🙌',
    }),
  ],
  'req-0006': [
    event('e1', 'created', 'U08K69RC01H', 'Letícia Soares Belo', 'requester', 200),
    event('e2', 'approved', 'U09F9LWM6MC', 'Suzana Martins Tavares', 'admin', 180),
    event('e3', 'returned', 'U09F9LWM6MC', 'Suzana Martins Tavares', 'admin', 80, {
      meta: { returnedOn: addDays(D, -3) },
    }),
  ],
};

export const DEMO_COUNTER = DEMO_REQUESTS.length;
