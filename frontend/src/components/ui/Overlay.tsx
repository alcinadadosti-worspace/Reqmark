import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EASE_BRAND } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento comum de camadas sobrepostas: trava a rolagem do fundo, fecha
 * no Esc, prende o foco dentro e devolve o foco ao elemento de origem.
 */
function useOverlayBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const { overflow, paddingRight } = document.body.style;
    // Compensa a largura da barra de rolagem para o conteúdo não "pular".
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    }, 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return panelRef;
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 bg-onyx-950/75 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      aria-hidden
    />
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Painel lateral. Sobe pela base no celular (onde o polegar alcança) e desliza
 * pela direita no desktop.
 */
export function Drawer({ open, onClose, title, description, children, footer, className }: DrawerProps) {
  const panelRef = useOverlayBehavior(open, onClose);
  const reduced = usePrefersReducedMotion();

  const close = useCallback(() => onClose(), [onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClose={close} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Detalhes'}
            tabIndex={-1}
            className={cn(
              'fixed z-50 flex flex-col border-gold-500/20 bg-onyx-900/95 backdrop-blur-2xl',
              'inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl border-t',
              'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-l-3xl sm:rounded-tr-none sm:border-l sm:border-t-0',
              className
            )}
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* Alça visual do bottom-sheet — só faz sentido no celular. */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-onyx-600 sm:hidden" aria-hidden />

            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
              <div className="min-w-0">
                {title ? <h2 className="font-display text-2xl text-ivory">{title}</h2> : null}
                {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-onyx-800 hover:text-ivory"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

            {footer ? (
              <div className="border-t border-gold-500/15 bg-onyx-900/80 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Impede fechar clicando fora — usado em confirmações destrutivas. */
  persistent?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  persistent,
}: ModalProps) {
  const panelRef = useOverlayBehavior(open, onClose);
  const reduced = usePrefersReducedMotion();

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClose={persistent ? () => {} : onClose} />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === 'string' ? title : 'Diálogo'}
              tabIndex={-1}
              className={cn(
                'glass-strong flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden',
                className
              )}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_BRAND }}
            >
              <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
                <div className="min-w-0">
                  {title ? <h2 className="font-display text-2xl text-ivory">{title}</h2> : null}
                  {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-onyx-800 hover:text-ivory"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>

              {footer ? <div className="flex justify-end gap-2 px-6 pb-6 pt-2">{footer}</div> : null}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
