/**
 * Dados iniciais (secao 11). Idempotente: pode rodar quantas vezes precisar.
 *
 *   npm run seed
 *
 * O que faz:
 *   - `users`      — cria/atualiza as ~110 pessoas do Apendice A.
 *   - `items`      — cria os cinco itens do Marketing (so se nao existirem,
 *                    para nao apagar os ajustes feitos pela Suzana no painel).
 *   - `settings/app` e `settings/counters` — configuracao base.
 *
 * As coordenadas das cidades frequentes sao validadas no geocoder (Photon) na
 * hora do seed, com valores conhecidos como reserva caso a rede falhe.
 */
import { collections, db, serverTimestamp } from '../src/firebase';
import { env } from '../src/env';
import { DEFAULT_PURPOSE_TYPES, type ItemInput } from '../src/shared/types';
import { USERS } from './users';

const ADMIN_SLACK_ID = 'U09F9LWM6MC';

/** Cidades frequentes. As coordenadas sao reserva; o geocoder confirma no seed. */
const CITIES = [
  { name: 'Penedo', state: 'AL', lat: -10.2906, lng: -36.5861 },
  { name: 'Arapiraca', state: 'AL', lat: -9.7519, lng: -36.6611 },
  { name: 'Palmeira dos Índios', state: 'AL', lat: -9.4058, lng: -36.6281 },
  { name: 'Maceió', state: 'AL', lat: -9.6658, lng: -35.7353 },
];

/**
 * Quantidades e caracteristicas sao PLACEHOLDERS — a Suzana ajusta no painel.
 * O importante aqui e o app nascer utilizavel, com os itens que a equipe usa.
 */
const ITEMS: (ItemInput & { slug: string })[] = [
  {
    slug: 'carrinho-do-marketing',
    name: 'Carrinho do Marketing',
    category: 'Ativação',
    icon: 'cart',
    description:
      'Carrinho usado nas abordagens de rua e degustações, com espaço para produtos e material de apoio.',
    quantity: 1,
    attributes: [
      { label: 'Uso', value: 'Degustação e abordagem' },
      { label: 'Transporte', value: 'Precisa de 1 pessoa' },
    ],
    storageLocation: '',
    tags: ['ativação', 'rua'],
    active: true,
  },
  {
    slug: 'tenda-3x3',
    name: 'Tenda 3x3',
    category: 'Estrutura',
    icon: 'tent',
    description: 'Tenda branca de 3x3 m para ações ao ar livre. Protege de sol e chuva leve.',
    quantity: 2,
    attributes: [
      { label: 'Dimensões', value: '3 x 3 m' },
      { label: 'Cor', value: 'Branca' },
      { label: 'Montagem', value: '2 pessoas' },
    ],
    storageLocation: '',
    tags: ['externo', 'chuva'],
    active: true,
  },
  {
    slug: 'mesa-dobravel',
    name: 'Mesa dobrável',
    category: 'Mobiliário',
    icon: 'table',
    description: 'Mesa dobrável para apoio, cadastro e exposição de produtos.',
    quantity: 6,
    attributes: [{ label: 'Dimensões', value: '1,80 x 0,75 m' }],
    storageLocation: '',
    tags: ['apoio'],
    active: true,
  },
  {
    slug: 'cadeira',
    name: 'Cadeira',
    category: 'Mobiliário',
    icon: 'chair',
    description: 'Cadeira plástica empilhável para treinamentos, reuniões e ações.',
    quantity: 30,
    attributes: [
      { label: 'Material', value: 'Plástico' },
      { label: 'Empilhável', value: 'Sim' },
    ],
    storageLocation: '',
    tags: ['treinamento'],
    active: true,
  },
  {
    slug: 'bancada-degustacao',
    name: 'Bancada / balcão de degustação',
    category: 'Ativação',
    icon: 'counter',
    description: 'Balcão de degustação com prateleira interna para estoque de apoio.',
    quantity: 2,
    attributes: [
      { label: 'Dimensões', value: '1,20 x 0,50 m' },
      { label: 'Prateleira interna', value: 'Sim' },
    ],
    storageLocation: '',
    tags: ['degustação'],
    active: true,
  },
];

