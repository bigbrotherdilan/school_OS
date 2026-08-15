import { create } from 'zustand';

interface BackNavState {
  backHandler: (() => void) | null;
  setBackHandler: (handler: (() => void) | null) => void;
}

export const useBackNavStore = create<BackNavState>((set) => ({
  backHandler: null,
  setBackHandler: (handler) => set({ backHandler: handler }),
}));
