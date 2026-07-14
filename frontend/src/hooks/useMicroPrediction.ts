import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useCoinsStore } from '../stores/coinsStore';

export interface MicroQuestion {
  id: string;
  match_id: string;
  group_id: string;
  milestone: 'kickoff' | 'halftime' | 'minute_75';
  question_type: string;
  status: 'open' | 'locked' | 'resolved' | 'canceled';
  expires_at: string;
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
      .select('id, match_id, group_id, milestone, question_type, status, expires_at, matches(home_team, away_team)')
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
      status: data.status, expires_at: data.expires_at,
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
