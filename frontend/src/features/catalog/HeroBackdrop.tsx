import { Suspense, lazy } from 'react';
import { useAllowsHeavyVisuals } from '@/hooks/useMediaQuery';

/**
 * Raios de luz atrás do cabeçalho da home (React Bits `LightRays`, via `ogl`).
 *
 * Mesmo tratamento do fundo da tela de identidade: chunk separado, só carrega
 * quando a máquina aguenta, e o gradiente CSS embaixo é o fallback.
 */
const LightRays = lazy(() => import('@/components/reactbits/LightRays/LightRays'));

export function HeroBackdrop() {
  const heavy = useAllowsHeavyVisuals();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 130% at 50% -30%, rgba(226,185,111,0.16), transparent 60%)',
        }}
      />

      {heavy ? (
        <Suspense fallback={null}>
          <div className="absolute inset-0 opacity-60">
            <LightRays
              raysOrigin="top-center"
              raysColor="#F3D28C"
              raysSpeed={0.65}
              lightSpread={1.1}
              rayLength={1.5}
              fadeDistance={1.1}
              saturation={0.85}
              followMouse={false}
              noiseAmount={0.05}
              distortion={0.03}
            />
          </div>
        </Suspense>
      ) : null}
    </div>
  );
}
