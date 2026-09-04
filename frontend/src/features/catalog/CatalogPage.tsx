import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpDown, PackageSearch, Plus, Search, X } from 'lucide-react';
import BlurText from '@/components/reactbits/BlurText/BlurText';
import CountUp from '@/components/reactbits/CountUp/CountUp';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, SkeletonCard } from '@/components/ui/Feedback';
import { useAppData } from '@/data/AppDataProvider';
import { useMyRequestsData } from '@/data/MyRequestsProvider';
import { useIdentityStore } from '@/store/identity';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { greeting, today } from '@/lib/dates';
import { normalize } from '@/lib/geocode';
import { staggerList } from '@/lib/motion';
import { availabilityOn } from '@/shared/availability';
import { addDays, rangesOverlap } from '@/shared/dates';
import type { Item } from '@/shared/types';
import { HeroBackdrop } from './HeroBackdrop';
import { ItemCard } from './ItemCard';
import { ItemDrawer } from './ItemDrawer';

type SortKey = 'relevance' | 'name' | 'availability';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Sugerido' },
  { key: 'availability', label: 'Mais livres' },
  { key: 'name', label: 'A–Z' },
];

/** Métrica animada do cabeçalho. */
function Metric({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="min-w-0 flex-1 px-1">
      <p className="tabular font-display text-3xl leading-none text-gold-300 sm:text-4xl">
        {reduced ? value : <CountUp to={value} duration={1.1} />}
        {suffix ? <span className="ml-0.5 text-xl text-gold-500/70">{suffix}</span> : null}
      </p>
      <p className="mt-1.5 text-2xs leading-tight text-muted sm:text-xs">{label}</p>
    </div>
  );
}

/**
 * Home / catálogo (`/itens`) — seção 8.2.
 *
 * Cabeçalho com saudação e três métricas, grade de itens com anel de
 * disponibilidade e filtros. O clique no card abre o drawer com a agenda.
 */
