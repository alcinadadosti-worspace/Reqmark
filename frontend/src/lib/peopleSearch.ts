/**
 * Busca de pessoas na tela de identidade.
 *
 * A lista tem ~110 nomes, então mostrar todo mundo de uma vez não ajuda: a
 * pessoa digita e o app encontra. Aceita três formas de escrever:
 *
 *   - o nome, com ou sem acento — "jose" encontra "José";
 *   - um pedaço do meio — "taciane" encontra "Maria Taciane Pereira Barbosa";
 *   - as iniciais — "rm" ou "ram" encontram "Rafaela Alves Mendes".
 *
 * Módulo puro e sem dependências de React, para poder ser testado.
 */
import { normalize } from './geocode';

export interface Searchable {
  slackId: string;
  name: string;
}

/** Palavras que não viram inicial: "José dos Santos" é JS, não JDS. */
const CONNECTIVES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di']);

function significantWords(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter((word) => word.length > 0 && !CONNECTIVES.has(word));
}

/** Iniciais de todas as palavras: "Rafaela Alves Mendes" -> "ram". */
export function wordInitials(name: string): string {
  return significantWords(name)
    .map((word) => word[0])
    .join('');
}

/** Primeira e última inicial — as mesmas que o avatar mostra: "rm". */
export function shortInitials(name: string): string {
  const words = significantWords(name);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[words.length - 1][0];
}

/** `needle` aparece em `haystack` na ordem, sem precisar ser contíguo? */
function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return needle.length === 0;
}

/** Menor é melhor. `null` quando não casa. */
function rank(name: string, query: string): number | null {
  const haystack = normalize(name);

  if (haystack.startsWith(query)) return 0;

  const words = haystack.split(/\s+/);
  if (words.some((word) => word.startsWith(query))) return 10;

  // Iniciais só para consultas curtas de letras — "ana" é um nome, não iniciais.
  const looksLikeInitials = query.length >= 2 && query.length <= 4 && /^[a-z]+$/.test(query);
  if (looksLikeInitials) {
    if (shortInitials(name) === query) return 20;
    const all = wordInitials(name);
    if (all.startsWith(query)) return 21;
    if (isSubsequence(query, all)) return 22;
  }

  if (haystack.includes(query)) return 30;

  return null;
}

/**
 * Filtra e ordena as pessoas para a consulta.
 * Consulta vazia devolve lista vazia de propósito: quem manda o que aparece na
 * tela é quem digita.
 */
export function searchPeople<T extends Searchable>(people: readonly T[], query: string): T[] {
  const needle = normalize(query);
  if (needle.length < 2) return [];

  return people
    .map((person) => {
      const score = rank(person.name, needle);
      return score === null ? null : { person, score };
    })
    .filter((entry): entry is { person: T; score: number } => entry !== null)
    .sort(
      (a, b) => a.score - b.score || a.person.name.localeCompare(b.person.name, 'pt-BR')
    )
    .map((entry) => entry.person);
}
