import { useMemo, useState } from 'react';
import { BarChart3, Inbox, PackageCheck, Settings2, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { PageHeader } from '@/components/ui/Surface';
import { ErrorNotice, LoadingScreen } from '@/components/ui/Feedback';
import { useAppData } from '@/data/AppDataProvider';
import { useAllRequests } from '@/hooks/useRequests';
import { compareDays } from '@/shared/dates';
import { AdminGate } from './AdminGate';
import { AdminDashboard } from './AdminDashboard';
import { AdminQueue } from './AdminQueue';
import { AdminInUse } from './AdminInUse';
import { AdminItems } from './AdminItems';
import { AdminSettings } from './AdminSettings';

type Tab = 'fila' | 'uso' | 'itens' | 'config' | 'painel';

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'fila', label: 'Fila', icon: Inbox },
  { key: 'uso', label: 'Em uso', icon: PackageCheck },
  { key: 'painel', label: 'Painel', icon: BarChart3 },
  { key: 'itens', label: 'Itens', icon: Sparkles },
  { key: 'config', label: 'Configurações', icon: Settings2 },
];

/** Painel da administradora (`/admin`) — seção 8.6. */
function AdminContent() {
  const { items, stockById, settings, ready, error } = useAppData();
  const { data: requests, loading, error: requestsError } = useAllRequests(true);
  const [tab, setTab] = useState<Tab>('fila');

  const pending = useMemo(
    () =>
      requests
        .filter((request) => request.status === 'pending')
        // Mais antigas primeiro: quem esperou mais é decidido antes.
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [requests]
  );

  const inUse = useMemo(
    () =>
      requests
        .filter((request) => request.status === 'approved')
        .sort((a, b) => compareDays(a.endDate, b.endDate)),
    [requests]
  );

  if (error || requestsError) return <ErrorNotice message={error ?? requestsError ?? ''} />;
  if (!ready || loading) return <LoadingScreen label="Carregando o painel…" />;

  const counts: Partial<Record<Tab, number>> = {
    fila: pending.length,
    uso: inUse.length,
    itens: items.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Painel da administradora"
        title="Marketing"
        description="Aprove, acompanhe o que está em campo e mantenha o catálogo em dia."
      />

      <ChipRow>
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const count = counts[entry.key];
          return (
            <Chip
              key={entry.key}
              selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              icon={<Icon className="h-4 w-4" aria-hidden />}
            >
              {entry.label}
              {count !== undefined && count > 0 ? (
                <span className="tabular ml-1 text-2xs opacity-70">{count}</span>
              ) : null}
            </Chip>
          );
        })}
      </ChipRow>

      {tab === 'fila' ? (
        <AdminQueue requests={pending} allRequests={requests} stockById={stockById} />
      ) : tab === 'uso' ? (
        <AdminInUse requests={inUse} />
      ) : tab === 'painel' ? (
        <AdminDashboard requests={requests} />
      ) : tab === 'itens' ? (
        <AdminItems items={items} />
      ) : (
        <AdminSettings settings={settings} />
      )}

      <p className="px-1 text-2xs leading-relaxed text-muted/70">
        Toda decisão tomada aqui atualiza a mensagem no Slack e avisa o solicitante por DM.
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminContent />
    </AdminGate>
  );
}
