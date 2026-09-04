/**
 * Camada de tiles dos mapas — gratuita e SEM chave de API (restrição 1).
 *
 * Por que não é mais a CARTO. A especificação sugeria os tiles "dark_all" da
 * CARTO, mas eles passaram a exigir chave: hoje o servidor responde 200 e
 * devolve o tile carimbado com "API KEY REQUIRED — carto.com/basemaps/apikey"
 * por cima do mapa. Como chave da CARTO é serviço pago, ficaria fora da
 * restrição de custo zero.
 *
 * A troca é o "World Dark Gray Canvas" da Esri, servido publicamente em
 * `services.arcgisonline.com` sem chave nem cadastro. São duas camadas: a base
 * (relevo, água, vias) e a de referência (nomes de lugares) por cima — é assim
 * que a Esri publica esse basemap.
 *
 * Alternativa considerada e descartada: tiles do OpenStreetMap com um filtro
 * CSS de inversão para simular o escuro. Funciona, mas os rótulos invertidos
 * ficam ruins de ler e a política de uso do OSM desencoraja aplicações
 * dependerem dos tiles públicos deles.
 */

const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas';

/** Base escura: relevo, água e malha viária. */
export const TILE_BASE_URL = `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;

/** Rótulos (nomes de cidades e ruas), desenhados por cima da base. */
export const TILE_LABELS_URL = `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * O basemap da Esri tem tiles próprios até o zoom 16; acima disso o Leaflet
 * amplia o último nível em vez de pedir tiles que não existem (e ficariam em
 * branco).
 */
export const TILE_MAX_NATIVE_ZOOM = 16;
export const TILE_MAX_ZOOM = 19;
