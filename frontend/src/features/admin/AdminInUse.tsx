import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarRange, MapPin, PackageCheck, RotateCcw } from 'lucide-react';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Pill } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';
import { ApiError, api } from '@/lib/api';
import { formatRangeBR, today } from '@/lib/dates';
import { cityLabel } from '@/lib/geocode';
import { compareDays, daysBetweenInclusive } from '@/shared/dates';
import type { MarketingRequest } from '@/shared/types';
import { formatTicketNumber } from '@/features/tickets/RequestCard';

export interface AdminInUseProps {
  requests: MarketingRequest[];
}

/**
 * Aba "Em uso" (seção 8.6).
 *
 * Aprovadas que ainda não voltaram. Marcar a devolução libera a
 * disponibilidade a partir do dia de hoje — é o que destrava o item para outra
 * pessoa quando a ação acaba antes do previsto.
 */
export function AdminInUse({ requests }: AdminInUseProps) {
  const [pending, setPending] = useState<string | null>(null);
  const day = today();

  const markReturned = async (request: MarketingRequest) => {
    setPending(request.id);
    try {
      await api.markReturned(request.id);
      toast.success(`${formatTicketNumber(request.number)} devolvida`, {
        description: 'Os itens já aparecem livres para todo mundo.',
      });
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Não consegui marcar a devolução.');
    } finally {
      setPending(null);
    }
  };

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
        title="Nada em uso"
        description="Nenhuma requisição aprovada em andamento no momento."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => {
        const overdue = compareDays(request.endDate, day) < 0;
        const active = compareDays(request.startDate, day) <= 0 && !overdue;
        const daysLate = overdue ? daysBetweenInclusive(request.endDate, day) - 1 : 0;

        return (
          <li
            key={request.id}
            className={cn('glass p-4', overdue && '!border-status-rejected/45')}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={request.requesterName} size="md" />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/requisicoes/${request.id}`}
                    className="tabular text-sm font-semibold text-gold-300 underline-offset-4 hover:underline"
                  >
                    {formatTicketNumber(request.number)}
                  </Link>
                  <span className="truncate text-sm text-ivory">{request.requesterName}</span>

                  {overdue ? (
                    <Pill tone="danger" className="!px-2 !py-0.5 !text-2xs">
                      {daysLate === 0 ? 'Venceu hoje' : `${daysLate} dia(s) atrasada`}
                    </Pill>
                  ) : active ? (
                    <Pill tone="gold" className="!px-2 !py-0.5 !text-2xs">
                      Em campo agora
                    </Pill>
                  ) : null}
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {cityLabel(request.city)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                    <span className="tabular">
                      {formatRangeBR(request.startDate, request.endDate)}
                    </span>
                  </span>
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {request.items.map((line) => (
                    <span
                      key={line.itemId}
                      className="inline-flex items-center gap-1 rounded-full border border-onyx-700 bg-onyx-800/70 px-2 py-0.5 text-2xs text-muted"
                    >
                      <ItemIcon name={line.icon} className="h-3 w-3" />
                      <span className="tabular">{line.quantity}×</span>
                      {line.itemName}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => markReturned(request)}
                loading={pending === request.id}
                icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              >
                Devolvido
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
