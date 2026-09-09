import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
// `Map` do lucide vira `MapIcon`: sem o apelido ele sombreia o Map nativo do
// JavaScript, que esta logo abaixo em `new Map()`.
import { CalendarDays, ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Rows3 } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { GlassCard, PageHeader } from '@/components/ui/Surface';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, SkeletonCard } from '@/components/ui/Feedback';
import { Drawer } from '@/components/ui/Overlay';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { STATUS_META } from '@/components/ui/StatusChip';
import Cubes from '@/components/reactbits/Cubes/Cubes';
import { LazyActivationsMap } from '@/components/map/LazyActivationsMap';
import type { ActivationPin } from '@/components/map/ActivationsMap';
import { useAppData } from '@/data/AppDataProvider';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { cityLabel } from '@/lib/geocode';
import {
  formatDayLong,
  formatMonthTitle,
  formatRangeBR,
  fromLocalDate,
  toLocalDate,
  today,
} from '@/lib/dates';
import { itemSchedule } from '@/shared/availability';
import { compareDays, daysBetweenInclusive, eachDay, isWithin } from '@/shared/dates';
import type { DayString, MarketingRequest } from '@/shared/types';

type View = 'mes' | 'itens' | 'mapa';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Agenda (`/agenda`) — seção 8.5.
 *
 * Duas leituras do mesmo dado: o mês (para achar uma data livre) e a linha do
 * tempo por item (para ver quem está com o quê). Aberta a todo mundo: a ideia é
 * que a pessoa consulte antes de pedir.
 */
