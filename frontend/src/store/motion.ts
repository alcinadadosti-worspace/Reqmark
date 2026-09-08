/**
 * Preferencia de animacao.
 *
 * O padrao e `system`: o app obedece ao `prefers-reduced-motion` do aparelho,
 * como deve ser. O problema e o que acontece quando alguem tem essa opcao
 * ligada sem saber — no Windows ela mora em Acessibilidade > Efeitos visuais e
 * e facil desligar sem perceber. O app fica inteiro parado e nada explica o
 * porque; a pessoa conclui que o site esta quebrado.
 *
 * Entao aqui existe uma saida explicita, nos dois sentidos: `full` ignora o
 * sistema e anima mesmo assim, `reduced` desliga o movimento mesmo num sistema
 * que nao pediu nada. Quem nunca tocar no interruptor continua em `system`.
 *
 * Fica no `localStorage` (e nao no perfil da pessoa) porque e escolha do
 * aparelho: a mesma pessoa pode usar um desktop potente e um celular modesto.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MotionPreference = 'system' | 'full' | 'reduced';

interface MotionState {
  preference: MotionPreference;
  setPreference: (preference: MotionPreference) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'am:motion' }
  )
);
