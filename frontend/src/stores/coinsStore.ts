import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUIStore } from './uiStore';

interface CoinsState {
  coins: number;
  loading: boolean;
  /** Fetch balance + claim daily bonus. Shows toast if bonus was awarded. */
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

  initCoins: async (userId, groupId) => {
    set({ loading: true });
    try {
      // Claim daily bonus first (idempotent — safe to call every app load)
      const { data: bonusData, error: bonusErr } = await supabase.rpc('claim_daily_bonus', {
        p_user_id: userId,
        p_group_id: groupId,
      });

      if (!bonusErr && bonusData) {
        const result = bonusData as { awarded: boolean; amount: number; balance: number };
        set({ coins: result.balance, loading: false });
        if (result.awarded) {
          useUIStore.getState().addToast(`+${result.amount} coins — daily bonus!`, 'success');
        }
        return;
      }

      // Fallback: just fetch the balance directly
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
