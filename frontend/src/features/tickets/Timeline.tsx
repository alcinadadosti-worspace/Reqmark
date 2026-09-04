import { Fragment } from 'react';
import FadeContent from '@/components/reactbits/FadeContent/FadeContent';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { formatClock, formatInstant } from '@/lib/dates';
import { STATUS_META } from '@/components/ui/StatusChip';
import { Ban, CheckCircle2, RotateCcw, Send, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RequestEvent, RequestEventType } from '@/shared/types';

const SYSTEM_EVENT: Record<
  Exclude<RequestEventType, 'message'>,
  { icon: LucideIcon; title: string; tone: string }
> = {
  created: { icon: Send, title: 'Requisição enviada', tone: 'text-gold-300 border-gold-500/40' },
  approved: {
    icon: CheckCircle2,
    title: 'Aprovada',
    tone: `${STATUS_META.approved.text} border-status-approved/40`,
  },
  rejected: {
    icon: XCircle,
    title: 'Reprovada',
    tone: `${STATUS_META.rejected.text} border-status-rejected/40`,
  },
  cancelled: {
    icon: Ban,
    title: 'Cancelada pelo solicitante',
    tone: `${STATUS_META.cancelled.text} border-status-cancelled/40`,
  },
  returned: {
    icon: RotateCcw,
    title: 'Marcada como devolvida',
    tone: `${STATUS_META.returned.text} border-status-returned/40`,
  },
};

export interface TimelineProps {
  events: RequestEvent[];
  /** Slack ID de quem está lendo — decide o lado das mensagens. */
  viewerId: string;
}

/**
 * Timeline + chat unificados (seção 8.4).
 *
 * Um único fluxo em ordem cronológica: eventos de sistema entram como marcos na
 * linha, mensagens entram como balões. Ler a decisão junto da conversa que a
 * cercou é bem mais útil do que duas listas separadas.
 */
export function Timeline({ events, viewerId }: TimelineProps) {
  if (events.length === 0) return null;

  return (
    <ol className="relative space-y-4 pl-1">
      {/* Fio vertical da linha do tempo */}
      <span
        className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-gradient-to-b from-gold-500/25 via-gold-500/12 to-transparent"
        aria-hidden
      />

      {events.map((event) => {
        if (event.type === 'message') {
          const mine = event.authorId === viewerId;

          return (
            <li key={event.id} className="relative">
              <FadeContent duration={320} blur delay={0}>
                <div className={cn('flex items-end gap-2', mine ? 'flex-row-reverse pl-8' : 'pl-9 pr-8')}>
                  {!mine ? (
                    <Avatar
                      name={event.authorName}
                      size="xs"
                      highlighted={event.authorRole === 'admin'}
                      className="mb-1 shrink-0"
                    />
                  ) : null}

                  <div
                    className={cn(
                      'min-w-0 max-w-[85%] rounded-2xl border px-3.5 py-2.5',
                      mine
                        ? 'rounded-br-md border-gold-500/35 bg-gold-500/12'
                        : 'rounded-bl-md border-onyx-700 bg-onyx-800/70'
                    )}
                  >
                    {!mine ? (
                      <p className="mb-0.5 text-2xs font-medium text-gold-400/90">
                        {event.authorName.split(' ')[0]}
                        {event.authorRole === 'admin' ? ' · Marketing' : ''}
                      </p>
                    ) : null}

                    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ivory">
                      {event.text}
                    </p>

                    <p
                      className={cn('tabular mt-1 text-[0.65rem] text-muted/70', mine && 'text-right')}
                      title={formatInstant(event.createdAt)}
                    >
                      {formatClock(event.createdAt)}
                    </p>
                  </div>
                </div>
              </FadeContent>
            </li>
          );
        }

        const meta = SYSTEM_EVENT[event.type];
        const Icon = meta.icon;
        const note = typeof event.meta?.note === 'string' ? event.meta.note : undefined;

        return (
          <li key={event.id} className="relative flex gap-3">
            <span
              className={cn(
                'z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-onyx-900',
                meta.tone
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>

            <FadeContent duration={320} className="min-w-0 flex-1 pt-1.5">
              <Fragment>
                <p className="text-sm text-ivory">
                  {meta.title}
                  {event.type !== 'created' && event.type !== 'cancelled' ? (
                    <span className="text-muted"> por {event.authorName.split(' ')[0]}</span>
                  ) : null}
                </p>

                {note ? (
                  <p className="mt-1.5 rounded-xl border border-onyx-700 bg-onyx-800/50 px-3 py-2 text-xs leading-relaxed text-ivory/85">
                    {note}
                  </p>
                ) : null}

                <p className="tabular mt-1 text-2xs text-muted/70">{formatInstant(event.createdAt)}</p>
              </Fragment>
            </FadeContent>
          </li>
        );
      })}
    </ol>
  );
}
