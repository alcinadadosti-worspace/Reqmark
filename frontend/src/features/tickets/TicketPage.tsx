import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Ban,
  CalendarRange,
  CheckCircle2,
  MapPin,
  RotateCcw,
  Send,
  Target,
  XCircle,
} from 'lucide-react';
import AnimatedContent from '@/components/reactbits/AnimatedContent/AnimatedContent';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataLabel, GlassCard, Rule } from '@/components/ui/Surface';
import { StatusChip } from '@/components/ui/StatusChip';
import { ErrorNotice, LoadingScreen } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { Textarea } from '@/components/ui/Field';
import { LazyCityMap } from '@/components/map/LazyCityMap';
import { useAppData } from '@/data/AppDataProvider';
import { useRequestTicket } from '@/hooks/useRequests';
import { useIdentityStore } from '@/store/identity';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cancelRequest, markTicketRead, sendMessage } from '@/lib/collections';
import { ApiError, api, getAdminToken } from '@/lib/api';
import { evaluatePeriod } from '@/lib/availability';
import { formatDayCount, formatDayFriendly, formatInstant } from '@/lib/dates';
import { cityLabel } from '@/lib/geocode';
import { buildOccupancy } from '@/shared/availability';
import { DecisionDialog, type DecisionMode } from '@/features/admin/DecisionDialog';
import { Timeline } from './Timeline';
import { formatTicketNumber } from './RequestCard';

