export interface NavItem {
  key: 'itens' | 'nova' | 'requisicoes' | 'agenda' | 'admin';
  label: string;
  href: string;
  adminOnly?: boolean;
}

/** Fonte única da navegação — usada pela dock (celular) e pelo PillNav (desktop). */
export const NAV_ITEMS: NavItem[] = [
  { key: 'itens', label: 'Itens', href: '/itens' },
  { key: 'agenda', label: 'Agenda', href: '/agenda' },
  { key: 'nova', label: 'Nova', href: '/nova' },
  { key: 'requisicoes', label: 'Requisições', href: '/requisicoes' },
  { key: 'admin', label: 'Admin', href: '/admin', adminOnly: true },
];
