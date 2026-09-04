import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, LogOut, MousePointer2, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';
import { EASE_BRAND } from '@/lib/motion';
import { useIdentityStore } from '@/store/identity';
import { useMyRequestsData } from '@/data/MyRequestsProvider';
import { useCursorPreference } from '@/hooks/useCursorPreference';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { isDemoMode } from '@/demo';
import { CursorLayer } from './CursorLayer';
import { DesktopNav } from './DesktopNav';
import { DockNav } from './DockNav';

interface IdentityMenuProps {
  cursorEnabled: boolean;
  onCursorChange: (next: boolean) => void;
}

/** Menu do canto: quem sou eu, painel admin, cursor e "trocar de pessoa". */
function IdentityMenu({ cursorEnabled, onCursorChange }: IdentityMenuProps) {
  const [open, setOpen] = useState(false);
  const isTouch = useIsTouch();
  const identity = useIdentityStore((state) => state.identity);
  const signOut = useIdentityStore((state) => state.signOut);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!identity) return null;

  const isAdmin = identity.role === 'admin';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-gold-500/20 bg-onyx-900/60 py-1 pl-1 pr-3 transition-colors hover:border-gold-500/45"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu de ${identity.name}`}
      >
        <Avatar name={identity.name} size="sm" highlighted={isAdmin} />
        <span className="hidden max-w-[9rem] truncate text-sm text-ivory sm:block">
          {identity.name.split(' ')[0]}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_BRAND }}
            className="glass-strong absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden p-1.5"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar name={identity.name} size="md" highlighted={isAdmin} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ivory">{identity.name}</p>
                <p className="text-2xs uppercase tracking-[0.14em] text-gold-500/80">
                  {isAdmin ? 'Administradora' : 'Solicitante'}
                </p>
              </div>
            </div>

            <div className="brand-rule my-1" aria-hidden />

            {isAdmin ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate('/admin');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ivory transition-colors hover:bg-onyx-800"
              >
                <ShieldCheck className="h-4 w-4 text-gold-400" aria-hidden />
                Painel da administradora
              </button>
            ) : null}

            {/* Cursor customizado: só faz sentido onde existe ponteiro. */}
            {!isTouch ? (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={cursorEnabled}
                onClick={() => onCursorChange(!cursorEnabled)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ivory transition-colors hover:bg-onyx-800"
              >
                <MousePointer2 className="h-4 w-4 text-muted" aria-hidden />
                <span className="flex-1">Cursor de mira</span>
                <span
                  className={cn(
                    'h-5 w-9 shrink-0 rounded-full border transition-colors',
                    cursorEnabled ? 'border-gold-500/60 bg-gold-500/30' : 'border-onyx-600 bg-onyx-800'
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'mt-0.5 block h-3.5 w-3.5 rounded-full transition-transform duration-200 ease-brand',
                      cursorEnabled ? 'translate-x-5 bg-gold-300' : 'translate-x-0.5 bg-muted'
                    )}
                  />
                </span>
              </button>
            ) : null}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
                navigate('/');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ivory transition-colors hover:bg-onyx-800"
            >
              <UserRoundCog className="h-4 w-4 text-muted" aria-hidden />
              Trocar de pessoa
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
                navigate('/');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-onyx-800 hover:text-ivory"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      to="/requisicoes"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/20 bg-onyx-900/60 text-muted transition-colors hover:border-gold-500/45 hover:text-gold-300"
      aria-label={
        unread > 0 ? `${unread} atualização(ões) não lida(s) nas suas requisições` : 'Suas requisições'
      }
    >
      <Bell className="h-4.5 w-4.5" strokeWidth={1.7} aria-hidden />
      {unread > 0 ? (
        <>
          <span className="tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1 text-[0.65rem] font-bold text-onyx-950">
            {unread > 9 ? '9+' : unread}
          </span>
          <span
            className="absolute -right-1 -top-1 h-5 w-5 animate-pulse-ring rounded-full border border-gold-400/60"
            aria-hidden
          />
        </>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);
  const { unread } = useMyRequestsData();
  const location = useLocation();
  const [cursorEnabled, setCursorEnabled] = useCursorPreference();

  const isAdmin = identity?.role === 'admin';

  // Sempre começar a rota nova pelo topo.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-onyx-800 focus:px-4 focus:py-2 focus:text-sm focus:text-ivory"
      >
        Pular para o conteúdo
      </a>

      <header
        className={cn(
          'sticky top-0 z-30 border-b border-gold-500/12 bg-onyx-950/80 backdrop-blur-xl',
          'px-4 sm:px-6 lg:px-8'
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4">
          <Link to="/itens" className="shrink-0 lg:hidden" aria-label="AM Marketing — início">
            <Logo size={30} />
          </Link>

          {/* No desktop o próprio PillNav já mostra a logo — não repetir aqui. */}

          {/* Deixa claro que os dados são de mentira — nunca confundir com produção. */}
          {isDemoMode() ? (
            <span
              className="shrink-0 rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.14em] text-gold-300"
              title="Dados em memória, sem Firebase e sem backend. As alterações somem ao recarregar."
            >
              Demo
            </span>
          ) : null}

          <DesktopNav isAdmin={Boolean(isAdmin)} />

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NotificationBell unread={unread} />
            <IdentityMenu cursorEnabled={cursorEnabled} onCursorChange={setCursorEnabled} />
          </div>
        </div>
      </header>

      <main
        id="conteudo"
        className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-[var(--dock-space)] pt-6 sm:px-6 lg:px-8 lg:pb-16"
      >
        {children}
      </main>

      <DockNav isAdmin={Boolean(isAdmin)} unread={unread} />
      <CursorLayer enabled={cursorEnabled} />
    </div>
  );
}
