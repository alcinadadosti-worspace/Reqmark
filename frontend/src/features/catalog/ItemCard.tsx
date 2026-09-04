import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import GlareHover from '@/components/reactbits/GlareHover/GlareHover';
import SpotlightCard from '@/components/reactbits/SpotlightCard/SpotlightCard';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { AvailabilityRing } from '@/components/ui/AvailabilityRing';
import { Pill } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';
import { describeItemStatus, type BadgeTone } from '@/lib/availability';
import { staggerItem } from '@/lib/motion';
import { useIsTouch } from '@/hooks/useMediaQuery';
import type { OccupancyIndex } from '@/shared/availability';
import type { DayString, Item } from '@/shared/types';

const BADGE_TONE: Record<BadgeTone, string> = {
  available: 'border-status-approved/35 bg-status-approved/10 text-status-approved',
  tight: 'border-gold-500/40 bg-gold-500/10 text-gold-300',
  pending: 'border-status-returned/35 bg-status-returned/10 text-status-returned',
  busy: 'border-status-rejected/35 bg-status-rejected/10 text-status-rejected',
};

/** No toque não existe hover: o GlareHover só entra no desktop. */
function HoverShell({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;

  return (
    <GlareHover
      width="100%"
      height="100%"
      background="transparent"
      borderColor="transparent"
      borderRadius="1.5rem"
      glareColor="#F3D28C"
      glareOpacity={0.14}
      glareAngle={-38}
      glareSize={260}
      transitionDuration={780}
      className="!cursor-pointer"
      style={{ placeItems: 'stretch' }}
    >
      {children}
    </GlareHover>
  );
}

export interface ItemCardProps {
  item: Item;
  occupancy: OccupancyIndex;
  today: DayString;
  onOpen: (item: Item) => void;
}

/**
 * Card do catálogo (seção 8.2).
 *
 * Três leituras da disponibilidade ao mesmo tempo: o anel (proporção), o badge
 * (texto: "Em uso até 12/09 (Penedo)") e a cor. O ícone do item aparece aqui,
 * no chip, no ticket e na mensagem do Slack — sempre o mesmo.
 */
export const ItemCard = memo(function ItemCard({ item, occupancy, today, onOpen }: ItemCardProps) {
  const isTouch = useIsTouch();
  const { badge, snapshot } = describeItemStatus(
    { id: item.id, name: item.name, quantity: item.quantity },
    occupancy,
    today
  );

  return (
    <motion.div variants={staggerItem} className="h-full">
      <HoverShell enabled={!isTouch}>
        <SpotlightCard
          className={cn(
            '!h-full !rounded-3xl !border-gold-500/18 !bg-onyx-900/70 !p-0 backdrop-blur-xl',
            'transition-[border-color,box-shadow,transform] duration-300 ease-brand',
            'hover:!border-gold-500/40 hover:shadow-glass-lg'
          )}
          spotlightColor="rgba(206, 161, 92, 0.16)"
        >
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="flex h-full w-full flex-col gap-4 p-5 text-left"
            aria-label={`${item.name} — ${badge.detail}. Ver detalhes e agenda.`}
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-300">
                <ItemIcon name={item.icon} emoji={item.emoji} className="h-6 w-6" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl leading-snug text-ivory">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-2xs uppercase tracking-[0.14em] text-gold-500/75">
                  {item.category}
                </span>
              </span>

              <AvailabilityRing
                available={snapshot.available}
                total={snapshot.total}
                pending={snapshot.pending}
                size={50}
                label={`${snapshot.available} de ${snapshot.total} livres hoje`}
              />
            </div>

            {item.description ? (
              <p className="clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>
            ) : null}

            {item.attributes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {item.attributes.slice(0, 2).map((attribute) => (
                  <Pill key={attribute.label} className="!px-2 !py-0.5 !text-2xs">
                    {attribute.value}
                  </Pill>
                ))}
                {item.attributes.length > 2 ? (
                  <Pill className="!px-2 !py-0.5 !text-2xs">+{item.attributes.length - 2}</Pill>
                ) : null}
              </div>
            ) : null}

            <span className="mt-auto flex items-center justify-between gap-2 pt-1">
              <span
                className={cn(
                  'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium',
                  BADGE_TONE[badge.tone]
                )}
              >
                <span className="truncate">{badge.label}</span>
              </span>

              <span className="tabular shrink-0 text-2xs text-muted">
                {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
              </span>
            </span>
          </button>
        </SpotlightCard>
      </HoverShell>
    </motion.div>
  );
});
