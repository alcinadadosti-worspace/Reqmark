import { useMemo } from 'react';
import { CheckCircle2, Clock3, MapPinned, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Counter from '@/components/reactbits/Counter/Counter';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { GlassCard, SectionTitle } from '@/components/ui/Surface';
import { LazyActivationsMap } from '@/components/map/LazyActivationsMap';
import type { ActivationPin } from '@/components/map/ActivationsMap';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { today } from '@/lib/dates';
import { cityLabel } from '@/lib/geocode';
import { addDays, compareDays, rangesOverlap } from '@/shared/dates';
import type { MarketingRequest } from '@/shared/types';

export interface AdminDashboardProps {
  requests: MarketingRequest[];
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: string;
}

function Stat({ icon: Icon, label, value, tone = 'text-gold-300' }: StatProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <GlassCard className="flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-400">
        <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
      </span>

      <div className="min-w-0">
        <div className={`tabular font-display text-3xl leading-none ${tone}`}>
          {reduced ? (
            value
          ) : (
            <Counter
              value={value}
              fontSize={30}
              padding={2}
              gap={1}
              horizontalPadding={2}
              borderRadius={6}
              gradientHeight={10}
              gradientFrom="#121216"
              gradientTo="transparent"
              textColor="currentColor"
              fontWeight={500}
              containerStyle={{ display: 'inline-flex' }}
            />
          )}
        </div>
        <p className="mt-1 text-2xs leading-tight text-muted">{label}</p>
      </div>
    </GlassCard>
  );
}

/** Dashboard do painel (seção 8.6): contadores animados e mapa de ativações. */
export function AdminDashboard({ requests }: AdminDashboardProps) {
  const day = today();

  const stats = useMemo(() => {
    const monthPrefix = day.slice(0, 7);

    const pending = requests.filter((request) => request.status === 'pending').length;

    // "Aprovadas no mês" pela data da ação, não pela data da decisão: é assim
    // que a Suzana pensa o mês de trabalho do Marketing.
    const approvedThisMonth = requests.filter(
      (request) =>
        (request.status === 'approved' || request.status === 'returned') &&
        request.startDate.startsWith(monthPrefix)
    ).length;

    // Item mais requisitado, somando as unidades pedidas.
    const perItem = new Map<string, { name: string; icon: string; units: number }>();
    for (const request of requests) {
      if (request.status === 'rejected' || request.status === 'cancelled') continue;
      for (const line of request.items) {
        const current = perItem.get(line.itemId);
        if (current) current.units += line.quantity;
        else perItem.set(line.itemId, { name: line.itemName, icon: line.icon, units: line.quantity });
      }
    }
    const topItem = [...perItem.values()].sort((a, b) => b.units - a.units)[0] ?? null;

    const cities = new Set(
      requests
        .filter((request) => request.status === 'approved' || request.status === 'returned')
        .map((request) => `${request.city.name}/${request.city.state}`)
        .filter((entry) => entry !== '/')
    );

    return { pending, approvedThisMonth, topItem, cityCount: cities.size };
  }, [requests, day]);

  /** Aprovadas ativas ou que começam nos próximos 30 dias. */
  const pins = useMemo<ActivationPin[]>(() => {
    const horizon = addDays(day, 30);

    return requests
      .filter(
        (request) =>
          request.status === 'approved' &&
          rangesOverlap(request.startDate, request.endDate, day, horizon)
      )
      .map((request) => ({
        id: request.id,
        lat: request.city.lat,
        lng: request.city.lng,
        title: `#${String(request.number).padStart(4, '0')} · ${cityLabel(request.city)}`,
        subtitle: `${request.requesterName} · ${request.purposeType}`,
        active:
          compareDays(request.startDate, day) <= 0 && compareDays(request.endDate, day) >= 0,
      }));
  }, [requests, day]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Clock3} label="esperando sua decisão" value={stats.pending} />
        <Stat
          icon={CheckCircle2}
          label="aprovadas neste mês"
          value={stats.approvedThisMonth}
          tone="text-status-approved"
        />
        <Stat icon={MapPinned} label="cidades já atendidas" value={stats.cityCount} />

        <GlassCard className="flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-400">
            {stats.topItem ? (
              <ItemIcon name={stats.topItem.icon} className="h-5 w-5" />
            ) : (
              <Trophy className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            )}
          </span>

          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-tight text-gold-300">
              {stats.topItem?.name ?? '—'}
            </p>
            <p className="mt-0.5 text-2xs leading-tight text-muted">
              {stats.topItem
                ? `item mais requisitado · ${stats.topItem.units} un. no total`
                : 'item mais requisitado'}
            </p>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-5 pb-3">
          <SectionTitle className="!mb-1">Mapa de ativações</SectionTitle>
          <p className="text-sm text-muted">
            Ações aprovadas em campo agora (dourado) e nos próximos 30 dias (azul).
          </p>
        </div>

        <LazyActivationsMap
          pins={pins}
          className="h-72 w-full border-t border-gold-500/15 sm:h-96"
        />
      </GlassCard>
    </div>
  );
}
