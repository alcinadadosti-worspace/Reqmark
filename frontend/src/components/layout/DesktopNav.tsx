import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import PillNav, { type PillNavItem } from '@/components/reactbits/PillNav/PillNav';
import { NAV_ITEMS } from './navItems';

/**
 * Navegação do desktop (React Bits `PillNav`).
 *
 * O componente se posiciona sozinho (`absolute top-[1em]`), então vive dentro
 * de um contêiner relativo de altura fixa. As cores seguem a marca: pílula
 * onyx com texto marfim, que se preenche de dourado ao passar o mouse.
 */
export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();

  const items = useMemo<PillNavItem[]>(
    () =>
      NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => ({
        label: item.label,
        href: item.href,
        ariaLabel: item.label,
      })),
    [isAdmin]
  );

  const active =
    NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).find((item) =>
      item.href === '/itens' ? location.pathname === '/itens' : location.pathname.startsWith(item.href)
    )?.href ?? '/itens';

  return (
    <div className="relative hidden h-14 flex-1 lg:block">
      <PillNav
        logo="/logo-am.png"
        logoAlt="AM Marketing"
        items={items}
        activeHref={active}
        baseColor="#CEA15C"
        pillColor="#121216"
        pillTextColor="#F5F1EA"
        hoveredPillTextColor="#0B0B0D"
        ease="power3.out"
        initialLoadAnimation={false}
      />
    </div>
  );
}
