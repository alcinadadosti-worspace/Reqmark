import { Suspense, lazy } from 'react';
import { useIsTouch, usePrefersReducedMotion } from '@/hooks/useMediaQuery';

/**
 * Cursor de mira dourado (React Bits `TargetCursor`).
 *
 * Só no desktop e desligável pelo menu (seção 5). É carregado sob demanda
 * porque puxa o gsap; no toque e sob `prefers-reduced-motion` nem chega a ser
 * baixado. O componente restaura o cursor original ao desmontar, então alternar
 * a preferência é seguro.
 */
const TargetCursor = lazy(() => import('@/components/reactbits/TargetCursor/TargetCursor'));

export function CursorLayer({ enabled }: { enabled: boolean }) {
  const isTouch = useIsTouch();
  const reduced = usePrefersReducedMotion();

  if (!enabled || isTouch || reduced) return null;

  return (
    <Suspense fallback={null}>
      <TargetCursor
        targetSelector='button, a[href], [role="button"], .cursor-target'
        cursorColor="#CEA15C"
        cursorColorOnTarget="#F3D28C"
        spinDuration={8}
        hideDefaultCursor
      />
    </Suspense>
  );
}
