import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CalendarRange } from 'lucide-react';
import CountUp from '@/components/reactbits/CountUp/CountUp';
import { AvailabilityCalendar } from '../AvailabilityCalendar';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { formatDayFriendly } from '@/lib/dates';
import { EASE_BRAND } from '@/lib/motion';
import { daysBetweenInclusive } from '@/shared/dates';
import type { OccupancyIndex, SelectionLine, StockItemRef } from '@/shared/availability';
import type { DayString } from '@/shared/types';

export interface StepPeriodProps {
  selection: SelectionLine[];
  items: ReadonlyMap<string, StockItemRef>;
  occupancy: OccupancyIndex;
  startDate: DayString | null;
  endDate: DayString | null;
  onChange: (start: DayString | null, end: DayString | null) => void;
  conflictMessage: string | null;
  onConflict: (message: string | null) => void;
  showErrors: boolean;
}

/** Passo 4 — Período. */
export function StepPeriod({
  selection,
  items,
  occupancy,
  startDate,
  endDate,
  onChange,
  conflictMessage,
  onConflict,
  showErrors,
}: StepPeriodProps) {
  const reduced = usePrefersReducedMotion();
  const days = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : 0;

  return (
    <div className="space-y-4">
      <AvailabilityCalendar
        selection={selection}
        items={items}
        occupancy={occupancy}
        startDate={startDate}
        endDate={endDate}
        onChange={onChange}
        onConflict={onConflict}
      />

      {/* Mensagem do conflito que acabou de ser recusado */}
      <AnimatePresence>
        {conflictMessage ? (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_BRAND }}
            className="flex items-start gap-3 rounded-2xl border border-status-rejected/35 bg-status-rejected/8 p-3.5"
          >
            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-status-rejected" aria-hidden />
            <p className="text-sm leading-relaxed text-ivory/90">{conflictMessage}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Resumo da seleção */}
      <AnimatePresence initial={false}>
        {startDate && endDate ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: EASE_BRAND }}
            className="flex items-center gap-4 rounded-2xl border border-gold-500/25 bg-gold-500/6 p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
              <CalendarRange className="h-5 w-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-ivory">
                {startDate === endDate
                  ? formatDayFriendly(startDate)
                  : `${formatDayFriendly(startDate)} até ${formatDayFriendly(endDate)}`}
              </p>
              <p className="mt-0.5 text-2xs text-muted">Período da ação</p>
            </div>

            <p className="tabular shrink-0 text-right">
              <span className="font-display text-3xl leading-none text-gold-300">
                {reduced ? days : <CountUp to={days} duration={0.7} />}
              </span>
              <span className="mt-0.5 block text-2xs text-muted">
                {days === 1 ? 'dia' : 'dias'}
              </span>
            </p>
          </motion.div>
        ) : showErrors ? (
          <p className="text-xs text-status-rejected" role="alert">
            Escolha o período da ação — toque no primeiro dia e depois no último.
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
