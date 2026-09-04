/**
 * Formatacao de datas em pt-BR para a interface.
 *
 * A aritmetica de dias vive em `@/shared/dates` (pura, compartilhada com o
 * backend). Aqui ficam apenas os rotulos legiveis, com `date-fns` + locale.
 */
import { format, formatDistanceToNowStrict, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { APP_TIME_ZONE, type DayString, type TimestampLike } from '@/shared/types';
import { today } from '@/shared/dates';

export {
  addDays,
  compareDays,
  daysBetweenInclusive,
  dayKeyInTimeZone,
  eachDay,
  formatDayBR,
  formatDayCount,
  formatDayShortBR,
  formatRangeBR,
  isValidDay,
  isWithin,
  today,
  toDayString,
} from '@/shared/dates';

/**
 * Ponte entre o mundo de dias (`YYYY-MM-DD`) e os `Date` que o `date-fns` e o
 * `react-day-picker` esperam.
 *
 * O `parseDay` compartilhado devolve meia-noite **UTC**, o que é o certo para
 * aritmética determinística — mas errado para exibir: no Brasil (UTC−3), a
 * meia-noite UTC de 04/09 é 21h de 03/09 no horário local, e o calendário
 * mostraria o dia anterior. Por isso a interface converte para meia-noite
 * **local**.
 */
export function toLocalDate(day: DayString): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1);
}

/** Caminho inverso: um `Date` local vira `YYYY-MM-DD`. */
export function fromLocalDate(date: Date): DayString {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `2026-09-04` -> `quinta-feira, 4 de setembro`. */
export function formatDayLong(day: DayString): string {
  return format(toLocalDate(day), "EEEE, d 'de' MMMM", { locale: ptBR });
}

/** `2026-09-04` -> `qui, 4 set`. */
export function formatDayMedium(day: DayString): string {
  return format(toLocalDate(day), 'EEE, d MMM', { locale: ptBR });
}

/** `2026-09-04` -> `4 de setembro de 2026` (omite o ano quando e o ano atual). */
export function formatDayFriendly(day: DayString): string {
  const date = toLocalDate(day);
  return isThisYear(date)
    ? format(date, "d 'de' MMMM", { locale: ptBR })
    : format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** `setembro de 2026` — cabecalho do calendario. */
export function formatMonthTitle(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Converte um Timestamp do Firestore (ou nulo) em `Date`. */
export function toDate(value: TimestampLike | null | undefined): Date | null {
  if (!value) return null;
  try {
    return value.toDate();
  } catch {
    return null;
  }
}

/** `há 5 minutos`, `há 2 dias`. Vazio quando nao ha data. */
export function formatRelative(value: TimestampLike | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return `há ${formatDistanceToNowStrict(date, { locale: ptBR })}`;
}

/** `04/09/2026 14:32` no fuso do app. */
export function formatInstant(value: TimestampLike | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** `14:32` no fuso do app. */
export function formatClock(value: TimestampLike | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Saudacao pela hora local de Maceio. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).format(now)
  );

  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** `Hoje`, `Amanhã`, `Ontem` ou a data curta. */
export function formatDayRelativeLabel(day: DayString): string {
  const reference = today();
  if (day === reference) return 'Hoje';

  const oneDay = 86_400_000;
  const delta = Math.round(
    (toLocalDate(day).getTime() - toLocalDate(reference).getTime()) / oneDay
  );

  if (delta === 1) return 'Amanhã';
  if (delta === -1) return 'Ontem';
  if (delta > 1 && delta < 7) return format(toLocalDate(day), 'EEEE', { locale: ptBR });

  return formatDayFriendly(day);
}
