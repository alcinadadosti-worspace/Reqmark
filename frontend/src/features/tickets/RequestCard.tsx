import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CalendarRange, MapPin } from 'lucide-react';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { Avatar } from '@/components/ui/Avatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';
import { formatDayCount, formatRangeBR, formatRelative } from '@/lib/dates';
import { staggerItem } from '@/lib/motion';
import type { MarketingRequest } from '@/shared/types';

export interface RequestCardProps {
  request: MarketingRequest;
  /** De qual lado o contador de não lidas é lido. */
  side: 'admin' | 'requester';
  /** Mostra o avatar de quem pediu — útil só na visão da administradora. */
  showRequester?: boolean;
  className?: string;
}

export function formatTicketNumber(value: number): string {
  return `#${String(value).padStart(4, '0')}`;
}

/** Cartão de requisição, usado na lista do solicitante e na fila do admin. */
export function RequestCard({ request, side, showRequester, className }: RequestCardProps) {
  const unread = request.unread?.[side] ?? 0;

  return (
    <motion.li variants={staggerItem}>
      <Link
        to={`/requisicoes/${request.id}`}
        className={cn(
          'glass block p-4 transition-all duration-300 ease-brand',
          'hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-glass-lg',
          unread > 0 && '!border-gold-500/45',
          className
        )}
      >
        <div className="flex items-start gap-3">
          {showRequester ? <Avatar name={request.requesterName} size="sm" className="mt-0.5" /> : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tabular text-sm font-semibold text-gold-300">
                {formatTicketNumber(request.number)}
              </span>

              {showRequester ? (
                <span className="min-w-0 truncate text-sm text-ivory">{request.requesterName}</span>
              ) : (
                <span className="truncate text-sm text-ivory">{request.purposeType}</span>
              )}

              {unread > 0 ? (
                <span className="tabular ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-[0.65rem] font-bold text-onyx-950">
                  {unread}
                </span>
              ) : null}
            </div>

            <p className="clamp-2 mt-1 text-xs leading-relaxed text-muted">{request.purpose}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {request.city.name}
                  {request.city.state ? `/${request.city.state}` : ''}
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="tabular">{formatRangeBR(request.startDate, request.endDate)}</span>
                <span className="text-muted/70">· {formatDayCount(request.days)}</span>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {request.items.slice(0, 4).map((line) => (
                <span
                  key={line.itemId}
                  className="inline-flex items-center gap-1 rounded-full border border-onyx-700 bg-onyx-800/70 px-2 py-0.5 text-2xs text-muted"
                  title={`${line.quantity}× ${line.itemName}`}
                >
                  <ItemIcon name={line.icon} className="h-3 w-3" />
                  <span className="tabular">{line.quantity}×</span>
                  <span className="max-w-[7rem] truncate">{line.itemName}</span>
                </span>
              ))}
              {request.items.length > 4 ? (
                <span className="text-2xs text-muted">+{request.items.length - 4}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-onyx-700/60 pt-3">
          <StatusChip status={request.status} size="sm" />
          <span className="shrink-0 text-2xs text-muted/80">{formatRelative(request.createdAt)}</span>
        </div>
      </Link>
    </motion.li>
  );
}
