/**
 * Disponibilidade — a lógica pura vive em `@/shared/availability` (o backend
 * reusa a mesma função para revalidar na hora de aprovar). Aqui ficam apenas os
 * derivados de interface: o texto do badge do catálogo e a redação das mensagens
 * de conflito em português.
 */
import {
  availabilityOn,
  nextReturnAfter,
  type Conflict,
  type DayAvailability,
  type Holder,
  type OccupancyIndex,
  type StockItemRef,
} from '@/shared/availability';
import { formatDayBR, formatRangeBR } from '@/shared/dates';
import type { DayString } from '@/shared/types';

export * from '@/shared/availability';

export type BadgeTone = 'available' | 'tight' | 'busy' | 'pending';

export interface ItemBadge {
  tone: BadgeTone;
  label: string;
  /** Texto completo para leitores de tela e para o `title`. */
  detail: string;
}

/**
 * Texto do badge de um item no catálogo (seção 8.2).
 *
 * Ordem de prioridade: esgotado no dia > pouco disponível > pré-reserva
 * pendente > disponível.
 */
export function describeItemStatus(
  item: StockItemRef,
  index: OccupancyIndex,
  day: DayString
): { badge: ItemBadge; snapshot: DayAvailability } {
  const snapshot = availabilityOn(item, index, day);
  const { available, total, pending } = snapshot;

  if (total === 0) {
    return {
      snapshot,
      badge: {
        tone: 'busy',
        label: 'Sem unidades',
        detail: 'Nenhuma unidade cadastrada para este item.',
      },
    };
  }

  if (available <= 0) {
    const holder = nextReturnAfter(item.id, index, day);
    const label = holder
      ? `Em uso até ${formatDayBR(holder.endDate)}${holder.city ? ` (${holder.city})` : ''}`
      : 'Em uso hoje';
    return {
      snapshot,
      badge: {
        tone: 'busy',
        label,
        detail: holder
          ? `Todas as ${total} unidades estão comprometidas. A próxima volta é ${formatDayBR(
              holder.endDate
            )}, com ${holder.requesterName}${holder.city ? `, em ${holder.city}` : ''}.`
          : `Todas as ${total} unidades estão comprometidas hoje.`,
      },
    };
  }

  if (pending > 0 && available - pending <= 0) {
    return {
      snapshot,
      badge: {
        tone: 'pending',
        label: 'Pré-reservado',
        detail: `${available} de ${total} livres hoje, mas há ${pending} unidade(s) em requisições pendentes que ainda podem ser aprovadas.`,
      },
    };
  }

  if (available < total) {
    return {
      snapshot,
      badge: {
        tone: 'tight',
        label: `${available} de ${total} livres`,
        detail: `${available} de ${total} unidades livres hoje.`,
      },
    };
  }

  return {
    snapshot,
    badge: {
      tone: 'available',
      label: 'Disponível',
      detail: total === 1 ? 'A única unidade está livre hoje.' : `Todas as ${total} unidades livres hoje.`,
    },
  };
}

/** `Rafaela, em Penedo/AL, até 12/09/2026`. */
export function describeHolder(holder: Holder): string {
  const place = holder.city ? `, em ${holder.city}` : '';
  const quantity = holder.quantity > 1 ? ` (${holder.quantity} un.)` : '';
  return `${holder.requesterName}${place}, até ${formatDayBR(holder.endDate)}${quantity}`;
}

/**
 * Frase de conflito para o calendário e os avisos.
 * Ex.: "Tenda 3x3 indisponível em 09/09/2026 — com Rafaela, em Penedo/AL".
 */
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
    conflict.holders.length > 0
      ? ` — com ${listToPtBR(conflict.holders.map(describeHolder))}`
      : '';

  return `${conflict.itemName} indisponível em ${period}${who}.`;
}

/** `a`, `a e b`, `a, b e c`. */
export function listToPtBR(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`;
}

/** Resumo curto de conflitos, usado no cabeçalho do passo de revisão. */
export function summarizeConflicts(blocking: Conflict[], warnings: Conflict[]): string {
  if (blocking.length > 0) {
    return blocking.length === 1
      ? '1 item indisponível no período escolhido'
      : `${blocking.length} itens indisponíveis no período escolhido`;
  }
  if (warnings.length > 0) {
    return warnings.length === 1
      ? '1 item com pré-reserva concorrente'
      : `${warnings.length} itens com pré-reserva concorrente`;
  }
  return 'Tudo livre no período';
}
