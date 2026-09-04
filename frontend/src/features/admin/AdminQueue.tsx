import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, CalendarRange, CheckCircle2, Inbox, MapPin, XCircle } from 'lucide-react';
import ElectricBorder from '@/components/reactbits/ElectricBorder/ElectricBorder';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { describeConflict, evaluatePeriod } from '@/lib/availability';
import { formatDayCount, formatRangeBR, formatRelative } from '@/lib/dates';
import { cityLabel } from '@/lib/geocode';
import { staggerItem, staggerList } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { buildOccupancy, type Conflict, type StockItemRef } from '@/shared/availability';
import type { MarketingRequest } from '@/shared/types';
import { formatTicketNumber } from '@/features/tickets/RequestCard';
import { DecisionDialog, type DecisionMode } from './DecisionDialog';

type Severity = 'clear' | 'warning' | 'conflict';

interface Analysis {
  severity: Severity;
  blocking: Conflict[];
  warnings: Conflict[];
}

const SEVERITY_STYLE: Record<Severity, { ring: string; label: string; tone: string }> = {
  clear: {
    ring: 'border-status-approved/35',
    label: 'Sem conflito',
    tone: 'text-status-approved',
  },
  warning: {
    ring: 'border-gold-500/45',
    label: 'Disputa com outra pendente',
    tone: 'text-gold-300',
  },
  conflict: {
    ring: 'border-status-rejected/50',
    label: 'Conflito com reserva aprovada',
    tone: 'text-status-rejected',
  },
};

export interface AdminQueueProps {
  requests: MarketingRequest[];
  allRequests: MarketingRequest[];
  stockById: Map<string, StockItemRef>;
}

/**
 * Fila de aprovação (seção 8.6).
 *
 * Cada card traz a análise de conflito pronta — verde, amarelo ou vermelho —
 * para a decisão levar segundos e não exigir abrir a agenda em outra aba.
 */
export function AdminQueue({ requests, allRequests, stockById }: AdminQueueProps) {
  const reduced = usePrefersReducedMotion();
  const [target, setTarget] = useState<{ request: MarketingRequest; mode: DecisionMode } | null>(null);

  /** Analisa cada pendente contra as demais, ignorando a própria. */
  const analyses = useMemo(() => {
    const map = new Map<string, Analysis>();

    for (const request of requests) {
      const index = buildOccupancy(allRequests, { excludeRequestId: request.id });
      const evaluation = evaluatePeriod({
        selection: request.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
        items: stockById,
        index,
        startDate: request.startDate,
        endDate: request.endDate,
      });

      map.set(request.id, {
        severity:
          evaluation.blocking.length > 0 ? 'conflict' : evaluation.warnings.length > 0 ? 'warning' : 'clear',
        blocking: evaluation.blocking,
        warnings: evaluation.warnings,
      });
    }

    return map;
  }, [requests, allRequests, stockById]);

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
        title="Fila vazia"
        description="Nenhuma requisição esperando decisão. Assim que alguém pedir, aparece aqui e no seu Slack."
      />
    );
  }

  return (
    <>
      <motion.ul
        className="space-y-4"
        variants={reduced ? undefined : staggerList}
        initial={reduced ? undefined : 'hidden'}
        animate={reduced ? undefined : 'visible'}
      >
        {requests.map((request) => {
          const analysis = analyses.get(request.id) ?? {
            severity: 'clear' as Severity,
            blocking: [],
            warnings: [],
          };
          const style = SEVERITY_STYLE[analysis.severity];

          const card = (
            <div className={cn('glass space-y-4 p-5', style.ring)}>
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
                  </p>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {cityLabel(request.city)}
                      {request.locationDetail ? ` · ${request.locationDetail}` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                      <span className="tabular">
                        {formatRangeBR(request.startDate, request.endDate)}
                      </span>
                      <span className="opacity-70">· {formatDayCount(request.days)}</span>
                    </span>
                  </p>
                </div>

                <span className="shrink-0 text-2xs text-muted/80">
                  {formatRelative(request.createdAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {request.items.map((line) => (
                  <span
                    key={line.itemId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-onyx-700 bg-onyx-800/70 px-2.5 py-1 text-2xs text-ivory/85"
                  >
                    <ItemIcon name={line.icon} className="h-3.5 w-3.5 text-gold-400/80" />
                    <span className="tabular">{line.quantity}×</span>
                    {line.itemName}
                  </span>
                ))}
              </div>

              <div className="rounded-2xl border border-onyx-700 bg-onyx-900/50 p-3.5">
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted/70">
                  {request.purposeType}
                </p>
                <p className="text-sm leading-relaxed text-ivory/90">{request.purpose}</p>
              </div>

              {/* Análise de conflito */}
              <div
                className={cn(
                  'flex items-start gap-2.5 rounded-2xl border p-3',
                  analysis.severity === 'clear' && 'border-status-approved/25 bg-status-approved/6',
                  analysis.severity === 'warning' && 'border-gold-500/30 bg-gold-500/6',
                  analysis.severity === 'conflict' && 'border-status-rejected/30 bg-status-rejected/6'
                )}
              >
                {analysis.severity === 'clear' ? (
                  <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', style.tone)} aria-hidden />
                ) : (
                  <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', style.tone)} aria-hidden />
                )}

                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', style.tone)}>{style.label}</p>
                  {analysis.blocking.length > 0 || analysis.warnings.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-ivory/80">
                      {[...analysis.blocking, ...analysis.warnings].map((conflict) => (
                        <li key={`${conflict.kind}-${conflict.itemId}`}>{describeConflict(conflict)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">
                      Todos os itens estão livres no período pedido.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="success"
                  onClick={() => setTarget({ request, mode: 'approve' })}
                  icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                  spark
                >
                  Aprovar
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setTarget({ request, mode: 'reject' })}
                  icon={<XCircle className="h-4 w-4" aria-hidden />}
                >
                  Reprovar
                </Button>
                <Link
                  to={`/requisicoes/${request.id}`}
                  className="ml-auto self-center text-sm text-muted underline-offset-4 transition-colors hover:text-ivory hover:underline"
                >
                  Abrir conversa
                </Link>
              </div>
            </div>
          );

          return (
            <motion.li key={request.id} variants={reduced ? undefined : staggerItem}>
              {/* A borda elétrica marca visualmente o que precisa de atenção. */}
              {analysis.severity === 'conflict' && !reduced ? (
                <ElectricBorder color="#F43F5E" speed={0.7} chaos={0.4} borderRadius={16}>
                  {card}
                </ElectricBorder>
              ) : (
                card
              )}
            </motion.li>
          );
        })}
      </motion.ul>

      <DecisionDialog
        open={target !== null}
        mode={target?.mode ?? 'approve'}
        request={target?.request ?? null}
        conflicts={target ? (analyses.get(target.request.id)?.blocking ?? []) : []}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
