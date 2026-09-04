import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Inbox, Plus } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Surface';
import { EmptyState, ErrorNotice, SkeletonCard } from '@/components/ui/Feedback';
import { useMyRequestsData } from '@/data/MyRequestsProvider';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { staggerList } from '@/lib/motion';
import { REQUEST_STATUSES, type RequestStatus } from '@/shared/types';
import { STATUS_META } from '@/components/ui/StatusChip';
import { RequestCard } from './RequestCard';

type Filter = 'todas' | RequestStatus;

/** Minhas requisições (`/requisicoes`) — seção 8.4. */
export default function MyRequestsPage() {
  const { requests, loading, error } = useMyRequestsData();
  const reduced = usePrefersReducedMotion();
  const [filter, setFilter] = useState<Filter>('todas');

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([['todas', requests.length]]);
    for (const status of REQUEST_STATUSES) {
      map.set(status, requests.filter((request) => request.status === status).length);
    }
    return map;
  }, [requests]);

  const visible = useMemo(
    () => (filter === 'todas' ? requests : requests.filter((request) => request.status === filter)),
    [requests, filter]
  );

  /** Só mostra o filtro de um status que exista na lista — menos ruído. */
  const filters: Filter[] = useMemo(
    () => ['todas', ...REQUEST_STATUSES.filter((status) => (counts.get(status) ?? 0) > 0)],
    [counts]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acompanhe as respostas"
        title="Minhas requisições"
        description="Cada requisição é uma conversa privada entre você e a Suzana."
        actions={
          <ButtonLink to="/nova" icon={<Plus className="h-4 w-4" aria-hidden />}>
            Nova
          </ButtonLink>
        }
      />

      {filters.length > 1 ? (
        <ChipRow>
          {filters.map((entry) => (
            <Chip key={entry} selected={filter === entry} onClick={() => setFilter(entry)}>
              {entry === 'todas' ? 'Todas' : STATUS_META[entry].label}
              <span className="tabular ml-1 text-2xs opacity-70">{counts.get(entry) ?? 0}</span>
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} className="h-40" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
          title={requests.length === 0 ? 'Você ainda não pediu nada' : 'Nada com esse filtro'}
          description={
            requests.length === 0
              ? 'Quando abrir uma requisição, ela aparece aqui com o histórico completo e um chat com a Suzana.'
              : 'Escolha outro filtro para ver as demais.'
          }
          action={
            requests.length === 0 ? (
              <ButtonLink to="/nova" icon={<Plus className="h-4 w-4" aria-hidden />}>
                Fazer a primeira requisição
              </ButtonLink>
            ) : (
              <button
                type="button"
                onClick={() => setFilter('todas')}
                className="text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
              >
                Ver todas
              </button>
            )
          }
        />
      ) : (
        <motion.ul
          className="space-y-3"
          variants={reduced ? undefined : staggerList}
          initial={reduced ? undefined : 'hidden'}
          animate={reduced ? undefined : 'visible'}
        >
          {visible.map((request) => (
            <RequestCard key={request.id} request={request} side="requester" />
          ))}
        </motion.ul>
      )}
    </div>
  );
}
