// V5 Sprint 36 — "The Social Syndicate": Cooperative Pool display + contribute
// card. Deliberately scoped to an EXISTING open pool only — the same
// "hidden until real data exists" convention already established for
// MatchTimeline/AIScoutCard/PulseFeed/HallOfFameChronicles (returns null,
// never a placeholder). Pool CREATION is a separate, out-of-scope surface —
// create_syndicate_pool() is fully live (Commit 1) and callable today, but
// building its own picker UI is real, separate scope this commit doesn't
// try to also cover; this component's job is showing a pool that already
// exists and letting the group pile coins into it.
//
// No Realtime subscription — RealtimeProvider's RealtimeTable union
// (CLAUDE.md §50) deliberately was not extended for syndicate_pools/
// pool_contributions in this commit (out of scope, stated plainly rather
// than silently omitted). This fetches once on mount and refetches only
// after its own successful contribution — the same "fetch on mount +
// refetch after own mutation" shape BentoArena/H2HMatrix already use for
// data that isn't wired to live Realtime.

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { GlassCard } from '../ui/GlassCard';
import { CoinIcon } from '../ui/CoinIcon';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { DEBOSS_SHADOW } from '../../lib/tierVisuals';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

interface PoolMatch {
  home_team: string;
  away_team: string;
  home_team_badge: string | null;
  away_team_badge: string | null;
}

interface TargetPrediction {
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_corners: 'under9' | 'ten' | 'over11' | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
}

interface Pool {
  id: string;
  match_id: string;
  total_staked: number;
  target_prediction: TargetPrediction;
  matches: PoolMatch | null;
}

interface Contributor {
  id: string;
  user_id: string;
  amount: number;
  username: string;
}

// Cycled per-contributor segment color — reuses the same 5-hue family
// TIER_COLORS already established for tactile chips, without importing its
// selection/emboss semantics (a contributor bar isn't a tier picker).
const SEGMENT_COLORS = ['bg-emerald-400', 'bg-yellow-400', 'bg-blue-400', 'bg-orange-400', 'bg-purple-400'];

const STEP = 5;
const MIN_STAKE = 5;

const ERROR_KEY: Record<string, TranslationKey> = {
  pool_closed: 'poolErrorClosed',
  insufficient_coins: 'poolErrorInsufficientCoins',
  invalid_amount: 'poolErrorInvalidAmount',
  pool_not_found: 'poolErrorGeneric',
  member_not_found: 'poolErrorGeneric',
};

function outcomeLabel(outcome: TargetPrediction['predicted_outcome'], isHe: boolean): string {
  if (outcome === 'H') return isHe ? 'ניצחון בית' : 'Home Win';
  if (outcome === 'D') return isHe ? 'תיקו' : 'Draw';
  if (outcome === 'A') return isHe ? 'ניצחון חוץ' : 'Away Win';
  return '';
}

