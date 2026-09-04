/**
 * Aritmetica de datas com granularidade de dia (`YYYY-MM-DD`).
 *
 * Todo o dominio do app raciocina em dias, nunca em instantes: um item fica
 * reservado "de 09/09 ate 11/09", sem horario. Trabalhar com strings elimina a
 * classe inteira de bugs de fuso horario — a unica conversao instante -> dia
 * acontece em `dayKeyInTimeZone`, sempre no fuso `America/Maceio`.
 *
 * Modulo puro e sem dependencias: roda igual no navegador e no Node.
 */
import { APP_TIME_ZONE, type DayString } from './types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Teto de seguranca para as iteracoes de intervalo (~5 anos). */
const MAX_RANGE_DAYS = 2000;

export function isValidDay(value: unknown): value is DayString {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const date = parseDay(value);
  // Rejeita datas impossiveis como 2026-02-31, que o Date normalizaria.
  return !Number.isNaN(date.getTime()) && toDayString(date) === value;
}

/** Converte `YYYY-MM-DD` em um `Date` fixado a meia-noite UTC (base do calculo). */
export function parseDay(day: DayString): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, date ?? 1));
}

/** Converte um `Date` baseado em UTC de volta para `YYYY-MM-DD`. */
export function toDayString(date: Date): DayString {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Dia do calendario de um instante, no fuso informado.
 * Unica ponte entre `Date`/`Timestamp` e o mundo de dias do app.
 */
export function dayKeyInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): DayString {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hoje em `America/Maceio`. */
export function today(timeZone: string = APP_TIME_ZONE): DayString {
  return dayKeyInTimeZone(new Date(), timeZone);
}

export function addDays(day: DayString, amount: number): DayString {
  return toDayString(new Date(parseDay(day).getTime() + amount * MS_PER_DAY));
}

/** -1, 0 ou 1 — comparacao lexicografica, que para `YYYY-MM-DD` e cronologica. */
export function compareDays(a: DayString, b: DayString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDay(a: DayString, b: DayString): DayString {
  return a <= b ? a : b;
}

export function maxDay(a: DayString, b: DayString): DayString {
  return a >= b ? a : b;
}

/** Numero de dias do intervalo, inclusivo nas duas pontas (09/09..11/09 = 3). */
export function daysBetweenInclusive(start: DayString, end: DayString): number {
  const diff = (parseDay(end).getTime() - parseDay(start).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.round(diff) + 1);
}

/** Lista todos os dias de `start` a `end`, inclusivo. Vazio se a ordem estiver invertida. */
export function eachDay(start: DayString, end: DayString): DayString[] {
  if (compareDays(start, end) > 0) return [];
  const days: DayString[] = [];
  let cursor = start;
  for (let guard = 0; guard < MAX_RANGE_DAYS; guard += 1) {
    days.push(cursor);
    if (cursor === end) return days;
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Intervalos inclusivos se sobrepoem? */
export function rangesOverlap(
  aStart: DayString,
  aEnd: DayString,
  bStart: DayString,
  bEnd: DayString
): boolean {
  return compareDays(aStart, bEnd) <= 0 && compareDays(bStart, aEnd) <= 0;
}

export function isWithin(day: DayString, start: DayString, end: DayString): boolean {
  return compareDays(day, start) >= 0 && compareDays(day, end) <= 0;
}

// ---------------------------------------------------------------------------
// Formatacao pt-BR (pura, para o backend nao precisar de date-fns)
// ---------------------------------------------------------------------------

/** `2026-09-04` -> `04/09/2026`. */
export function formatDayBR(day: DayString): string {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

/** `2026-09-04` -> `04/09`. */
export function formatDayShortBR(day: DayString): string {
  const [, month, date] = day.split('-');
  return `${date}/${month}`;
}

/** Um periodo legivel: `04/09/2026` ou `04/09/2026 a 06/09/2026`. */
export function formatRangeBR(start: DayString, end: DayString): string {
  return start === end ? formatDayBR(start) : `${formatDayBR(start)} a ${formatDayBR(end)}`;
}

/** `3 dias` / `1 dia`. */
export function formatDayCount(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

/** Instante formatado em pt-BR no fuso do app: `04/09/2026 14:32`. */
export function formatInstantBR(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** Apenas o horario: `14:32`. */
export function formatTimeBR(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
