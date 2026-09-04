import { useEffect, useState } from 'react';

/** Assina uma media query e reage a mudancas (rotacao, redimensionamento). */
export function useMediaQuery(queryText: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(queryText).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(queryText);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [queryText]);

  return matches;
}

/** `true` quando a pessoa pediu menos movimento no sistema. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** Toque como entrada principal — desliga hover, cursor custom e tilt. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none), (pointer: coarse)');
}

/**
 * Vale a pena gastar WebGL nesta maquina?
 * Combina `prefers-reduced-motion`, tamanho de tela e nucleos disponiveis —
 * um celular modesto nao deve pagar por um fundo animado.
 */
export function useAllowsHeavyVisuals(): boolean {
  const reduced = usePrefersReducedMotion();
  const isSmall = useMediaQuery('(max-width: 480px)');

  const [capable] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    return cores >= 4 && memory >= 4;
  });

  return !reduced && !isSmall && capable;
}
