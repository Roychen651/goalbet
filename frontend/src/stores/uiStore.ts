import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface UIState {
  toasts: Toast[];
  activeModal: string | null;
  activePredictionMatchId: string | null;
  enableLiveAnimations: boolean;
  isSyncing: boolean;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  openPredictionModal: (matchId: string) => void;
  closePredictionModal: () => void;
  toggleLiveAnimations: () => void;
  setSyncing: (v: boolean) => void;
}

let toastCounter = 0;

const LIVE_ANIM_KEY = 'goalbet:liveAnimations';

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  activeModal: null,
  activePredictionMatchId: null,
  enableLiveAnimations: localStorage.getItem(LIVE_ANIM_KEY) !== 'false',
  isSyncing: false,
  setSyncing: (v) => set({ isSyncing: v }),

  addToast: (message, type = 'info') => {
    const id = `toast-${++toastCounter}`;
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),

  openPredictionModal: (matchId) => set({ activePredictionMatchId: matchId }),
  closePredictionModal: () => set({ activePredictionMatchId: null }),

  toggleLiveAnimations: () =>
    set(state => {
      const next = !state.enableLiveAnimations;
      localStorage.setItem(LIVE_ANIM_KEY, String(next));
      return { enableLiveAnimations: next };
    }),
}));
