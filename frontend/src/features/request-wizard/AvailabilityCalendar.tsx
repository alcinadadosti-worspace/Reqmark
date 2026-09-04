import { useCallback, useMemo, useRef, useState } from 'react';
import { DayPicker, getDefaultClassNames, type DateRange } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { addDays as addLocalDays, nextSaturday, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { describeConflict, evaluatePeriod, type OccupancyIndex, type SelectionLine, type StockItemRef } from '@/lib/availability';
import { addDays, daysBetweenInclusive } from '@/shared/dates';
import { fromLocalDate, toLocalDate, today } from '@/lib/dates';
import type { DayString } from '@/shared/types';

/** Nenhuma ação do Marketing passa disso — evita seleções acidentais enormes. */
const MAX_RANGE_DAYS = 60;

export interface AvailabilityCalendarProps {
  selection: SelectionLine[];
  items: ReadonlyMap<string, StockItemRef>;
  occupancy: OccupancyIndex;
  startDate: DayString | null;
  endDate: DayString | null;
  onChange: (start: DayString | null, end: DayString | null) => void;
  /** Avisa a tela sobre o conflito para ela mostrar a mensagem. */
  onConflict?: (message: string | null) => void;
}

/**
 * Calendário do passo 4 (seção 8.3).
 *
 * Cada dia é pintado com o estado calculado para os itens e quantidades já
 * escolhidos: livre, pré-reserva pendente (aviso) ou bloqueado (item já
 * aprovado para outra pessoa).
 *
 * Dias bloqueados NÃO ficam desabilitados de propósito: a pessoa pode clicar e
 * receber o motivo ("Tenda 3x3 indisponível em 09/09 — com Rafaela, em
 * Penedo"), o que ensina muito mais do que um dia apagado e mudo.
 */
export function AvailabilityCalendar({
  selection,
  items,
  occupancy,
  startDate,
  endDate,
  onChange,
  onConflict,
}: AvailabilityCalendarProps) {
  const day = today();
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<number>();

  const defaults = getDefaultClassNames();

  const selected = useMemo<DateRange | undefined>(() => {
    if (!startDate) return undefined;
    return { from: toLocalDate(startDate), to: endDate ? toLocalDate(endDate) : undefined };
  }, [startDate, endDate]);

  /** Avalia um único dia, para pintar o calendário. */
  const dayStatus = useCallback(
    (date: Date): 'free' | 'pending' | 'blocked' => {
      const key = fromLocalDate(date);
      const evaluation = evaluatePeriod({
        selection,
        items,
        index: occupancy,
        startDate: key,
        endDate: key,
      });
      return evaluation.byDay.get(key) ?? 'free';
    },
    [selection, items, occupancy]
  );

  const modifiers = useMemo(
    () => ({
      blocked: (date: Date) => dayStatus(date) === 'blocked',
      prereserved: (date: Date) => dayStatus(date) === 'pending',
    }),
    [dayStatus]
  );

  const shake = useCallback(
    (message: string) => {
      onConflict?.(message);
      setShaking(true);
      window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShaking(false), 450);
    },
    [onConflict]
  );

  /** Aplica um período já pronto (usado pelos presets e pela seleção). */
  const commit = useCallback(
    (start: DayString, end: DayString): boolean => {
      if (daysBetweenInclusive(start, end) > MAX_RANGE_DAYS) {
        shake(`O período não pode passar de ${MAX_RANGE_DAYS} dias.`);
        return false;
      }

      const evaluation = evaluatePeriod({
        selection,
        items,
        index: occupancy,
        startDate: start,
        endDate: end,
      });

      if (!evaluation.ok) {
        shake(evaluation.blocking.map(describeConflict).join(' '));
        return false;
      }

      onConflict?.(null);
      onChange(start, end);
      return true;
    },
    [selection, items, occupancy, onChange, onConflict, shake]
  );

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onConflict?.(null);
      onChange(null, null);
      return;
    }

    const from = fromLocalDate(range.from);
    const to = range.to ? fromLocalDate(range.to) : from;
    commit(from, to);
  };

  // --- Presets -------------------------------------------------------------

  const presets = useMemo(() => {
    const localToday = toLocalDate(day);
    const saturday = fromLocalDate(nextSaturday(localToday));
    const nextMonday = fromLocalDate(addLocalDays(startOfWeek(localToday, { weekStartsOn: 1 }), 7));

    return [
      { label: 'Hoje', start: day, end: day },
      { label: 'Este fim de semana', start: saturday, end: addDays(saturday, 1) },
      { label: 'Próxima semana', start: nextMonday, end: addDays(nextMonday, 4) },
    ];
  }, [day]);

  return (
    <div className="space-y-4">
      <ChipRow>
        {presets.map((preset) => (
          <Chip
            key={preset.label}
            selected={startDate === preset.start && endDate === preset.end}
            onClick={() => commit(preset.start, preset.end)}
          >
            {preset.label}
          </Chip>
        ))}
        {startDate ? (
          <Chip
            toggle={false}
            onClick={() => {
              onConflict?.(null);
              onChange(null, null);
            }}
          >
            Limpar
          </Chip>
        ) : null}
      </ChipRow>

      <div
        className={cn(
          'glass overflow-hidden p-2 sm:p-4',
          shaking && 'animate-shake border-status-rejected/50'
        )}
      >
        <DayPicker
          mode="range"
          locale={ptBR}
          selected={selected}
          onSelect={handleSelect}
          month={undefined}
          defaultMonth={startDate ? toLocalDate(startDate) : toLocalDate(day)}
          startMonth={toLocalDate(day)}
          endMonth={toLocalDate(addDays(day, 400))}
          disabled={{ before: toLocalDate(day) }}
          modifiers={modifiers}
          showOutsideDays
          fixedWeeks
          components={{
            Chevron: ({ orientation, ...rest }) =>
              orientation === 'left' ? (
                <ChevronLeft className="h-4 w-4" {...rest} />
              ) : (
                <ChevronRight className="h-4 w-4" {...rest} />
              ),
          }}
          modifiersClassNames={{
            blocked:
              'relative text-status-rejected/80 after:absolute after:bottom-1.5 after:left-1/2 ' +
              'after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-status-rejected',
            prereserved:
              'relative text-gold-300 after:absolute after:bottom-1.5 after:left-1/2 ' +
              'after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-gold-400',
          }}
          classNames={{
            root: cn(defaults.root, 'w-full text-ivory'),
            months: cn(defaults.months, 'w-full'),
            month: cn(defaults.month, 'w-full'),
            month_caption: cn(defaults.month_caption, 'px-1 pb-2'),
            caption_label: cn(defaults.caption_label, 'font-display text-lg capitalize text-ivory'),
            nav: cn(defaults.nav, 'gap-1'),
            button_previous: cn(
              defaults.button_previous,
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/20 ' +
                'text-muted transition-colors hover:border-gold-500/45 hover:text-ivory'
            ),
            button_next: cn(
              defaults.button_next,
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/20 ' +
                'text-muted transition-colors hover:border-gold-500/45 hover:text-ivory'
            ),
            month_grid: cn(defaults.month_grid, 'w-full border-collapse'),
            weekday: cn(
              defaults.weekday,
              'pb-2 text-2xs font-semibold uppercase tracking-wider text-muted/70'
            ),
            day: cn(defaults.day, 'p-0.5'),
            day_button: cn(
              defaults.day_button,
              'relative mx-auto flex items-center justify-center rounded-xl text-sm ' +
                'transition-colors duration-150 hover:bg-onyx-800'
            ),
            today: cn(defaults.today, 'font-semibold text-gold-300'),
            outside: cn(defaults.outside, 'opacity-30'),
            disabled: cn(defaults.disabled, 'opacity-25'),
            selected: cn(defaults.selected, 'text-onyx-950'),
            range_start: cn(
              defaults.range_start,
              '[&_button]:!bg-brand-gradient [&_button]:!font-semibold [&_button]:!text-onyx-950'
            ),
            range_end: cn(
              defaults.range_end,
              '[&_button]:!bg-brand-gradient [&_button]:!font-semibold [&_button]:!text-onyx-950'
            ),
            range_middle: cn(defaults.range_middle, '[&_button]:!bg-gold-500/18 [&_button]:!text-gold-200'),
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-gradient" aria-hidden />
          Selecionado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
          Pré-reserva pendente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-status-rejected" aria-hidden />
          Indisponível
        </span>
      </div>
    </div>
  );
}
