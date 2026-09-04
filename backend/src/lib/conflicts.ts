/**
 * Redação em português dos conflitos, para o Slack.
 *
 * A lógica de detecção é a MESMA do frontend (`shared/availability.ts`) — aqui
 * só transformamos o resultado em frase. Manter os textos separados do motor
 * garante que a revalidação da aprovação use exatamente o mesmo cálculo que a
 * pessoa viu no calendário.
 */
import { formatDayBR, formatRangeBR } from '../shared/dates';
import { evaluatePeriod, type Conflict, type OccupancyIndex, type StockItemRef } from '../shared/availability';
import type { MarketingRequest } from '../shared/types';

/** `a`, `a e b`, `a, b e c`. */
export function listToPtBR(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`;
}

function describeHolder(holder: Conflict['holders'][number]): string {
  const place = holder.city ? `, em ${holder.city}` : '';
  const quantity = holder.quantity > 1 ? ` (${holder.quantity} un.)` : '';
  return `${holder.requesterName}${place}, até ${formatDayBR(holder.endDate)}${quantity}`;
}

export function describeConflict(conflict: Conflict): string {
  const period =
    conflict.ranges.length === 1
      ? formatRangeBR(conflict.ranges[0].start, conflict.ranges[0].end)
      : conflict.ranges.map((range) => formatRangeBR(range.start, range.end)).join('; ');

  if (conflict.kind === 'pending') {
    const names = conflict.holders.map((holder) => holder.requesterName.split(' ')[0]);
    const who = names.length > 0 ? ` — ${listToPtBR(names)} também pediu` : '';
    return `${conflict.itemName} pode faltar em ${period}${who}.`;
  }

  const who =
    conflict.holders.length > 0 ? ` — com ${listToPtBR(conflict.holders.map(describeHolder))}` : '';
  return `${conflict.itemName} indisponível em ${period}${who}.`;
}

export interface ConflictAnalysis {
  blocking: Conflict[];
  warnings: Conflict[];
  ok: boolean;
}

/**
 * Analisa uma requisição contra o estado atual, ignorando ela mesma.
 * Usada tanto para montar o card do Slack quanto para revalidar na aprovação.
 */
export function analyseRequest(
  request: MarketingRequest,
  index: OccupancyIndex,
  stock: Map<string, StockItemRef>
): ConflictAnalysis {
  const evaluation = evaluatePeriod({
    selection: request.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
    items: stock,
    index,
    startDate: request.startDate,
    endDate: request.endDate,
  });

  return { blocking: evaluation.blocking, warnings: evaluation.warnings, ok: evaluation.ok };
}
