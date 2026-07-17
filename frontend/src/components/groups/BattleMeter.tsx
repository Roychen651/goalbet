// V5 Sprint 36 — "The Social Syndicate": Group Battles display card.
// Self-hides (returns null) when the active group has no pending/active
// battle — same "hidden until real data exists" convention SyndicatePoolCard
// follows. A 'pending' battle where the active group is the DEFENDER also
// surfaces Accept/Decline — the natural "respond" action, distinct from a
// full challenge-creation flow (out of scope here, same reasoning as
// SyndicatePoolCard's pool-creation deferral).
//
// No Realtime subscription — fetch on mount + refetch after responding
// only, matching SyndicatePoolCard's stated scope (RealtimeProvider's
// RealtimeTable union was not extended for group_battles this commit).

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGroupStore } from '../../stores/groupStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { GlassCard } from '../ui/GlassCard';

interface Battle {
  id: string;
  challenger_group_id: string;
  defender_group_id: string;
  status: 'pending' | 'active' | 'declined' | 'completed';
  challenger_score: number | null;
  defender_score: number | null;
  challenger: { name: string } | null;
  defender: { name: string } | null;
}

export function BattleMeter() {
  const { activeGroupId } = useGroupStore();
  const { t, lang } = useLangStore();
  const { addToast } = useUIStore();
  const isHe = lang === 'he';

  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const fetchBattle = useCallback(async () => {
    if (!activeGroupId) { setBattle(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('group_battles')
        .select(
          'id, challenger_group_id, defender_group_id, status, challenger_score, defender_score, ' +
          'challenger:groups!group_battles_challenger_group_id_fkey(name), ' +
          'defender:groups!group_battles_defender_group_id_fkey(name)',
        )
        .or(`challenger_group_id.eq.${activeGroupId},defender_group_id.eq.${activeGroupId}`)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setBattle(data as unknown as Battle | null);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => { fetchBattle(); }, [fetchBattle]);

  const respond = useCallback(async (accept: boolean) => {
    if (!battle || responding) return;
    setResponding(true);
    try {
      const { data, error } = await supabase.rpc('respond_to_battle', {
        p_battle_id: battle.id,
        p_accept: accept,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        addToast(t('battleErrorGeneric'), 'error');
        return;
      }
      haptic(accept ? 'success' : 'light');
      playSound(accept ? 'lock_thud' : 'toggle_click');
      addToast(t(accept ? 'battleAccepted' : 'battleDeclined'), accept ? 'success' : 'info');
      await fetchBattle();
    } catch {
      addToast(t('battleErrorGeneric'), 'error');
    } finally {
      setResponding(false);
    }
  }, [battle, responding, addToast, t, fetchBattle]);

  if (loading || !battle) return null;

  const isDefender = battle.defender_group_id === activeGroupId;
  const isPending = battle.status === 'pending';
  const challengerScore = battle.challenger_score ?? 0;
  const defenderScore = battle.defender_score ?? 0;
  const total = challengerScore + defenderScore;
  const challengerPct = total > 0 ? (challengerScore / total) * 100 : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      className="mb-4"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <GlassCard variant="elevated" grain edgeGradient contentClassName="flex flex-col gap-3" className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[color:var(--battle-challenger)]/15 flex items-center justify-center shrink-0">
            <Swords size={16} style={{ color: 'var(--battle-challenger)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bebas">
              {t('battleTitle')}
            </div>
            <div className="text-sm font-semibold text-text-primary truncate">
              {battle.challenger?.name ?? '?'} {isHe ? 'נגד' : 'vs'} {battle.defender?.name ?? '?'}
            </div>
          </div>
        </div>

        {isPending ? (
          isDefender ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-text-muted">{t('battlePendingChallenge')}</p>
              <button
                type="button"
                onClick={() => respond(false)}
                disabled={responding}
                className="h-8 px-3 rounded-lg text-xs font-semibold border border-white/10 text-text-primary/70 disabled:opacity-50 active:scale-95 transition-transform"
              >
                {t('battleDecline')}
              </button>
              <button
                type="button"
                onClick={() => respond(true)}
                disabled={responding}
                className="h-8 px-3 rounded-lg text-xs font-bold bg-accent-green text-bg-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {t('battleAccept')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-muted">{t('battleAwaitingResponse')}</p>
          )
        ) : (
          <div>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
              <span style={{ color: 'var(--battle-challenger)' }}>{challengerScore.toFixed(1)}</span>
              <span style={{ color: 'var(--battle-defender)' }}>{defenderScore.toFixed(1)}</span>
            </div>
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/5">
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${challengerPct}%`, background: 'var(--battle-challenger)' }}
              />
              <div
                className="h-full flex-1 transition-[width] duration-500"
                style={{ background: 'var(--battle-defender)' }}
              />
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
