// ATENCAO: arquivo gerado. Nao edite aqui.
// Fonte: /shared — rode `npm run sync:shared` na raiz para atualizar.
/**
 * Cidades sugeridas no wizard — as praças onde o Grupo Alcina Maria opera.
 *
 * FONTE UNICA, compartilhada pelos dois pacotes, pelo mesmo motivo do cadastro
 * de pessoas: o seed grava estas cidades em `settings/app`, e o modo
 * demonstracao precisa mostrar exatamente as mesmas. Quando cada lado tinha a
 * sua copia, trocar as cidades do seed deixou a demonstracao exibindo as
 * antigas — divergencia silenciosa entre o que se testa e o que se publica.
 *
 * Sao apenas ATALHOS: o wizard aceita qualquer cidade pela busca. As
 * coordenadas aqui sao reserva; o seed confirma cada uma no geocoder.
 *
 * Depois de editar, rode `npm run sync:shared` na raiz e `npm run seed`.
 */
import type { CityPreset } from './types';

export const FREQUENT_CITIES: CityPreset[] = [
  { name: 'Palmeira dos Índios', state: 'AL', lat: -9.4058, lng: -36.6281 },
  { name: 'São Sebastião', state: 'AL', lat: -9.9333, lng: -36.5667 },
  { name: 'Teotônio Vilela', state: 'AL', lat: -9.9042, lng: -36.355 },
  { name: 'Coruripe', state: 'AL', lat: -10.1256, lng: -36.1756 },
  { name: 'Penedo', state: 'AL', lat: -10.2906, lng: -36.5861 },
];
