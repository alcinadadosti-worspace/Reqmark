import { Suspense, lazy } from 'react';
import { useAllowsHeavyVisuals } from '@/hooks/useMediaQuery';

/**
 * Fundo WebGL da tela de identidade.
 *
 * `Aurora` (React Bits, via `ogl`) chega em um chunk separado e só é baixado
 * quando a máquina aguenta — sob `prefers-reduced-motion`, em telas pequenas ou
 * em aparelhos modestos ninguém paga por ele. O gradiente CSS abaixo é o
 * fallback e também o que aparece enquanto o chunk carrega, então a tela nunca
 * fica preta.
 *
 * Aurora usa três paradas de cor do dourado da marca sobre o onyx.
 */
const Aurora = lazy(() => import('@/components/reactbits/Aurora/Aurora'));

export function AuroraBackdrop() {
  const heavy = useAllowsHeavyVisuals();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Fallback estático: gradiente dourado difuso sobre o onyx. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 78% at 50% 0%, rgba(226,185,111,0.20), transparent 62%),' +
            'radial-gradient(90% 60% at 12% 8%, rgba(165,121,61,0.14), transparent 60%),' +
            'radial-gradient(80% 55% at 88% 4%, rgba(243,210,140,0.10), transparent 58%)',
        }}
      />

      {heavy ? (
        <Suspense fallback={null}>
          <div className="absolute inset-x-0 top-0 h-[70vh] opacity-70">
            <Aurora colorStops={['#7E5C2C', '#F3D28C', '#A5793D']} amplitude={0.9} blend={0.55} speed={0.6} />
          </div>
        </Suspense>
      ) : null}

      {/* Apaga a base do fundo para o conteúdo respirar. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-onyx-fade" />
    </div>
  );
}