export default function AgendaPage() {
  const { occupancyRequests, activeItems, occupancy, ready } = useAppData();
  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState(() => startOfMonth(toLocalDate(today())));
  const [selectedDay, setSelectedDay] = useState<DayString | null>(null);
  const reduced = usePrefersReducedMotion();
  const calendarRef = useRef<HTMLDivElement>(null);

  const day = today();

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = fromLocalDate(startOfWeek(monthStart, { weekStartsOn: 0 }));
  const gridEnd = fromLocalDate(endOfWeek(monthEnd, { weekStartsOn: 0 }));

  const gridDays = useMemo(() => eachDay(gridStart, gridEnd), [gridStart, gridEnd]);

  /** Requisições ativas em cada dia do mês visível. */
  const byDay = useMemo(() => {
    const map = new Map<DayString, MarketingRequest[]>();

    for (const request of occupancyRequests) {
      if (request.status !== 'approved' && request.status !== 'pending') continue;
      if (compareDays(request.endDate, gridStart) < 0) continue;
      if (compareDays(request.startDate, gridEnd) > 0) continue;

      for (const current of eachDay(
        compareDays(request.startDate, gridStart) < 0 ? gridStart : request.startDate,
        compareDays(request.endDate, gridEnd) > 0 ? gridEnd : request.endDate
      )) {
        const list = map.get(current);
        if (list) list.push(request);
        else map.set(current, [request]);
      }
    }

    return map;
  }, [occupancyRequests, gridStart, gridEnd]);

  const monthLabel = formatMonthTitle(cursor);

  const timelineItems = useMemo(
    () =>
      activeItems
        .map((item) => ({
          item,
          bars: itemSchedule(item.id, occupancy, fromLocalDate(monthStart), fromLocalDate(monthEnd)),
        }))
        .filter((entry) => entry.bars.length > 0),
    [activeItems, occupancy, monthStart, monthEnd]
  );

  const totalDaysInMonth = daysBetweenInclusive(fromLocalDate(monthStart), fromLocalDate(monthEnd));

  /**
   * Onde os itens estão. Só as reservas APROVADAS que cobrem hoje: pendente
   * ainda não é posse de ninguém, e mostrar no mapa daria a entender que sim.
   *
   * O título é o item, não o número da requisição — quem abre a agenda quer
   * saber onde está a tenda, não qual foi o pedido.
   */
  const pins = useMemo<ActivationPin[]>(
    () =>
      occupancyRequests
        .filter(
          (request) =>
            request.status === 'approved' &&
            compareDays(request.startDate, day) <= 0 &&
            compareDays(request.endDate, day) >= 0
        )
        .map((request) => ({
          id: request.id,
          lat: request.city.lat,
          lng: request.city.lng,
          title: request.items.map((line) => line.itemName).join(', ') || 'Materiais do Marketing',
          subtitle: `${cityLabel(request.city)} · volta ${formatDayLong(request.endDate)} · com ${request.requesterName}`,
          active: true,
        })),
    [occupancyRequests, day]
  );

  const selectedRequests = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planeje antes de pedir"
        title="Agenda"
        description="Onde cada item está e quando volta. Use para escolher uma data livre antes de abrir a requisição."
      />

      <div className="flex flex-wrap items-center gap-3">
        <ChipRow className="flex-none">
          <Chip selected={view === 'mes'} onClick={() => setView('mes')} icon={<CalendarDays className="h-4 w-4" />}>
            Mês
          </Chip>
          <Chip selected={view === 'itens'} onClick={() => setView('itens')} icon={<Rows3 className="h-4 w-4" />}>
            Por item
          </Chip>
          <Chip selected={view === 'mapa'} onClick={() => setView('mapa')} icon={<MapIcon className="h-4 w-4" />}>
            No mapa
          </Chip>
        </ChipRow>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setCursor((value) => addMonths(value, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>

          <span className="min-w-[10.5rem] text-center font-display text-lg text-ivory">
            {monthLabel}
          </span>

          <Button
            variant="secondary"
            size="icon"
            onClick={() => setCursor((value) => addMonths(value, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="ml-1"
            onClick={() => setCursor(startOfMonth(toLocalDate(day)))}
          >
            Hoje
          </Button>
        </div>
      </div>

      {!ready ? (
        <SkeletonCard className="h-96" />
      ) : view === 'mes' ? (
        <GlassCard className="overflow-hidden p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="py-1 text-center text-2xs font-semibold uppercase tracking-wider text-muted/70"
              >
                {weekday}
              </div>
            ))}
          </div>

          {/*
            Cubos atrás dos dias, não dentro deles: o componente do React Bits
            desenha uma grade inteira, e uma instância por dia seriam 42 cenas.
            Uma só, com gridSize 7, acompanha as sete colunas da semana.

            Eles reagem ao mouse, e só a ele: ficam parados até o ponteiro
            passar por cima, como no componente original.

            Isso exige um arranjo. A camada precisa de `pointer-events-none`,
            senão engole o clique que abre o dia — mas aí ela também nunca vê
            o mouse. Por isso o `pointerTarget` manda os listeners para este
            contêiner, que é quem de fato recebe o ponteiro.

            O `cellGap` de 4px é o mesmo `gap-1` da grade de dias — sem ele o
            componente usa 5%, e cada cubo sai menor que o seu quadrado.
            Mesmas colunas, mesmas linhas, mesmo vão e mesma caixa: um cubo
            por dia, encaixado.

            As células são `bg-onyx-900/40`, então os cubos aparecem através
            delas sem apagar a cor que indica disponibilidade.
          */}
          <div className="relative" ref={calendarRef}>
            {reduced ? null : (
              <div
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-90"
                aria-hidden
              >
                <Cubes
                  className="h-full w-full"
                  stretch
                  gridSize={7}
                  rows={gridDays.length / 7}
                  cellGap={4}
                  maxAngle={55}
                  radius={3}
                  borderStyle="1.5px solid rgba(226, 185, 111, 0.85)"
                  faceColor="#14121A"
                  shadow={false}
                  autoAnimate={false}
                  rippleOnClick={false}
                  pointerTarget={calendarRef}
                />
              </div>
            )}

            <div className="relative z-10 grid grid-cols-7 gap-1">
            {gridDays.map((current) => {
              const inMonth = current.slice(0, 7) === fromLocalDate(monthStart).slice(0, 7);
              const requests = byDay.get(current) ?? [];
              const approved = requests.filter((request) => request.status === 'approved').length;
              const pending = requests.length - approved;
              const isToday = current === day;

              return (
                <button
                  key={current}
                  type="button"
                  onClick={() => requests.length > 0 && setSelectedDay(current)}
                  disabled={requests.length === 0}
                  className={cn(
                    'flex min-h-[4.25rem] flex-col rounded-xl border p-1.5 text-left transition-colors sm:min-h-[5.5rem]',
                    inMonth ? 'border-onyx-700/70 bg-onyx-900/40' : 'border-transparent opacity-35',
                    requests.length > 0 && 'hover:border-gold-500/40 hover:bg-onyx-800/60',
                    requests.length === 0 && 'cursor-default',
                    isToday && '!border-gold-500/60 bg-gold-500/8'
                  )}
                  aria-label={`${formatDayLong(current)}: ${requests.length} ação(ões)`}
                >
                  <span
                    className={cn(
                      'tabular text-xs font-medium',
                      isToday ? 'text-gold-300' : inMonth ? 'text-ivory/80' : 'text-muted'
                    )}
                  >
                    {Number(current.slice(8, 10))}
                  </span>

                  <span className="mt-1 flex flex-1 flex-wrap content-start gap-1">
                    {requests.slice(0, 3).map((request) => (
                      <span
                        key={request.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          request.status === 'approved' ? 'bg-status-approved' : 'bg-gold-400'
                        )}
                        aria-hidden
                      />
                    ))}
                  </span>

                  {requests.length > 0 ? (
                    <span className="tabular text-2xs text-muted">
                      {approved > 0 ? `${approved} ativa${approved > 1 ? 's' : ''}` : null}
                      {approved > 0 && pending > 0 ? ' · ' : null}
                      {pending > 0 ? `${pending} pend.` : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-2xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-approved" aria-hidden />
              Aprovada (bloqueia o item)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
              Pendente (pré-reserva)
            </span>
          </div>
        </GlassCard>
      ) : view === 'mapa' ? (
        <GlassCard className="overflow-hidden p-0">
          {/*
            O mapa aparece SEMPRE, mesmo sem nenhum pino.

            Antes, sem material em campo, ele dava lugar a um aviso de texto — e
            numa aba chamada "No mapa" isso lê como funcionalidade quebrada. O
            mapa vazio, enquadrado em Alagoas, já responde a pergunta ("nada em
            campo") sem parecer erro; a legenda embaixo explica o resto.

            A altura vai no `className`, que o componente aplica no próprio
            MapContainer. Numa div externa o mapa nasce sem altura e o Leaflet
            desenha os tiles fora da área visível.
          */}
          <LazyActivationsMap pins={pins} className="h-[26rem] w-full sm:h-[32rem]" />
          <p className="border-t border-gold-500/15 px-4 py-3 text-2xs leading-relaxed text-muted">
            {pins.length === 0
              ? 'Nenhum material em campo hoje. Quando uma reserva aprovada começar, o item aparece aqui com a cidade onde está e a data em que volta.'
              : `${pins.length === 1 ? '1 material' : `${pins.length} materiais`} em campo agora. Só aparecem reservas já aprovadas e em curso — pré-reservas pendentes ainda não ocupam o item.`}
          </p>
        </GlassCard>
      ) : timelineItems.length === 0 ? (
        <EmptyState
          icon={<Rows3 className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
          title={`Nenhuma reserva em ${monthLabel.toLowerCase()}`}
          description="Todos os itens estão livres neste mês."
        />
      ) : (
        <div className="space-y-3">
          {timelineItems.map(({ item, bars }) => (
            <GlassCard key={item.id} className="p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/6 text-gold-300">
                  <ItemIcon name={item.icon} emoji={item.emoji} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ivory">
                  {item.name}
                </span>
                <span className="tabular shrink-0 text-2xs text-muted">{item.quantity} un.</span>
              </div>

              {/* Régua de dias do mês */}
              <div
                className="relative space-y-1.5 overflow-x-auto"
                role="img"
                aria-label={`Ocupação de ${item.name} em ${monthLabel}`}
              >
                {bars.map((bar) => {
                  const startOffset =
                    daysBetweenInclusive(fromLocalDate(monthStart), bar.visibleStart) - 1;
                  const span = daysBetweenInclusive(bar.visibleStart, bar.visibleEnd);
                  const meta = STATUS_META[bar.status];

                  return (
                    <div
                      key={`${bar.requestId}-${bar.start}`}
                      className="grid gap-px"
                      style={{ gridTemplateColumns: `repeat(${totalDaysInMonth}, minmax(4px, 1fr))` }}
                    >
                      <Link
                        to={`/requisicoes/${bar.requestId}`}
                        className={cn(
                          'flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-1.5 transition-all hover:brightness-125',
                          bar.status === 'approved'
                            ? 'border-status-approved/40 bg-status-approved/15'
                            : 'border-gold-500/45 bg-gold-500/12 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(206,161,92,0.18)_4px,rgba(206,161,92,0.18)_8px)]'
                        )}
                        style={{ gridColumn: `${startOffset + 1} / span ${span}` }}
                        title={`${bar.requesterName} — ${formatRangeBR(bar.start, bar.end)}${
                          bar.city ? ` · ${bar.city}` : ''
                        } (${meta.label})`}
                      >
                        <Avatar name={bar.requesterName} size="xs" className="!h-5 !w-5 shrink-0" />
                        <span className="truncate text-2xs text-ivory/90">
                          {bar.requesterName.split(' ')[0]}
                          {bar.city ? ` · ${bar.city}` : ''}
                        </span>
                      </Link>
                    </div>
                  );
                })}

                {/* Marcador do dia de hoje */}
                {isWithin(day, fromLocalDate(monthStart), fromLocalDate(monthEnd)) ? (
                  <div
                    className="grid gap-px"
                    style={{ gridTemplateColumns: `repeat(${totalDaysInMonth}, minmax(4px, 1fr))` }}
                    aria-hidden
                  >
                    <div
                      className="h-1 rounded-full bg-gold-400/70"
                      style={{
                        gridColumn: `${daysBetweenInclusive(fromLocalDate(monthStart), day)} / span 1`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detalhe de um dia do mês */}
      <Drawer
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatDayLong(selectedDay) : ''}
        description={`${selectedRequests.length} ação(ões) neste dia`}
      >
        <motion.ul className="space-y-2.5">
          {selectedRequests.map((request) => {
            const meta = STATUS_META[request.status];
            return (
              <li key={request.id}>
                <Link
                  to={`/requisicoes/${request.id}`}
                  onClick={() => setSelectedDay(null)}
                  className="flex items-start gap-3 rounded-2xl border border-onyx-700 bg-onyx-900/50 p-3.5 transition-colors hover:border-gold-500/35"
                >
                  <Avatar name={request.requesterName} size="sm" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ivory">
                      <span className="tabular text-muted">
                        #{String(request.number).padStart(4, '0')}
                      </span>{' '}
                      {request.requesterName}
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {request.city.name}
                        {request.city.state ? `/${request.city.state}` : ''}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="tabular">
                        {formatRangeBR(request.startDate, request.endDate)}
                      </span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {request.items.map((line) => (
                        <span
                          key={line.itemId}
                          className="inline-flex items-center gap-1 rounded-full border border-onyx-700 bg-onyx-800/70 px-2 py-0.5 text-2xs text-muted"
                        >
                          <ItemIcon name={line.icon} className="h-3 w-3" />
                          {line.quantity}× {line.itemName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <span className={cn('shrink-0 text-2xs font-medium', meta.text)}>{meta.label}</span>
                </Link>
              </li>
            );
          })}
        </motion.ul>
      </Drawer>
    </div>
  );
}
