import { motion } from 'motion/react';
import { PackageSearch } from 'lucide-react';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { AvailabilityRing } from '@/components/ui/AvailabilityRing';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { EmptyState } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { describeItemStatus } from '@/lib/availability';
import { staggerItem, staggerList } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import type { OccupancyIndex } from '@/shared/availability';
import type { DayString, Item } from '@/shared/types';
import type { WizardSelection } from '@/store/wizard';

export interface StepItemsProps {
  items: Item[];
  occupancy: OccupancyIndex;
  today: DayString;
  selection: WizardSelection;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onToggle: (itemId: string) => void;
}

/**
 * Passo 1 — Itens.
 *
 * A disponibilidade mostrada aqui é a de HOJE, só para dar contexto. Itens sem
 * unidade livre hoje continuam selecionáveis de propósito: quem decide é a data
 * escolhida no passo 4, e a ação pode ser daqui a três semanas.
 */
export function StepItems({
  items,
  occupancy,
  today,
  selection,
  onQuantityChange,
  onToggle,
}: StepItemsProps) {
  const reduced = usePrefersReducedMotion();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
        title="Nenhum item disponível"
        description="A Suzana ainda não cadastrou itens no painel."
      />
    );
  }

  return (
    <motion.ul
      className="space-y-2.5"
      variants={reduced ? undefined : staggerList}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : 'visible'}
    >
      {items.map((item) => {
        const quantity = selection[item.id] ?? 0;
        const isSelected = quantity > 0;
        const { badge, snapshot } = describeItemStatus(
          { id: item.id, name: item.name, quantity: item.quantity },
          occupancy,
          today
        );

        return (
          <motion.li key={item.id} variants={reduced ? undefined : staggerItem}>
            <div
              className={cn(
                'flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all duration-200 ease-brand sm:p-4',
                isSelected
                  ? 'border-gold-500/50 bg-gold-500/8 shadow-[0_0_0_1px_rgba(206,161,92,0.14)]'
                  : 'border-onyx-700 bg-onyx-900/50 hover:border-gold-500/30'
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Remover' : 'Adicionar'} ${item.name}. ${badge.detail}`}
              >
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors',
                    isSelected
                      ? 'border-gold-500/45 bg-gold-500/12 text-gold-300'
                      : 'border-gold-500/18 bg-onyx-800/60 text-muted'
                  )}
                >
                  <ItemIcon name={item.icon} emoji={item.emoji} className="h-6 w-6" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.95rem] font-medium text-ivory">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-2xs',
                      badge.tone === 'busy'
                        ? 'text-status-rejected/85'
                        : badge.tone === 'pending'
                          ? 'text-status-returned/85'
                          : badge.tone === 'tight'
                            ? 'text-gold-400/85'
                            : 'text-muted'
                    )}
                  >
                    {badge.label} · {item.category}
                  </span>
                </span>

                <AvailabilityRing
                  available={snapshot.available}
                  total={snapshot.total}
                  pending={snapshot.pending}
                  size={40}
                  strokeWidth={2.5}
                  className="hidden shrink-0 sm:inline-flex"
                />
              </button>

              <QuantityStepper
                value={quantity}
                onChange={(next) => onQuantityChange(item.id, next)}
                max={item.quantity}
                label={item.name}
                size="sm"
                className="shrink-0"
              />
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
