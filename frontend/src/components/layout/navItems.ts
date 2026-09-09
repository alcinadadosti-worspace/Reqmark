export interface NavItem {
  key: 'itens' | 'nova' | 'requisicoes' | 'agenda' | 'admin';
  label: string;
  href: string;
  /** Só a administradora vê. */
  adminOnly?: boolean;
  /**
   * Some para a administradora.
   *
   * Ela é quem decide as requisições, não quem as faz — oferecer "Nova" e
   * "Requisições" no menu dela sugeria um papel que o app não tem: aprovar a
   * própria requisição é justamente o que as regras impedem.
   */
  requesterOnly?: boolean;
}

/** Fonte única da navegação — usada pela dock (celular) e pelo PillNav (desktop). */
export const NAV_ITEMS: NavItem[] = [
  { key: 'itens', label: 'Itens', href: '/itens' },
  { key: 'agenda', label: 'Agenda', href: '/agenda' },
  { key: 'nova', label: 'Nova', href: '/nova', requesterOnly: true },
  { key: 'requisicoes', label: 'Requisições', href: '/requisicoes', requesterOnly: true },
  { key: 'admin', label: 'Admin', href: '/admin', adminOnly: true },
];

/** Os destinos que uma pessoa vê, conforme o papel dela. */
export function navItemsFor(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    isAdmin ? !item.requesterOnly : !item.adminOnly
  );
}
