import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface CoinsState {
  coins: number;
  loading: boolean;
  /** Fetch the current balance. */
  initCoins: (userId: string, groupId: string) => Promise<void>;
  /** Silently refresh balance from DB. */
  fetchCoins: (userId: string, groupId: string) => Promise<void>;
  /** Optimistic local adjustment (positive = add, negative = subtract). */
  adjustCoins: (delta: number) => void;
  /** Directly set the authoritative balance from an RPC response. */
  setCoins: (amount: number) => void;
}

export const useCoinsStore = create<CoinsState>((set) => ({
  coins: 0,
  loading: false,

  // The daily bonus is deposited server-side by pg_cron (V4 Sprint 12) — this
  // is now a plain balance fetch. The realtime subscription wired up alongside
  // this store's consumer (see the group_members/coin_transactions channels)
  // is what picks up a midnight deposit live, not this function re-running.
  initCoins: async (userId, groupId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('coins')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .single();

      if (!error && data) set({ coins: data.coins ?? 0 });
    } finally {
      set({ loading: false });
    }
  },

  fetchCoins: async (userId, groupId) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('coins')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();
    if (!error && data) set({ coins: data.coins ?? 0 });
  },

  adjustCoins: (delta) => set((state) => ({ coins: Math.max(0, state.coins + delta) })),

  setCoins: (amount) => set({ coins: amount }),
}));
