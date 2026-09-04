import { useCallback, useState } from 'react';

const STORAGE_KEY = 'am:target-cursor';

/**
 * Preferência do cursor customizado (desktop).
 *
 * Fica no `localStorage` porque é uma escolha do aparelho, não da pessoa — a
 * mesma conta pode usar um desktop e um celular. Vem ligado por padrão, mas o
 * `CursorLayer` ainda o desliga sozinho no toque e sob `prefers-reduced-motion`.
 */
export function useCursorPreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      // Aba anônima ou site data bloqueado: segue com o padrão.
      return true;
    }
  });

  const update = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* preferência vale só para esta sessão */
    }
  }, []);

  return [enabled, update];
}
