import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, MapPin, Package, Warehouse } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { AvailabilityRing } from '@/components/ui/AvailabilityRing';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { DataLabel, Rule } from '@/components/ui/Surface';
import { Pill, STATUS_META } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/Feedback';
import { describeItemStatus } from '@/lib/availability';
import { formatDayFriendly, formatRangeBR } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { itemSchedule, type OccupancyIndex } from '@/shared/availability';
import { addDays } from '@/shared/dates';
import type { DayString, Item } from '@/shared/types';
import { useWizardStore } from '@/store/wizard';

export interface ItemDrawerProps {
  item: Item | null;
  occupancy: OccupancyIndex;
  today: DayString;
  onClose: () => void;
}

/** Quantos dias da agenda do item mostrar no drawer. */
const SCHEDULE_HORIZON_DAYS = 90;

/**
 * Detalhes do item: características, onde fica guardado e — o que realmente
 * importa — a agenda: quem está com ele, em qual cidade e até quando.
 */
export function ItemDrawer({ item, occupancy, today, onClose }: ItemDrawerProps) {
  const navigate = useNavigate();
  const setQuantity = useWizardStore((state) => state.setQuantity);

  const status = useMemo(
    () =>
      item
        ? describeItemStatus({ id: item.id, name: item.name, quantity: item.quantity }, occupancy, today)
        : null,
    [item, occupancy, today]
  );

  const schedule = useMemo(
    () =>
      item ? itemSchedule(item.id, occupancy, today, addDays(today, SCHEDULE_HORIZON_DAYS)) : [],
    [item, occupancy, today]
  );

  const requestThis = () => {
    if (!item) return;
    setQuantity(item.id, 1);
    onClose();
    navigate('/nova');
  };

  return (
    <Drawer
      open={Boolean(item)}
      onClose={onClose}
      title={item?.name}
      description={item?.category}
      footer={
        <Button className="w-full" spark onClick={requestThis} icon={<CalendarPlus className="h-4 w-4" />}>
          Requisitar este item
        </Button>
      }
    >
      {item && status ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-2xl border border-gold-500/18 bg-onyx-800/40 p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-300">
              <ItemIcon name={item.icon} emoji={item.emoji} className="h-7 w-7" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-ivory">{status.badge.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{status.badge.detail}</p>
            </div>

            <AvailabilityRing
              available={status.snapshot.available}
              total={status.snapshot.total}
              pending={status.snapshot.pending}
              size={54}
            />
          </div>

          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="max-h-52 w-full rounded-2xl border border-gold-500/15 object-cover"
              loading="lazy"
            />
          ) : null}

          {item.description ? (
            <p className="text-sm leading-relaxed text-muted">{item.description}</p>
          ) : null}

          {item.attributes.length > 0 ? (
            <section>
              <DataLabel className="mb-2">Características</DataLabel>
              <dl className="divide-y divide-onyx-700/70 overflow-hidden rounded-2xl border border-gold-500/15">
                {item.attributes.map((attribute) => (
                  <div
                    key={`${attribute.label}-${attribute.value}`}
                    className="flex items-baseline justify-between gap-4 bg-onyx-900/40 px-3.5 py-2.5"
                  >
                    <dt className="text-xs text-muted">{attribute.label}</dt>
                    <dd className="text-right text-sm text-ivory">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Pill>
              <Package className="h-3.5 w-3.5" aria-hidden />
              {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
            </Pill>
            {item.storageLocation ? (
              <Pill>
                <Warehouse className="h-3.5 w-3.5" aria-hidden />
                {item.storageLocation}
              </Pill>
            ) : null}
            {item.tags.map((tag) => (
              <Pill key={tag}>#{tag}</Pill>
            ))}
          </div>

          <Rule />

          <section>
            <DataLabel className="mb-3">Agenda dos próximos 90 dias</DataLabel>

            {schedule.length === 0 ? (
              <EmptyState
                className="!py-8"
                icon={<CalendarPlus className="h-6 w-6" strokeWidth={1.2} aria-hidden />}
                title="Livre por enquanto"
                description="Ninguém reservou este item para os próximos três meses."
              />
            ) : (
              <ul className="space-y-2">
                {schedule.map((bar) => {
                  const meta = STATUS_META[bar.status];
                  return (
                    <li
                      key={`${bar.requestId}-${bar.start}`}
                      className="flex items-center gap-3 rounded-2xl border border-onyx-700 bg-onyx-900/50 px-3.5 py-3"
                    >
                      <Avatar name={bar.requesterName} size="sm" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ivory">{bar.requesterName}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <span className="tabular">{formatRangeBR(bar.start, bar.end)}</span>
                          {bar.city ? (
                            <>
                              <span aria-hidden>·</span>
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="truncate">{bar.city}</span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      <span className="shrink-0 text-right">
                        <span className={cn('block text-2xs font-medium', meta.text)}>
                          {bar.status === 'pending' ? 'Pré-reserva' : meta.label}
                        </span>
                        <span className="tabular block text-2xs text-muted">
                          {bar.quantity} un.
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-3 text-2xs leading-relaxed text-muted/80">
              Pré-reservas são requisições ainda pendentes: elas não travam o item, mas podem virar
              reserva se a Suzana aprovar. A partir de {formatDayFriendly(today)}.
            </p>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
