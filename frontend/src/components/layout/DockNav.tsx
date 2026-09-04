import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Inbox, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import Dock, { type DockItemData } from '@/components/reactbits/Dock/Dock';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './navItems';

const ICONS = {
  itens: Sparkles,
  nova: Plus,
  requisicoes: Inbox,
  agenda: CalendarDays,
  admin: ShieldCheck,
} as const;

export interface DockNavProps {
  isAdmin: boolean;
  unread: number;
}

/**
 * Navegação do celular (React Bits `Dock`).
 *
 * O Dock traz cores próprias em `bg-[#120F17]`/`border-neutral-700`; as classes
 * com `!` abaixo forçam a paleta onyx/dourado sem depender da ordem em que o
 * Tailwind gera as regras.
 */
export function DockNav({ isAdmin, unread }: DockNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo<DockItemData[]>(() => {
    return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
      const Icon = ICONS[item.key];
      const active =
        item.href === '/itens'
          ? location.pathname === '/itens'
          : location.pathname.startsWith(item.href);

      const badge = item.key === 'requisicoes' && unread > 0 ? unread : 0;

      return {
        label: item.label,
        onClick: () => navigate(item.href),
        className: cn(
          '!border !bg-onyx-900/90 !backdrop-blur-xl transition-colors duration-200',
          active ? '!border-gold-500/60' : '!border-gold-500/18'
        ),
        icon: (
          <span className="relative flex items-center justify-center">
            <Icon
              className={cn('h-5 w-5 transition-colors', active ? 'text-gold-300' : 'text-muted')}
              strokeWidth={1.6}
              aria-hidden
            />
            {badge > 0 ? (
              <span className="tabular absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[0.6rem] font-bold text-onyx-950">
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </span>
        ),
      };
    });
  }, [isAdmin, location.pathname, navigate, unread]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 h-[5.25rem] pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      aria-label="Navegação principal"
    >
      {/* Degradê que apaga o conteúdo por baixo da dock. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-onyx-fade" aria-hidden />
      <Dock
        items={items}
        panelHeight={64}
        baseItemSize={46}
        magnification={58}
        distance={120}
        dockHeight={130}
        className="!border !border-gold-500/20 !bg-onyx-900/85 !backdrop-blur-xl"
      />
    </nav>
  );
}