/** Confere as coordenadas de uma cidade no Photon. Reserva em caso de falha. */
async function resolveCity(city: (typeof CITIES)[number]): Promise<(typeof CITIES)[number]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', `${city.name}, ${city.state}, Brasil`);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'default');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: { countrycode?: string; osm_key?: string; name?: string };
      }[];
    };

    const match = payload.features?.find(
      (feature) =>
        feature.properties?.countrycode === 'BR' && feature.properties?.osm_key === 'place'
    );

    const coordinates = match?.geometry?.coordinates;
    if (!coordinates) throw new Error('sem resultado de lugar');

    const [lng, lat] = coordinates;
    console.log(`  ✓ ${city.name}/${city.state}: ${lat.toFixed(4)}, ${lng.toFixed(4)} (geocoder)`);
    return { ...city, lat, lng };
  } catch (error) {
    console.log(
      `  · ${city.name}/${city.state}: usando coordenadas de reserva (${(error as Error).message})`
    );
    return city;
  }
}

async function seedUsers(): Promise<void> {
  console.log(`\nUsuários (${USERS.length})…`);

  // Lotes de 400: o limite de uma escrita em lote do Firestore é 500.
  const chunkSize = 400;
  let created = 0;

  for (let start = 0; start < USERS.length; start += chunkSize) {
    const batch = db().batch();

    for (const user of USERS.slice(start, start + chunkSize)) {
      const reference = collections.users().doc(user.slackId);
      batch.set(
        reference,
        {
          slackId: user.slackId,
          name: user.name,
          role: user.slackId === ADMIN_SLACK_ID ? 'admin' : 'requester',
          active: true,
          createdAt: serverTimestamp(),
        },
        // `merge` preserva o que já existir e mantém o seed idempotente.
        { merge: true }
      );
      created += 1;
    }

    await batch.commit();
  }

  console.log(`  ✓ ${created} pessoa(s) gravada(s). Admin: ${ADMIN_SLACK_ID}`);
}

async function seedItems(): Promise<void> {
  console.log(`\nItens (${ITEMS.length})…`);

  for (const item of ITEMS) {
    // Procura pelo slug para não duplicar em execuções seguidas.
    const existing = await collections.items().where('slug', '==', item.slug).limit(1).get();

    if (!existing.empty) {
      console.log(`  · ${item.name}: já existe, mantido como está.`);
      continue;
    }

    await collections.items().add({
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'seed',
    });

    console.log(`  ✓ ${item.name} criado (${item.quantity} un.)`);
  }
}

async function seedSettings(): Promise<void> {
  console.log('\nConfigurações…');
  console.log('  Validando coordenadas das cidades no geocoder:');

  const cities = [];
  for (const city of CITIES) {
    cities.push(await resolveCity(city));
    // Gentileza com a API pública gratuita.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  await collections.settingsApp().set(
    {
      adminSlackId: ADMIN_SLACK_ID,
      appUrl: env.appUrl,
      cities,
      purposeTypes: DEFAULT_PURPOSE_TYPES,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`  ✓ settings/app gravado (appUrl: ${env.appUrl})`);

  // Nunca sobrescreve o contador: zerar apagaria a numeração já em uso.
  const counters = await collections.settingsCounters().get();
  if (!counters.exists) {
    await collections.settingsCounters().set({ requests: 0 });
    console.log('  ✓ settings/counters criado em 0');
  } else {
    console.log(`  · settings/counters mantido em ${counters.data()?.requests ?? 0}`);
  }
}

async function main(): Promise<void> {
  console.log('AM Marketing — seed');
  console.log('===================');

  await seedUsers();
  await seedItems();
  await seedSettings();

  console.log('\n✅ Seed concluído. Pode rodar de novo quando quiser.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Seed falhou:', error);
    process.exit(1);
  });
