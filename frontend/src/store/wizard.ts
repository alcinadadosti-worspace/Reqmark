/**
 * Estado do wizard de nova requisicao.
 *
 * Persistido em `sessionStorage`: recarregar a pagina no meio do preenchimento
 * nao pode perder o que a pessoa ja escolheu (secao 8.3). Ao enviar (ou ao
 * abrir um wizard novo de proposito) o estado e zerado.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CityRef, DayString } from '@/shared/types';

export interface WizardSelection {
  [itemId: string]: number;
}

interface WizardState {
  step: number;
  selection: WizardSelection;
  purposeType: string;
  purpose: string;
  city: CityRef | null;
  locationDetail: string;
  startDate: DayString | null;
  endDate: DayString | null;

  setStep: (step: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  toggleItem: (itemId: string) => void;
  setPurposeType: (purposeType: string) => void;
  setPurpose: (purpose: string) => void;
  setCity: (city: CityRef | null) => void;
  setLocationDetail: (detail: string) => void;
  setPeriod: (startDate: DayString | null, endDate: DayString | null) => void;
  reset: () => void;
}

const EMPTY = {
  step: 1,
  selection: {} as WizardSelection,
  purposeType: '',
  purpose: '',
  city: null,
  locationDetail: '',
  startDate: null,
  endDate: null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...EMPTY,

      setStep: (step) => set({ step }),

      setQuantity: (itemId, quantity) =>
        set((state) => {
          const selection = { ...state.selection };
          if (quantity <= 0) delete selection[itemId];
          else selection[itemId] = quantity;
          return { selection };
        }),

      toggleItem: (itemId) =>
        set((state) => {
          const selection = { ...state.selection };
          if (selection[itemId]) delete selection[itemId];
          else selection[itemId] = 1;
          return { selection };
        }),

      setPurposeType: (purposeType) => set({ purposeType }),
      setPurpose: (purpose) => set({ purpose }),
      setCity: (city) => set({ city }),
      setLocationDetail: (locationDetail) => set({ locationDetail }),
      setPeriod: (startDate, endDate) => set({ startDate, endDate }),

      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'am:wizard',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

/** Converte o mapa de selecao em linhas `{ itemId, quantity }`. */
export function selectionToLines(selection: WizardSelection): { itemId: string; quantity: number }[] {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}
