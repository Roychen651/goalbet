import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useCoinsStore } from '../stores/coinsStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import { haptic } from '../lib/haptics';

export interface MicroQuestion {
  id: string;
  match_id: string;
  group_id: string;
  milestone: 'kickoff' | 'halftime' | 'minute_75';
  question_type: string;
  status: 'open' | 'locked' | 'resolved' | 'canceled';
  expires_at: string;
  resolves_at: string | null;
  home_team?: string;
  away_team?: string;
}

interface MicroBet {
  id: string;
  choice: 'yes' | 'no';
}

/**
 * Surfaces the active group's current live micro-prediction question (if
 * any) and the caller's own bet on it. Realtime-subscribed so the banner
 * appears/disappears/locks live without polling — same group_id-filtered
 * postgres_changes idiom used everywhere else in this codebase.
 */
export function useMicroPrediction() {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const [question, setQuestion] = useState<MicroQuestion | null>(null);
  const [myBet, setMyBet] = useState<MicroBet | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchActive = useCallback(async () => {
    if (!activeGroupId) { setQuestion(null); return; }
    const { data } = await supabase
      .from('micro_prediction_questions')
      .select('id, match_id, group_id, milestone, question_type, status, expires_at, resolves_at, matches(home_team, away_team)')
      .eq('group_id', activeGroupId)
      .in('status', ['open', 'locked'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) { setQuestion(null); setMyBet(null); return; }
    const match = data.matches as unknown as { home_team?: string; away_team?: string } | null;
    setQuestion({
      id: data.id, match_id: data.match_id, group_id: data.group_id,
      milestone: data.milestone, question_type: data.question_type,
      status: data.status, expires_at: data.expires_at, resolves_at: data.resolves_at,
      home_team: match?.home_team, away_team: match?.away_team,
    });
  }, [activeGroupId]);

  const fetchMyBet = useCallback(async (questionId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('micro_prediction_bets')
      .select('id, choice')
      .eq('question_id', questionId)
      .eq('user_id', user.id)
      .maybeSingle();
    setMyBet(data as MicroBet | null);
  }, [user]);

  useEffect(() => { fetchActive(); }, [fetchActive]);
  useEffect(() => { if (question) fetchMyBet(question.id); else setMyBet(null); }, [question?.id, fetchMyBet]);

  useEffect(() => {
    if (!activeGroupId) return;
    const channel = supabase
      .channel(`micro-questions-${activeGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'micro_prediction_questions', filter: `group_id=eq.${activeGroupId}` },
        () => fetchActive(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, fetchActive]);

  // Resolution reveal — the question disappears the instant it flips to
  // 'resolved'/'canceled' (fetchActive only ever selects open/locked), so
  // without this the only sign a bet resolved is the top-bar coin count
  // silently changing. settleBets (backend) sets settled_at exactly once per
  // bet via its own atomic claim, so this row only ever receives ONE UPDATE
  // in its lifetime — no transition-detection against payload.old needed
  // (Realtime's `old` is PK-only anyway without REPLICA IDENTITY FULL, which
  // this table doesn't have). Silent on a genuine loss (is_winner === false)
  // — a loss toast every 10 minutes for every micro-bet would be noise, not
  // feedback, the same restraint the main prediction economy already applies.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`micro-bet-results-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'micro_prediction_bets', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { settled_at?: string | null; is_winner?: boolean | null; coins_staked?: number };
          if (!row.settled_at) return;
          // Read current language/toast-store state at fire time, not
          // subscription time — a stale closure here would show the toast in
          // whatever language was active minutes ago when the bet was placed.
          const { t } = useLangStore.getState();
          const { addToast } = useUIStore.getState();
          const stake = row.coins_staked ?? 2;
          if (row.is_winner === true) {
            haptic('success');
            addToast(t('momentumWonToast').replace('{0}', String(stake * 2)), 'success');
          } else if (row.is_winner === null) {
            addToast(t('momentumRefundToast').replace('{0}', String(stake)), 'info');
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const submitBet = useCallback(async (choice: 'yes' | 'no') => {
    if (!user || !activeGroupId || !question) return;
    setSubmitting(true);
    const coinsStore = useCoinsStore.getState();
    coinsStore.adjustCoins(-2); // optimistic guess — always exactly 2 coins
    try {
      const { data, error } = await supabase.rpc('submit_micro_prediction', {
        p_user_id: user.id,
        p_group_id: activeGroupId,
        p_question_id: question.id,
        p_choice: choice,
      });
      if (error) throw error;
      const result = data as { success: boolean; balance?: number; error?: string };
      // result.error is one of the RPC's own reason codes (question_closed,
      // already_bet, insufficient_coins, ...) — propagate it verbatim so the
      // UI can show *why*, not just "failed". A generic message here was
      // exactly what made a real live-match failure undiagnosable from a
      // screenshot alone.
      if (!result.success) throw new Error(result.error ?? 'submit_failed');

      if (result.balance != null) coinsStore.setCoins(result.balance);
      setMyBet({ id: 'optimistic', choice });
    } catch (err) {
      coinsStore.adjustCoins(2); // single rollback point — covers both a thrown RPC error and a {success:false} response
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [user, activeGroupId, question]);

  return { question, myBet, submitting, submitBet };
}