export default function CatalogPage() {
  const { activeItems, occupancy, ready, error, occupancyRequests } = useAppData();
  const { open: openRequests } = useMyRequestsData();
  const identity = useIdentityStore((state) => state.identity);
  const reduced = usePrefersReducedMotion();

  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string>('todas');
  const [sort, setSort] = useState<SortKey>('relevance');
  const [selected, setSelected] = useState<Item | null>(null);

  const day = today();

  const categories = useMemo(() => {
    const found = new Set(activeItems.map((item) => item.category).filter(Boolean));
    return ['todas', ...[...found].sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [activeItems]);

  const metrics = useMemo(() => {
    const availableToday = activeItems.reduce(
      (total, item) =>
        total +
        Math.max(
          0,
          availabilityOn({ id: item.id, name: item.name, quantity: item.quantity }, occupancy, day)
            .available
        ),
      0
    );

    const weekEnd = addDays(day, 7);
    const thisWeek = occupancyRequests.filter(
      (request) =>
        request.status === 'approved' && rangesOverlap(request.startDate, request.endDate, day, weekEnd)
    ).length;

    return { availableToday, openRequests: openRequests.length, thisWeek };
  }, [activeItems, occupancy, day, occupancyRequests, openRequests.length]);

  const visibleItems = useMemo(() => {
    const needle = normalize(term);

    const filtered = activeItems.filter((item) => {
      if (category !== 'todas' && item.category !== category) return false;
      if (!needle) return true;
      const haystack = normalize(
        `${item.name} ${item.category} ${item.description} ${item.tags.join(' ')}`
      );
      return haystack.includes(needle);
    });

    const availabilityOf = (item: Item) =>
      availabilityOn({ id: item.id, name: item.name, quantity: item.quantity }, occupancy, day)
        .available;

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sort === 'availability') {
        return availabilityOf(b) - availabilityOf(a) || a.name.localeCompare(b.name, 'pt-BR');
      }
      // Sugerido: quem tem unidade livre aparece antes, depois ordem alfabética.
      const freeA = availabilityOf(a) > 0 ? 0 : 1;
      const freeB = availabilityOf(b) > 0 ? 0 : 1;
      return freeA - freeB || a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [activeItems, category, term, sort, occupancy, day]);

  const firstName = identity?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-7">
      {/* Cabeçalho com raios de luz e métricas */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/15 bg-onyx-900/50 px-5 py-7 backdrop-blur-xl sm:px-7 sm:py-9">
        <HeroBackdrop />

        <p className="text-2xs uppercase tracking-[0.28em] text-gold-500/80">
          {greeting()}
          {firstName ? ',' : ''}
        </p>

        {reduced ? (
          <h1 className="mt-1 font-display text-4xl text-ivory sm:text-5xl">{firstName || 'Olá'}</h1>
        ) : (
          <BlurText
            text={firstName || 'Olá'}
            animateBy="letters"
            direction="bottom"
            delay={28}
            className="mt-1 font-display text-4xl text-ivory sm:text-5xl"
          />
        )}

        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          Veja o que está livre hoje, confira a agenda de cada item e abra sua requisição.
        </p>

        <div className="mt-6 flex items-start gap-2 divide-x divide-gold-500/15 sm:gap-4">
          <Metric value={metrics.availableToday} label="itens livres hoje" />
          <Metric value={metrics.openRequests} label="requisições suas em aberto" />
          <Metric value={metrics.thisWeek} label="ações nesta semana" />
        </div>
      </section>

      {/* Filtros */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar item…"
            aria-label="Buscar item"
            className="sm:max-w-xs"
            leading={<Search className="h-4 w-4" aria-hidden />}
            trailing={
              term ? (
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  className="rounded-full p-1 transition-colors hover:text-ivory"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null
            }
          />

          <div className="flex items-center gap-2 sm:ml-auto">
            <ArrowUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <ChipRow>
              {SORTS.map((option) => (
                <Chip key={option.key} selected={sort === option.key} onClick={() => setSort(option.key)}>
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        </div>

        <ChipRow>
          {categories.map((entry) => (
            <Chip key={entry} selected={category === entry} onClick={() => setCategory(entry)}>
              {entry === 'todas' ? 'Todas' : entry}
            </Chip>
          ))}
        </ChipRow>
      </section>

      {/* Grade */}
      {error ? (
        <ErrorNotice message={error} />
      ) : !ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} className="h-52" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
          title={activeItems.length === 0 ? 'Nenhum item cadastrado ainda' : 'Nada encontrado'}
          description={
            activeItems.length === 0
              ? 'A Suzana cadastra os itens pelo painel da administradora. Assim que houver itens, eles aparecem aqui.'
              : 'Tente outro termo ou limpe os filtros.'
          }
          action={
            term || category !== 'todas' ? (
              <button
                type="button"
                onClick={() => {
                  setTerm('');
                  setCategory('todas');
                }}
                className="text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
              >
                Limpar filtros
              </button>
            ) : null
          }
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          variants={reduced ? undefined : staggerList}
          initial={reduced ? undefined : 'hidden'}
          animate={reduced ? undefined : 'visible'}
        >
          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              occupancy={occupancy}
              today={day}
              onOpen={setSelected}
            />
          ))}
        </motion.div>
      )}

      {/* CTA fixo acima da dock */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-20 flex justify-center px-4 lg:bottom-8">
        <ButtonLink
          to="/nova"
          size="lg"
          className="pointer-events-auto shadow-gold-glow"
          icon={<Plus className="h-5 w-5" aria-hidden />}
        >
          Nova requisição
        </ButtonLink>
      </div>

      {/* Espaço para o CTA não cobrir o último card */}
      <div className="h-14" aria-hidden />

      <ItemDrawer
        item={selected}
        occupancy={occupancy}
        today={day}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
