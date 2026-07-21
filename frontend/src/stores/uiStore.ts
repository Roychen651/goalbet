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
  // V6 Sprint 47 Commit 3 — same shape as activePredictionMatchId: a
  // single global "which match's drawer is open" id, rendered once at
  // HomePage.tsx's level (not nested per-MatchCard-instance) so the
  // drawer's own `fixed inset-0` overlay is never a descendant of a
  // transformed ancestor (a card's own hover/expand transform would
  // otherwise break its containing-block math per the CSS spec — the
  // same reasoning PredictionModal's existing top-level render already
  // established this pattern for).
  activeDuelMatchId: string | null;
  enableLiveAnimations: boolean;
  isSyncing: boolean;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  openPredictionModal: (matchId: string) => void;
  closePredictionModal: () => void;
  openDuelDrawer: (matchId: string) => void;
  closeDuelDrawer: () => void;
  toggleLiveAnimations: () => void;
  setSyncing: (v: boolean) => void;
}

let toastCounter = 0;

const LIVE_ANIM_KEY = 'goalbet:liveAnimations';

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  activeModal: null,
  activePredictionMatchId: null,
  activeDuelMatchId: null,
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

  openDuelDrawer: (matchId) => set({ activeDuelMatchId: matchId }),
  closeDuelDrawer: () => set({ activeDuelMatchId: null }),

  toggleLiveAnimations: () =>
    set(state => {
      const next = !state.enableLiveAnimations;
      localStorage.setItem(LIVE_ANIM_KEY, String(next));
      return { enableLiveAnimations: next };
    }),
}));