/** Ticket (`/requisicoes/:id`) — seção 8.4. */
export default function TicketPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { request, events, loading, notFound, error } = useRequestTicket(requestId);

  const identity = useIdentityStore((state) => state.identity);
  const adminUnlocked = useIdentityStore((state) => state.adminUnlocked);
  const { occupancyRequests, stockById } = useAppData();
  const reduced = usePrefersReducedMotion();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [decision, setDecision] = useState<DecisionMode | null>(null);
  const [returning, setReturning] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastStatus = useRef<string | null>(null);

  const isMine = Boolean(identity && request && request.requesterId === identity.slackId);
  const isAdmin = identity?.role === 'admin';
  const canModerate = Boolean(isAdmin && adminUnlocked && getAdminToken());
  const side = isAdmin && !isMine ? 'admin' : 'requester';

  /** Zera o contador de não lidas do próprio lado ao abrir. */
  useEffect(() => {
    if (!request || !identity) return;
    if ((request.unread?.[side] ?? 0) === 0) return;
    void markTicketRead(request.id, side).catch(() => {
      /* não é crítico: o badge some na próxima abertura */
    });
  }, [request, identity, side]);

  /** Avisa quando a decisão chega, sem precisar recarregar (tempo real). */
  useEffect(() => {
    if (!request) return;
    const previous = lastStatus.current;
    lastStatus.current = request.status;

    if (!previous || previous === request.status || !isMine) return;

    if (request.status === 'approved') {
      toast.success(`Requisição ${formatTicketNumber(request.number)} aprovada!`, {
        description: 'Os itens estão reservados para você no período pedido.',
      });
    } else if (request.status === 'rejected') {
      toast.error(`Requisição ${formatTicketNumber(request.number)} reprovada`, {
        description: request.decision?.note ?? 'Veja o motivo na conversa.',
      });
    }
  }, [request, isMine]);

  /** Mantém a conversa rolada para a última mensagem. */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, [events.length, reduced]);

  /** Conflitos com aprovadas, ignorando a própria requisição. */
  const conflicts = useMemo(() => {
    if (!request) return [];
    const index = buildOccupancy(occupancyRequests, { excludeRequestId: request.id });
    const evaluation = evaluatePeriod({
      selection: request.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      items: stockById,
      index,
      startDate: request.startDate,
      endDate: request.endDate,
    });
    return evaluation.blocking;
  }, [request, occupancyRequests, stockById]);

  if (loading) return <LoadingScreen label="Abrindo a requisição…" />;
  if (notFound) {
    return (
      <ErrorNotice
        title="Requisição não encontrada"
        message="O link pode estar errado ou a requisição foi removida."
        action={
          <Link to="/requisicoes" className="text-sm text-gold-300 underline underline-offset-4">
            Voltar para minhas requisições
          </Link>
        }
      />
    );
  }
  if (error || !request) return <ErrorNotice message={error ?? 'Erro desconhecido.'} />;

  const canChat = isMine || canModerate;
  const canCancel = isMine && request.status === 'pending';

  const send = async () => {
    const text = draft.trim();
    if (!text || !identity || sending) return;

    setSending(true);
    try {
      if (canModerate && !isMine) {
        // A administradora escreve pelo backend, que também manda a DM no Slack.
        await api.sendAdminMessage(request.id, text);
      } else {
        await sendMessage({
          requestId: request.id,
          authorId: identity.slackId,
          authorName: identity.name,
          authorRole: identity.role,
          text,
        });
      }
      setDraft('');
    } catch (cause) {
      console.error('[TicketPage] falha ao enviar mensagem', cause);
      toast.error('Não consegui enviar a mensagem', {
        description: cause instanceof ApiError ? cause.message : 'Tente de novo em instantes.',
      });
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!identity || cancelling) return;
    setCancelling(true);
    try {
      await cancelRequest({
        requestId: request.id,
        requesterId: identity.slackId,
        requesterName: identity.name,
      });
      toast.success('Requisição cancelada', { description: 'A Suzana foi avisada no Slack.' });
      setCancelOpen(false);
    } catch (cause) {
      console.error('[TicketPage] falha ao cancelar', cause);
      toast.error('Não consegui cancelar agora.');
    } finally {
      setCancelling(false);
    }
  };

  const markReturned = async () => {
    if (returning) return;
    setReturning(true);
    try {
      await api.markReturned(request.id);
      toast.success('Marcada como devolvida', { description: 'Os itens voltaram a ficar livres.' });
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Não consegui marcar a devolução.');
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Link
        to="/requisicoes"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ivory"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Minhas requisições
      </Link>

      {/* Cabeçalho com o status grande */}
      <AnimatedContent distance={24} duration={0.5} direction="vertical">
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tabular font-display text-4xl leading-none brand-text">
                {formatTicketNumber(request.number)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Avatar name={request.requesterName} size="xs" />
                {request.requesterName}
              </p>
            </div>

            <div className="text-right">
              <StatusChip status={request.status} size="lg" />
              {request.decision ? (
                <p className="mt-1.5 text-2xs text-muted">
                  por {request.decision.byName.split(' ')[0]} ·{' '}
                  {formatInstant(request.decision.at)}
                  {request.decision.channel === 'slack' ? ' · Slack' : ''}
                </p>
              ) : null}
            </div>
          </div>

          {request.decision?.note ? (
            <p className="mt-4 rounded-xl border border-onyx-700 bg-onyx-800/50 px-3.5 py-2.5 text-sm leading-relaxed text-ivory/85">
              {request.decision.note}
            </p>
          ) : null}

          {/* Ações */}
          {canCancel || canModerate ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-onyx-700/60 pt-4">
              {canModerate && request.status === 'pending' ? (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setDecision('approve')}
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                  >
                    Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDecision('reject')}
                    icon={<XCircle className="h-4 w-4" aria-hidden />}
                  >
                    Reprovar
                  </Button>
                </>
              ) : null}

              {canModerate && request.status === 'approved' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={markReturned}
                  loading={returning}
                  icon={<RotateCcw className="h-4 w-4" aria-hidden />}
                >
                  Marcar como devolvido
                </Button>
              ) : null}

              {canCancel ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setCancelOpen(true)}
                  icon={<Ban className="h-4 w-4" aria-hidden />}
                >
                  Cancelar requisição
                </Button>
              ) : null}
            </div>
          ) : null}
        </GlassCard>
      </AnimatedContent>

      {/* Dados da requisição */}
      <AnimatedContent distance={24} duration={0.5} delay={0.06} direction="vertical">
        <GlassCard className="space-y-4 p-5">
          <div>
            <DataLabel>Itens</DataLabel>
            <ul className="mt-2 space-y-2">
              {request.items.map((line) => (
                <li key={line.itemId} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gold-500/18 bg-onyx-800/60 text-gold-300">
                    <ItemIcon name={line.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ivory">{line.itemName}</span>
                  <span className="tabular shrink-0 text-sm text-gold-300">{line.quantity}×</span>
                </li>
              ))}
            </ul>
          </div>

          <Rule />

          <div>
            <DataLabel>Finalidade · {request.purposeType}</DataLabel>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ivory/90">
              {request.purpose}
            </p>
          </div>

          <Rule />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <DataLabel>Onde</DataLabel>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ivory">
                <MapPin className="h-4 w-4 shrink-0 text-gold-400/80" aria-hidden />
                {cityLabel(request.city)}
              </p>
              {request.locationDetail ? (
                <p className="mt-0.5 pl-5.5 text-xs text-muted">{request.locationDetail}</p>
              ) : null}
            </div>

            <div>
              <DataLabel>Quando</DataLabel>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ivory">
                <CalendarRange className="h-4 w-4 shrink-0 text-gold-400/80" aria-hidden />
                {request.startDate === request.endDate
                  ? formatDayFriendly(request.startDate)
                  : `${formatDayFriendly(request.startDate)} – ${formatDayFriendly(request.endDate)}`}
              </p>
              <p className="tabular mt-0.5 pl-5.5 text-xs text-muted">
                {formatDayCount(request.days)}
                {request.returnedOn ? ` · devolvido em ${formatDayFriendly(request.returnedOn)}` : ''}
              </p>
            </div>
          </div>

          <LazyCityMap
            city={request.city}
            zoom={11}
            static
            animate={false}
            className="h-36 w-full overflow-hidden rounded-2xl border border-gold-500/15"
          />
        </GlassCard>
      </AnimatedContent>

      {/* Histórico + conversa */}
      <GlassCard className="flex flex-col p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-ivory">
          <Target className="h-4 w-4 text-gold-400" aria-hidden />
          Histórico e conversa
        </h2>

        <Timeline events={events} viewerId={identity?.slackId ?? ''} />
        <div ref={bottomRef} />

        {canChat ? (
          <div className="mt-5 border-t border-onyx-700/60 pt-4">
            <label htmlFor="mensagem" className="sr-only">
              Escrever mensagem
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                id="mensagem"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter envia; Shift+Enter quebra linha.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  isMine
                    ? 'Escreva para a Suzana…'
                    : `Responder ${request.requesterName.split(' ')[0]}…`
                }
                maxLength={800}
                className="min-h-[3rem] flex-1 resize-none py-3"
                rows={1}
              />
              <Button
                size="icon"
                onClick={send}
                loading={sending}
                disabled={!draft.trim()}
                aria-label="Enviar mensagem"
                className="mb-0.5 h-12 w-12"
              >
                {sending ? null : <Send className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
            <p className="mt-1.5 text-2xs text-muted/70">
              A mensagem também chega no Slack de quem precisa ver.
            </p>
          </div>
        ) : null}
      </GlassCard>

      {/* Confirmação de cancelamento */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar esta requisição?"
        description={`${formatTicketNumber(request.number)} · ${cityLabel(request.city)}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Voltar
            </Button>
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              Sim, cancelar
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Os itens voltam a ficar livres para outras pessoas e a Suzana é avisada no Slack. Não dá
          para desfazer — se precisar, abra uma nova requisição.
        </p>
      </Modal>

      <DecisionDialog
        open={decision !== null}
        mode={decision ?? 'approve'}
        request={request}
        conflicts={conflicts}
        onClose={() => setDecision(null)}
      />
    </div>
  );
}