export function SyndicatePoolCard() {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { t, lang } = useLangStore();
  const { addToast } = useUIStore();
  const coinsStore = useCoinsStore();
  const isHe = lang === 'he';

  const [pool, setPool] = useState<Pool | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [myStake, setMyStake] = useState(0);
  const [stakeInput, setStakeInput] = useState(MIN_STAKE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchPool = useCallback(async () => {
    if (!activeGroupId) { setPool(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('syndicate_pools')
        .select('id, match_id, total_staked, target_prediction, matches(home_team, away_team, home_team_badge, away_team_badge)')
        .eq('group_id', activeGroupId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) { setPool(null); setContributors([]); return; }
      const row = data as unknown as Pool;
      setPool(row);

      const { data: contribData } = await supabase
        .from('pool_contributions')
        .select('id, user_id, amount, profiles(username)')
        .eq('pool_id', row.id)
        .order('amount', { ascending: false });

      const mapped: Contributor[] = (contribData ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        user_id: c.user_id as string,
        amount: c.amount as number,
        username: (c.profiles as { username?: string } | null)?.username ?? '?',
      }));
      setContributors(mapped);
      const mine = mapped.find((c) => c.user_id === user?.id);
      setMyStake(mine?.amount ?? 0);
      setStakeInput(mine?.amount ?? MIN_STAKE);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, user?.id]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const contribute = useCallback(async () => {
    if (!pool || submitting) return;
    setSubmitting(true);
    haptic('selection');
    playSound('toggle_click');
    try {
      const { data, error } = await supabase.rpc('contribute_to_pool', {
        p_pool_id: pool.id,
        p_amount: stakeInput,
      });
      if (error) throw error;
      const result = data as { success: boolean; balance?: number; total_staked?: number; error?: string };
      if (!result.success) {
        const key = ERROR_KEY[result.error ?? ''] ?? 'poolErrorGeneric';
        addToast(t(key), 'error');
        return;
      }
      if (result.balance != null) coinsStore.setCoins(result.balance);
      haptic('coin_roll');
      playSound('coin_chime');
      addToast(t('poolContributeSuccess'), 'success');
      await fetchPool();
    } catch {
      addToast(t('poolErrorGeneric'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [pool, stakeInput, submitting, addToast, t, coinsStore, fetchPool]);

  if (loading || !pool) return null;

  const match = pool.matches;
  const homeTeamEn = match?.home_team ?? '';
  const awayTeamEn = match?.away_team ?? '';
  const homeTeam = isHe && homeTeamEn ? tTeam(homeTeamEn) : homeTeamEn;
  const awayTeam = isHe && awayTeamEn ? tTeam(awayTeamEn) : awayTeamEn;
  const target = pool.target_prediction;

  const targetChips: string[] = [];
  if (target.predicted_outcome) targetChips.push(outcomeLabel(target.predicted_outcome, isHe));
  if (target.predicted_home_score != null && target.predicted_away_score != null) {
    targetChips.push(`${target.predicted_home_score}–${target.predicted_away_score}`);
  }
  if (target.predicted_btts != null) {
    targetChips.push(`BTTS ${target.predicted_btts ? (isHe ? 'כן' : 'Yes') : (isHe ? 'לא' : 'No')}`);
  }
  if (target.predicted_over_under) {
    targetChips.push(target.predicted_over_under === 'over' ? 'O2.5' : 'U2.5');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      className="mb-4"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <GlassCard variant="elevated" grain edgeGradient contentClassName="flex flex-col gap-3" className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent-green/15 flex items-center justify-center shrink-0">
            <Users size={16} className="text-accent-green" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bebas">
              {t('poolTitle')}
            </div>
            {homeTeam && awayTeam && (
              <div className="text-sm font-semibold text-text-primary truncate">
                {homeTeam} {isHe ? 'נגד' : 'vs'} {awayTeam}
              </div>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="flex items-center gap-1 text-lg font-mono font-bold tabular-nums text-amber-400">
              <CoinIcon size={16} />
              <NumberFlow value={pool.total_staked} />
            </div>
            <div className="text-[10px] text-text-muted">{t('poolTotalStaked')}</div>
          </div>
        </div>

        {/* Target prediction chips */}
        {targetChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {targetChips.map((label) => (
              <span
                key={label}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-accent-green/10 text-accent-green border-accent-green/20"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Proportional contributor bar — segments, not a false "goal"
            progress bar, since no target amount exists anywhere in this
            schema (rule: a ratio visual's denominator must actually mean
            something, §34's Risk Meter lesson). */}
        {contributors.length > 0 && (
          <div>
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5">
              {contributors.map((c, i) => (
                <div
                  key={c.id}
                  className={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                  style={{ width: `${(c.amount / pool.total_staked) * 100}%` }}
                  title={`${c.username}: ${c.amount}`}
                />
              ))}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              {t('poolContributorsCount').replace('{0}', String(contributors.length))}
            </div>
          </div>
        )}

        {/* Contribute stepper */}
        <div className="flex items-center gap-2 pt-1">
          <div className={cn('flex items-center rounded-xl overflow-hidden', DEBOSS_SHADOW)}>
            <button
              type="button"
              onClick={() => { setStakeInput((v) => Math.max(MIN_STAKE, v - STEP)); haptic('selection'); }}
              className="w-9 h-9 flex items-center justify-center text-text-primary/70 font-bold text-lg active:scale-95 transition-transform"
              aria-label={t('poolDecreaseStake')}
            >
              −
            </button>
            <div className="w-12 text-center font-mono font-bold tabular-nums text-text-primary">
              {stakeInput}
            </div>
            <button
              type="button"
              onClick={() => { setStakeInput((v) => v + STEP); haptic('selection'); }}
              className="w-9 h-9 flex items-center justify-center text-text-primary/70 font-bold text-lg active:scale-95 transition-transform"
              aria-label={t('poolIncreaseStake')}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={contribute}
            disabled={submitting}
            className="flex-1 h-9 rounded-xl bg-accent-green text-bg-base font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {myStake > 0 ? t('poolUpdateStake') : t('poolJoinPool')}
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
