/**
 * Quem esta usando o app.
 *
 * Sem cadastro nem senha (restricao 3): a pessoa escolhe o nome numa lista e a
 * escolha fica no `localStorage`. Apenas a administradora precisa de PIN, e o
 * "destravamento" dela vive no `sessionStorage` junto do token (some ao fechar
 * a aba, de proposito).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/shared/types';
import { clearAdminToken } from '@/lib/api';

export interface Identity {
  slackId: string;
  name: string;
  role: UserRole;
}

interface IdentityState {
  identity: Identity | null;
  /** `true` depois que o PIN foi validado pelo backend nesta aba. */
  adminUnlocked: boolean;
  setIdentity: (identity: Identity) => void;
  unlockAdmin: () => void;
  lockAdmin: () => void;
  signOut: () => void;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      identity: null,
      adminUnlocked: false,

      setIdentity: (identity) => set({ identity, adminUnlocked: false }),

      unlockAdmin: () => set({ adminUnlocked: true }),

      lockAdmin: () => {
        clearAdminToken();
        set({ adminUnlocked: false });
      },

      signOut: () => {
        clearAdminToken();
        set({ identity: null, adminUnlocked: false });
      },
    }),
    {
      name: 'am:identity',
      // `adminUnlocked` fica de fora: o PIN e revalidado a cada sessao.
      partialize: (state) => ({ identity: state.identity }),
    }
  )
);

/** Atalho de leitura para fora de componentes React. */
export function currentIdentity(): Identity | null {
  return useIdentityStore.getState().identity;
}
