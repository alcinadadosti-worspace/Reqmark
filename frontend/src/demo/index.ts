/**
 * Modo demonstração.
 *
 * Liga quando:
 *   - `VITE_DEMO_MODE=true`, em qualquer ambiente; ou
 *   - estamos em desenvolvimento E o Firebase não foi configurado — assim
 *     `npm run dev` numa máquina nova mostra o app funcionando em vez de uma
 *     tela de erro.
 *
 * Com o Firebase configurado em produção, `isDemoMode()` é `false` e nada aqui
 * é executado.
 */
import { isConfigured, isDev } from '@/lib/env';

const FLAG = (import.meta.env.VITE_DEMO_MODE as string | undefined)?.trim() === 'true';

let warned = false;

export function isDemoMode(): boolean {
  const active = FLAG || (isDev && !isConfigured);

  if (active && !warned) {
    warned = true;
    console.info(
      '%c AM Marketing — modo demonstração ',
      'background:#CEA15C;color:#0B0B0D;font-weight:bold;border-radius:3px',
      '\nDados em memória, sem Firebase e sem backend. As alterações somem ao recarregar.' +
        '\nPara usar dados reais, preencha as variáveis VITE_FIREBASE_* em frontend/.env.local.'
    );
  }

  return active;
}

export { demoStore } from './store';
