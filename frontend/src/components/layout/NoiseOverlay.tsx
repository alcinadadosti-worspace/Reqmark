import Noise from '@/components/reactbits/Noise/Noise';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

/**
 * Ruído fino sobre o fundo (React Bits `Noise`).
 *
 * Tira o aspecto "plástico" do preto chapado e dá textura de papel escuro ao
 * vidro. Alpha baixíssimo e refresh lento: praticamente de graça. Desligado sob
 * `prefers-reduced-motion`, onde o canvas ficaria repintando sem necessidade.
 */
export function NoiseOverlay() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-soft-light" aria-hidden>
      <Noise patternSize={220} patternAlpha={13} patternRefreshInterval={4} />
    </div>
  );
}
