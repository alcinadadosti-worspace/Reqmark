/**
 * Busca de cidades — gratuita e sem chave de API (restricao 1).
 *
 * Photon (Komoot) e a fonte principal: rapido, aceita CORS e nao pede chave.
 * Nominatim entra como reserva, respeitando o limite de 1 requisicao por
 * segundo da politica de uso. Resultados restritos ao Brasil e priorizados por
 * proximidade de Alagoas.
 */
import type { CityRef } from '@/shared/types';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Centro aproximado de Alagoas: puxa os resultados da regiao para o topo. */
const ALAGOAS = { lat: -9.5713, lng: -36.782 };

/** Tipos de lugar que interessam — evita ruas, lojas e pontos de interesse. */
const PLACE_VALUES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'hamlet',
  'borough',
  'suburb',
  'state',
]);

const UF_BY_STATE: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapá: 'AP',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceará: 'CE',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espírito santo': 'ES',
  'espirito santo': 'ES',
  goiás: 'GO',
  goias: 'GO',
  maranhão: 'MA',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  pará: 'PA',
  para: 'PA',
  paraíba: 'PB',
  paraiba: 'PB',
  paraná: 'PR',
  parana: 'PR',
  pernambuco: 'PE',
  piauí: 'PI',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondônia: 'RO',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'são paulo': 'SP',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

export type CityResult = CityRef;

/** `Alagoas` -> `AL`. Devolve a entrada original se nao reconhecer. */
export function stateToUf(state: string | undefined | null): string {
  if (!state) return '';
  const clean = state.trim();
  if (clean.length === 2) return clean.toUpperCase();
  return UF_BY_STATE[clean.toLowerCase()] ?? clean;
}

/** Remove acentos e normaliza para comparacoes tolerantes. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function buildDisplayName(name: string, uf: string): string {
  return uf ? `${name}, ${uf} — Brasil` : `${name} — Brasil`;
}

function dedupe(results: CityResult[]): CityResult[] {
  const seen = new Set<string>();
  const output: CityResult[] = [];
  for (const result of results) {
    const key = `${normalize(result.name)}|${result.state}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }
  return output;
}

// --- Photon ---------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    countrycode?: string;
    state?: string;
    osm_key?: string;
    osm_value?: string;
    county?: string;
  };
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<CityResult[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'default');
  url.searchParams.set('limit', '12');
  // Vies geografico: resultados perto de Alagoas primeiro.
  url.searchParams.set('lat', String(ALAGOAS.lat));
  url.searchParams.set('lon', String(ALAGOAS.lng));

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Photon respondeu ${response.status}`);

  const payload = (await response.json()) as { features?: PhotonFeature[] };

  return (payload.features ?? [])
    .filter((feature) => {
      const props = feature.properties;
      if (!props?.name || props.countrycode !== 'BR') return false;
      if (props.osm_key !== 'place') return false;
      return PLACE_VALUES.has(props.osm_value ?? '');
    })
    .map((feature) => {
      const props = feature.properties!;
      const [lng, lat] = feature.geometry?.coordinates ?? [0, 0];
      const uf = stateToUf(props.state);
      return {
        name: props.name!,
        state: uf,
        lat,
        lng,
        displayName: buildDisplayName(props.name!, uf),
      };
    })
    .filter((city) => Number.isFinite(city.lat) && Number.isFinite(city.lng));
}

// --- Nominatim (reserva) --------------------------------------------------

interface NominatimResult {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  address?: { state?: string; city?: string; town?: string; village?: string; municipality?: string };
}

let lastNominatimCall = 0;

/** Politica de uso do Nominatim: no maximo 1 requisicao por segundo. */
async function throttleNominatim(): Promise<void> {
  const elapsed = Date.now() - lastNominatimCall;
  const wait = 1100 - elapsed;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimCall = Date.now();
}

async function searchNominatim(query: string, signal?: AbortSignal): Promise<CityResult[]> {
  await throttleNominatim();
  if (signal?.aborted) return [];

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('limit', '8');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'pt-BR');

  // O navegador nao deixa definir User-Agent; o Nominatim aceita o Referer,
  // que e enviado automaticamente e identifica a origem do app.
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`);

  const payload = (await response.json()) as NominatimResult[];

  return payload
    .map((entry) => {
      const address = entry.address ?? {};
      const name =
        entry.name || address.city || address.town || address.village || address.municipality || '';
      if (!name) return null;
      const uf = stateToUf(address.state);
      return {
        name,
        state: uf,
        lat: Number(entry.lat),
        lng: Number(entry.lon),
        displayName: buildDisplayName(name, uf),
      } satisfies CityResult;
    })
    .filter((city): city is CityResult => Boolean(city && Number.isFinite(city.lat)));
}

// --- API publica ----------------------------------------------------------

const cache = new Map<string, CityResult[]>();

export interface SearchCitiesResult {
  cities: CityResult[];
  /** `true` quando os dois geocoders falharam — a UI libera digitar sem pino. */
  failed: boolean;
}

/**
 * Busca cidades brasileiras pelo nome.
 * Tenta o Photon; se ele falhar, cai no Nominatim. Nunca lanca excecao — em vez
 * disso devolve `failed: true` para a tela oferecer o caminho manual.
 */
export async function searchCities(
  query: string,
  signal?: AbortSignal
): Promise<SearchCitiesResult> {
  const term = query.trim();
  if (term.length < 2) return { cities: [], failed: false };

  const key = normalize(term);
  const cached = cache.get(key);
  if (cached) return { cities: cached, failed: false };

  try {
    const cities = dedupe(await searchPhoton(term, signal)).slice(0, 8);
    if (cities.length > 0) {
      cache.set(key, cities);
      return { cities, failed: false };
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return { cities: [], failed: false };
  }

  try {
    const cities = dedupe(await searchNominatim(term, signal)).slice(0, 8);
    cache.set(key, cities);
    return { cities, failed: false };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return { cities: [], failed: false };
    return { cities: [], failed: true };
  }
}

/** Monta uma cidade "sem pino" quando os geocoders nao respondem. */
export function manualCity(name: string, state = ''): CityRef {
  const clean = name.trim();
  const uf = stateToUf(state);
  return {
    name: clean,
    state: uf,
    lat: 0,
    lng: 0,
    displayName: uf ? `${clean}, ${uf}` : clean,
  };
}

/** Uma cidade sem coordenadas nao deve abrir o mapa. */
export function hasCoordinates(city: Pick<CityRef, 'lat' | 'lng'>): boolean {
  return Number.isFinite(city.lat) && Number.isFinite(city.lng) && (city.lat !== 0 || city.lng !== 0);
}

/** `Penedo/AL` */
export function cityLabel(city: Pick<CityRef, 'name' | 'state'>): string {
  return city.state ? `${city.name}/${city.state}` : city.name;
}
