import { TranslationKey } from '../lib/i18n';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { streakTierColor } from '../lib/oklch';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { useCoinsStore } from '../stores/coinsStore';
import { supabase, Prediction, Match } from '../lib/supabase';
import { Avatar } from '../components/ui/Avatar';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { MatchStatusBadge } from '../components/matches/MatchStatusBadge';
import { PredictionForm, PredictionData } from '../components/matches/PredictionForm';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { ProfileBentoV2 } from '../components/profile/ProfileBentoV2';
import { FormBars } from '../components/ui/FormBars';
import { HallOfFameChronicles } from '../components/profile/HallOfFameChronicles';
import { ShareableRecapCard } from '../components/profile/ShareableRecapCard';
import { formatKickoffTime, isMatchLocked, calcBreakdown } from '../lib/utils';
import { LIVE_STATUSES, FINISHED_STATUSES, calcPredictionCost, COIN_COSTS } from '../lib/constants';
import { InfoTip } from '../components/ui/InfoTip';
import { CoinIcon } from '../components/ui/CoinIcon';
import { RiskRadarChart, RadarAxisDatum } from '../components/profile/RiskRadarChart';

interface PredictionWithMatch extends Prediction {
  match: Match;
}

// Sprint 22 — per-tier breathing intensity for the avatar halo. Bronze reads
// "muted/carbon" (slow, low amplitude), silver reads "frozen/crisp" (a touch
// brighter, still calm), ember reads "pulsating flame" (fast, high
// amplitude) — the animation itself sells the tier, not just the color.
const HALO_MOTION: Record<'bronze' | 'silver' | 'ember', {
  opacity: [number, number, number];
  scale: [number, number, number];
  duration: number;
  staticOpacity: number;
}> = {
  bronze: { opacity: [0.25, 0.4, 0.25], scale: [1, 1.05, 1], duration: 4, staticOpacity: 0.32 },
  silver: { opacity: [0.35, 0.55, 0.35], scale: [1, 1.07, 1], duration: 3.2, staticOpacity: 0.42 },
  ember:  { opacity: [0.45, 0.8, 0.45], scale: [1, 1.15, 1], duration: 1.8, staticOpacity: 0.55 },
};

export function ProfilePage() {
  const { user, profile, signOut, updateUsername } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const reduceMotion = useReducedMotion();
  const [history, setHistory] = useState<PredictionWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const fetchHistory = () => {
    if (!user || !activeGroupId) return;
    supabase
      .from('predictions')
      .select('*, match:matches(*)')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory((data as PredictionWithMatch[]) || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, activeGroupId]);

  // Sprint 22 — the one genuinely new query the Risk Profile radar needs.
  // Every other axis (accuracy, boldness, specialist, volatility) is
  // derivable from `history` above (already fetched, zero extra cost);
  // Momentum Bets participation isn't covered by that fetch (a different
  // table, `micro_prediction_bets`) and isn't aggregated anywhere else in
  // the app, so this is a single head:true count — no row data transferred.
  const [momentumBetCount, setMomentumBetCount] = useState(0);
  useEffect(() => {
    if (!user || !activeGroupId) return;
    supabase
      .from('micro_prediction_bets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .then(({ count }) => setMomentumBetCount(count ?? 0));
  }, [user?.id, activeGroupId]);


  const handleSavePrediction = async (data: PredictionData, predictionId: string) => {
    if (!user || !activeGroupId) return;
    setSaving(predictionId);
    try {
      const existing = history.find(p => p.match_id === data.match_id);
      const oldCost = existing?.coins_bet ?? 0;
      const optimisticCost = calcPredictionCost(data);
      const coinsStore = useCoinsStore.getState();

      // Optimistic guess — instant UI feedback, corrected below by the RPC's
      // authoritative response (mirrors the usePredictions.ts pattern).
      coinsStore.adjustCoins(-(optimisticCost - oldCost));

      const { data: coinResult, error } = await supabase.rpc('submit_prediction', {
        p_user_id: user.id,
        p_group_id: activeGroupId,
        p_match_id: data.match_id,
        p_predicted_outcome: data.predicted_outcome,
        p_predicted_home_score: data.predicted_home_score,
        p_predicted_away_score: data.predicted_away_score,
        p_predicted_corners: data.predicted_corners,
        p_predicted_btts: data.predicted_btts,
        p_predicted_over_under: data.predicted_over_under,
      });

      if (error) {
        coinsStore.adjustCoins(optimisticCost - oldCost); // roll back the optimistic guess
        throw error;
      }
      const result = coinResult as { success: boolean; balance?: number; error?: string } | null;
      if (!result?.success) {
        coinsStore.adjustCoins(optimisticCost - oldCost);
        throw new Error(result?.error ?? 'Prediction submission failed');
      }
      if (result.balance != null) coinsStore.setCoins(result.balance);

      fetchHistory();
    } finally {
      setSaving(null);
    }
  };

  const handleDeletePrediction = async (predictionId: string) => {
    setDeleting(predictionId);
    try {
      // Refund staked coins only for unresolved predictions.
      // If the match already finished and prediction was scored, the bet is settled — no refund.
      const pred = history.find(p => p.id === predictionId);
      if (pred && user && activeGroupId && (pred.coins_bet ?? 0) > 0 && !pred.is_resolved) {
        const coinsStore = useCoinsStore.getState();
        coinsStore.adjustCoins(pred.coins_bet); // optimistic
        const { data: refundResult, error } = await supabase.rpc('refund_prediction', {
          p_user_id: user.id,
          p_group_id: activeGroupId,
          p_match_id: pred.match_id,
        });
        if (error) {
          coinsStore.adjustCoins(-pred.coins_bet); // roll back
          throw error;
        }
        const result = refundResult as { success: boolean; balance?: number } | null;
        if (result?.balance != null) coinsStore.setCoins(result.balance);
      }
      await supabase.from('predictions').delete().eq('id', predictionId);
      setConfirmDeleteId(null);
      fetchHistory();
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await updateUsername(nameInput.trim());
      setEditingName(false);
    } catch {
      // silent
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  if (!profile) return <PageLoader />;

  const resolved = history.filter(p => p.is_resolved);
  const totalPoints = resolved.reduce((sum, p) => sum + p.points_earned, 0);

  // Hit rate: only FT Result predictions (predicted_outcome must be set, match must be FT)
  const ftPredictions = resolved.filter(p => p.match.status === 'FT' && p.predicted_outcome !== null);
  const ftCorrect = ftPredictions.filter(p => {
    const actual = p.match.home_score! > p.match.away_score! ? 'H' : p.match.home_score! < p.match.away_score! ? 'A' : 'D';
    return (p.predicted_outcome as string) === actual;
  });

  // ── Personal Analytics ────────────────────────────────────────────────────
  const ftResolved = resolved.filter(p => p.match.status === 'FT');

  // ── Card 1: Best Tier ─────────────────────────────────────────────────────
  // For each prediction tier, count attempts and hits on finished matches.
  // Minimum 3 attempts per tier before surfacing it (avoids misleading 100% from 1 try).
  const tierStats = {
    result:  { bet: 0, won: 0 },
    score:   { bet: 0, won: 0 },
    corners: { bet: 0, won: 0 },
    btts:    { bet: 0, won: 0 },
    ou:      { bet: 0, won: 0 },
  };
  for (const p of ftResolved) {
    const m = p.match;
    const sH = (m as unknown as { regulation_home: number | null }).regulation_home ?? m.home_score!;
    const sA = (m as unknown as { regulation_away: number | null }).regulation_away ?? m.away_score!;
    const outcome = sH > sA ? 'H' : sH < sA ? 'A' : 'D';
    const btts = sH > 0 && sA > 0;
    const corners = (m as unknown as { corners_total: number | null }).corners_total;

    if (p.predicted_outcome !== null) {
      tierStats.result.bet++;
      if (p.predicted_outcome === outcome) tierStats.result.won++;
    }
    if (p.predicted_home_score !== null && p.predicted_away_score !== null) {
      tierStats.score.bet++;
      if (p.predicted_home_score === sH && p.predicted_away_score === sA) tierStats.score.won++;
    }
    if (p.predicted_corners !== null && corners !== null) {
      const bucket = corners <= 9 ? 'under9' : corners === 10 ? 'ten' : 'over11';
      tierStats.corners.bet++;
      if (p.predicted_corners === bucket) tierStats.corners.won++;
    }
    if (p.predicted_btts !== null) {
      tierStats.btts.bet++;
      if (p.predicted_btts === btts) tierStats.btts.won++;
    }
    if (p.predicted_over_under !== null) {
      tierStats.ou.bet++;
      if ((p.predicted_over_under === 'over') === ((sH + sA) > 2.5)) tierStats.ou.won++;
    }
  }

  type TierKey = keyof typeof tierStats;
  const TIER_LABELS: Record<TierKey, TranslationKey> = {
    result: 'tierResult', score: 'tierScore', corners: 'tierCorners', btts: 'tierBTTS', ou: 'tierOU',
  };
  const TIER_ICONS: Record<TierKey, string> = {
    result: '🎯', score: '🔢', corners: '🚩', btts: '⚽', ou: '📊',
  };
  let bestTierKey: TierKey | null = null;
  let bestTierRate = -1;
  for (const [key, stat] of Object.entries(tierStats) as [TierKey, { bet: number; won: number }][]) {
    if (stat.bet < 3) continue;
    const rate = stat.won / stat.bet;
    if (rate > bestTierRate) { bestTierRate = rate; bestTierKey = key; }
  }
  const bestTierStat = bestTierKey ? tierStats[bestTierKey] : null;

  // ── Card 2: Score Precision ───────────────────────────────────────────────
  // "How many goals off is your score prediction on average?"
  // Only uses predictions where the user actually predicted the score.
  // avg_diff = mean of (|pred_home − actual_home| + |pred_away − actual_away|)
  // This is purely from the prediction+match data — no coin fields involved.
  const scorePreds = ftResolved.filter(
    p => p.predicted_home_score !== null && p.predicted_away_score !== null,
  );
  const avgGoalsDiff = scorePreds.length > 0
    ? scorePreds.reduce((sum, p) => {
        const sH = (p.match as unknown as { regulation_home: number | null }).regulation_home ?? p.match.home_score!;
        const sA = (p.match as unknown as { regulation_away: number | null }).regulation_away ?? p.match.away_score!;
        return sum + Math.abs(p.predicted_home_score! - sH) + Math.abs(p.predicted_away_score! - sA);
      }, 0) / scorePreds.length
    : null;
  const exactScoreCount = scorePreds.filter(p => {
    const sH = (p.match as unknown as { regulation_home: number | null }).regulation_home ?? p.match.home_score!;
    const sA = (p.match as unknown as { regulation_away: number | null }).regulation_away ?? p.match.away_score!;
    return p.predicted_home_score === sH && p.predicted_away_score === sA;
  }).length;
  // Precision colour: sharp (avg < 1.0) → green, decent (< 2.0) → amber, rough → muted
  const precisionColor = avgGoalsDiff === null ? 'text-amber-400'
    : avgGoalsDiff < 1.0 ? 'text-accent-green'
    : avgGoalsDiff < 2.0 ? 'text-amber-400'
    : 'text-white/50';

  // ── Card 3: Recent Form ───────────────────────────────────────────────────
  // Last 5 FT matches where the user predicted the full-time result (H/D/A).
  // Sorted from oldest→newest so dots read left-to-right chronologically.
  // Also computes the current correct-result streak (consecutive from most recent).
  const resultPreds = ftResolved
    .filter(p => p.predicted_outcome !== null)
    .sort((a, b) => new Date(a.match.kickoff_time).getTime() - new Date(b.match.kickoff_time).getTime());

  const last5 = resultPreds.slice(-5).map(p => {
    const sH = (p.match as unknown as { regulation_home: number | null }).regulation_home ?? p.match.home_score!;
    const sA = (p.match as unknown as { regulation_away: number | null }).regulation_away ?? p.match.away_score!;
    const actual = sH > sA ? 'H' : sH < sA ? 'A' : 'D';
    return p.predicted_outcome === actual;
  });

  // Current streak: count consecutive correct from the most recent prediction backwards
  let currentStreak = 0;
  for (let i = resultPreds.length - 1; i >= 0; i--) {
    const p = resultPreds[i];
    const sH = (p.match as unknown as { regulation_home: number | null }).regulation_home ?? p.match.home_score!;
    const sA = (p.match as unknown as { regulation_away: number | null }).regulation_away ?? p.match.away_score!;
    const actual = sH > sA ? 'H' : sH < sA ? 'A' : 'D';
    if (p.predicted_outcome === actual) currentStreak++;
    else break;
  }
  const last5Correct = last5.filter(Boolean).length;

  // Form series — last 10 result predictions as {pts, correct} for FormBars
  // (magnitude + outcome). Reuses resultPreds (already chronological).
  const formSeries = resultPreds.slice(-10).map(p => {
    const sH = (p.match as unknown as { regulation_home: number | null }).regulation_home ?? p.match.home_score!;
    const sA = (p.match as unknown as { regulation_away: number | null }).regulation_away ?? p.match.away_score!;
    const actual = sH > sA ? 'H' : sH < sA ? 'A' : 'D';
    return { pts: p.points_earned, correct: p.predicted_outcome === actual };
  });

  const hasAnalytics = ftResolved.length >= 3;

  // ── Risk Profile radar axes ───────────────────────────────────────────────
  // Each value is clamped to [0,1] with an explicit, stated denominator (the
  // Sprint 20 Risk Meter lesson — a ratio's denominator must be sized to the
  // numerator's real range, not just be dimensionally correct). 4 of 5 axes
  // are pure re-derivations of numbers already computed above from `history`
  // — zero extra queries; only Live Activity needed the new count above.
  const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  const avgStake = resolved.length > 0
    ? resolved.reduce((sum, p) => sum + (p.coins_bet ?? 0), 0) / resolved.length
    : 0;
  const pointsMean = resolved.length > 0
    ? resolved.reduce((sum, p) => sum + p.points_earned, 0) / resolved.length
    : 0;
  const pointsStddev = resolved.length > 1
    ? Math.sqrt(resolved.reduce((sum, p) => sum + (p.points_earned - pointsMean) ** 2, 0) / resolved.length)
    : 0;
  const accuracyRatio = ftPredictions.length > 0 ? ftCorrect.length / ftPredictions.length : 0;
  const specialistRatio = scorePreds.length > 0 ? exactScoreCount / scorePreds.length : 0;

  const radarAxes: RadarAxisDatum[] = [
    { key: 'accuracy', label: t('radarAccuracy'), value: clamp01(accuracyRatio), raw: `${Math.round(accuracyRatio * 100)}%` },
    { key: 'boldness', label: t('radarBoldness'), value: clamp01(avgStake / COIN_COSTS.MAX_PER_MATCH), raw: avgStake.toFixed(1) },
    { key: 'liveActivity', label: t('radarLiveActivity'), value: clamp01(momentumBetCount / 20), raw: String(momentumBetCount) },
    { key: 'specialist', label: t('radarSpecialist'), value: clamp01(specialistRatio), raw: `${Math.round(specialistRatio * 100)}%` },
    { key: 'volatility', label: t('radarVolatility'), value: clamp01(pointsStddev / (COIN_COSTS.MAX_PER_MATCH / 2)), raw: `σ${pointsStddev.toFixed(1)}` },
  ];

  // ── Points Trajectory ─────────────────────────────────────────────────────
  // Running cumulative points across resolved predictions, oldest→newest by
  // kickoff. Feeds the hero-card Sparkline. Pure client-side derivation from the
  // already-fetched history — zero extra DB queries.
  const trajectory = (() => {
    const chrono = [...resolved].sort(
      (a, b) => new Date(a.match.kickoff_time).getTime() - new Date(b.match.kickoff_time).getTime(),
    );
    let run = 0;
    return chrono.map(p => (run += p.points_earned));
  })();
  // ─────────────────────────────────────────────────────────────────────────

  const now = Date.now();
  const isPastKickoff = (p: PredictionWithMatch) => new Date(p.match.kickoff_time).getTime() < now;

  // Live = actual live statuses OR NS matches that have passed kickoff (backend hasn't polled yet)
  const livePreds = history.filter(p =>
    LIVE_STATUSES.includes(p.match.status) ||
    p.match.status === 'AET' ||
    (p.match.status === 'NS' && isPastKickoff(p))
  );
  // Upcoming = NS matches not yet kicked off
  const upcomingPreds = history.filter(p => p.match.status === 'NS' && !isPastKickoff(p));
  // History = finished/cancelled — sorted newest kickoff first so most recent results appear at top
  const historyPreds = history
    .filter(p => FINISHED_STATUSES.includes(p.match.status))
    .sort((a, b) => new Date(b.match.kickoff_time).getTime() - new Date(a.match.kickoff_time).getTime());

  const USE_ELITE_UI = true;

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>

      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 90, damping: 18 }}>
        <GlassCard variant="elevated" className="p-5">
          <div className="flex items-center gap-4">
            <motion.button onClick={() => setShowAvatarPicker(true)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} className="relative isolate group shrink-0" title={t('streakTooltip').replace('{0}', String(currentStreak))}>
              {/* Streak-tier breathing halo — exactly one avatar renders on
                  this page (unlike a list row), so a Framer Motion loop is
                  the right tool, not a CSS keyframe (same "single instance"
                  reasoning already applied to the #1 leaderboard row's gold
                  halo, LeaderboardRow.tsx). Colors resolve live via the
                  three --streak-* CSS custom properties (index.css) —
                  streakTierColor() only ever hands back a var() reference,
                  never a hardcoded literal. */}
              {(() => {
                const { token, tier } = streakTierColor(currentStreak);
                const m = HALO_MOTION[tier];
                return (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -z-10 -inset-3 rounded-full blur-lg"
                    style={{ background: `radial-gradient(circle, ${token} 0%, transparent 70%)` }}
                    animate={reduceMotion ? { opacity: m.staticOpacity } : { opacity: m.opacity, scale: m.scale }}
                    transition={reduceMotion ? undefined : { duration: m.duration, repeat: Infinity, ease: 'easeInOut' }}
                  />
                );
              })()}
              <Avatar src={profile.avatar_url} name={profile.username} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">✏️</span>
              </div>
            </motion.button>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white/8 border border-white/15 text-white text-lg font-bebas tracking-wider focus:outline-none focus:border-accent-green/50"
                    maxLength={30}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <NeonButton variant="green" size="sm" loading={savingName} onClick={handleSaveName}>Save</NeonButton>
                  <button onClick={() => setEditingName(false)} className="text-text-muted hover:text-white text-xs px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-bebas text-2xl tracking-wider text-white truncate">{profile.username}</h1>
                  <button onClick={() => { setNameInput(profile.username); setEditingName(true); }} className="text-text-muted hover:text-white transition-colors text-sm" title="Edit display name">✏️</button>
                </div>
              )}
              {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
              <button onClick={() => setShowAvatarPicker(true)} className="text-accent-green text-xs mt-0.5 hover:underline">{t('chooseAvatar')}</button>
            </div>
            <button
              onClick={() => setShowShareCard(true)}
              className="w-9 h-9 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/60 hover:text-accent-green hover:border-accent-green/30 transition-all shrink-0"
              title={t('shareRecapTitle')}
            >
              <Share2 size={16} />
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Stats section ─────────────────────────────────────────────────── */}
      {USE_ELITE_UI ? (
        <ProfileBentoV2
          totalPoints={totalPoints}
          predictions={history.length}
          resolved={resolved.length}
          ftHits={ftCorrect.length}
          ftTotal={ftPredictions.length}
          currentStreak={currentStreak}
          avgGoalsDiff={avgGoalsDiff}
          exactScoreCount={exactScoreCount}
          trajectory={trajectory}
        />
      ) : (
      <motion.div className="grid grid-cols-3 gap-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
        {[
          {
            label: t('hitRate'),
            value: ftPredictions.length > 0 ? `${ftCorrect.length}/${ftPredictions.length}` : '—',
            highlight: true,
            sub: ftPredictions.length > 0
              ? `${Math.round(ftCorrect.length / ftPredictions.length * 100)}% ${t('ftResultCorrect')}`
              : t('ftResultCorrect'),
            info: t('infoHitRate'),
          },
          {
            label: t('totalPoints'),
            value: totalPoints,
            sub: resolved.length > 0 ? `${t('avgLabel')} ${(totalPoints / resolved.length).toFixed(1)} ${t('perMatch')}` : t('allTimeLabel'),
            info: t('infoTotalPoints'),
          },
          {
            label: t('predictions'),
            value: `${history.length}`,
            sub: `${resolved.length} ${t('resolvedLabel')}`,
            info: t('infoPredictions'),
          },
        ].map(stat => (
          <motion.div key={stat.label} className="h-full" variants={{ hidden: { opacity: 0, y: 20, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 18 } } }} whileHover={{ scale: 1.04, y: -3 }} transition={{ type: 'spring', stiffness: 300 }}>
            <StatCard label={stat.label} value={stat.value} highlight={stat.highlight} sub={stat.sub} info={stat.info} />
          </motion.div>
        ))}
      </motion.div>
      )}

      {/* ── Personal Analytics ────────────────────────────────────────────── */}
      {!loading && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } } }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-text-muted text-[10px] uppercase tracking-widest font-semibold">
              {t('analyticsTitle')}
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {!hasAnalytics ? (
            <motion.p
              className="text-text-muted text-xs text-center py-4 opacity-50"
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 20 } } }}
            >
              {t('noAnalyticsYet')}
            </motion.p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">

              {/* ── Card 1: Best Tier ───────────────────────────────────────── */}
              <motion.div
                className="h-full"
                variants={{ hidden: { opacity: 0, y: 16, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120, damping: 18 } } }}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <GlassCard className="p-3 flex flex-col h-full min-h-[108px] border-violet-400/20 bg-violet-500/[0.06]">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-muted text-[9px] uppercase tracking-widest leading-none">{t('bestTier')}</span>
                    <InfoTip text={t('infoBestTier')} />
                  </div>

                  {bestTierKey ? (
                    <div className="flex flex-col flex-1 justify-between">
                      {/* Icon + name */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl leading-none shrink-0">{TIER_ICONS[bestTierKey]}</span>
                        <span className="text-violet-300 font-bebas text-base tracking-wide leading-tight truncate">
                          {t(TIER_LABELS[bestTierKey])}
                        </span>
                      </div>
                      {/* Hit rate + mini bar */}
                      <div className="mt-1.5">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-bebas text-2xl leading-none text-violet-300">
                            {Math.round(bestTierRate * 100)}%
                          </span>
                          <span className="text-white/30 text-[9px]">
                            {bestTierStat!.won}/{bestTierStat!.bet}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-400/60 transition-all duration-700"
                            style={{ width: `${Math.round(bestTierRate * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-text-muted text-xs opacity-50">—</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>

              {/* ── Card 2: Score Precision ─────────────────────────────────── */}
              {/* avg goal diff on exact-score predictions (lower = sharper) */}
              <motion.div
                className="h-full"
                variants={{ hidden: { opacity: 0, y: 16, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120, damping: 18 } } }}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <GlassCard className="p-3 flex flex-col h-full min-h-[108px] border-amber-400/20 bg-amber-500/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-muted text-[9px] uppercase tracking-widest leading-none">{t('scorePrecision')}</span>
                    <InfoTip text={t('infoScorePrecision')} />
                  </div>

                  <div className="flex flex-col flex-1 justify-between">
                    {avgGoalsDiff !== null ? (
                      <>
                        <div>
                          <div className={`font-bebas text-2xl leading-none ${precisionColor}`}>
                            {avgGoalsDiff.toFixed(1)}
                          </div>
                          <div className="text-white/30 text-[9px] mt-0.5 leading-tight">
                            {t('goalsOff')}
                          </div>
                        </div>
                        <div className="text-white/25 text-[9px] leading-tight mt-1">
                          {exactScoreCount}{' '}
                          {exactScoreCount === 1 ? t('exactScoreHits') : t('exactScoreHitsPlural')}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-text-muted text-[9px] opacity-50 text-center leading-snug">{t('noScorePreds')}</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>

              {/* ── Card 3: Recent Form ──────────────────────────────────────── */}
              {/* Last 5 FT result predictions as animated dots + streak      */}
              <motion.div
                className="h-full col-span-2 sm:col-span-1"
                variants={{ hidden: { opacity: 0, y: 16, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120, damping: 18 } } }}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <GlassCard className="p-3 flex flex-col h-full min-h-[108px] border-accent-green/20 bg-accent-green/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-muted text-[9px] uppercase tracking-widest leading-none">{t('recentForm')}</span>
                    <InfoTip text={t('infoRecentForm')} />
                  </div>

                  {last5.length > 0 ? (
                    <div className="flex flex-col flex-1 justify-between">
                      {/* Points-per-match bars — colour = outcome, height = magnitude.
                          Oldest left, newest right. */}
                      <FormBars series={formSeries} className="mt-0.5" label={t('recentForm')} />
                      {/* Streak + ratio */}
                      <div>
                        <div className="flex items-baseline gap-1">
                          {currentStreak > 0 && (
                            <span className="font-bebas text-2xl leading-none text-accent-green">
                              {currentStreak}
                            </span>
                          )}
                          <span className="text-white/30 text-[9px] leading-tight">
                            {currentStreak > 0 ? t('formStreak') : `${last5Correct} ${t('formOf')}`}
                          </span>
                        </div>
                        <div className="text-white/20 text-[9px] leading-tight">
                          {last5Correct}/{last5.length} {t('formStreakOf')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-text-muted text-xs opacity-50">—</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Risk Profile radar ────────────────────────────────────────────── */}
      {!loading && hasAnalytics && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.1 }}>
          <GlassCard variant="elevated" className="p-4">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="font-bebas text-lg tracking-wider text-white">{t('radarTitle')}</span>
              <InfoTip text={t('radarInfoTip')} />
            </div>
            <RiskRadarChart axes={radarAxes} />
          </GlassCard>
        </motion.div>
      )}

      {/* ── Hall of Fame Chronicles ──────────────────────────────────────── */}
      {user && <HallOfFameChronicles userId={user.id} />}

      {/* Prediction sections */}
      {loading ? (
        <PageLoader />
      ) : history.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">{t('noPredictions')}</p>
      ) : (
        <>
          {/* LIVE */}
          {livePreds.length > 0 && (
            <PredictionSection
              title={`🔴 ${t('liveNow')}`}
              predictions={livePreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
            />
          )}

          {/* UPCOMING */}
          {upcomingPreds.length > 0 && (
            <PredictionSection
              title={`⏳ ${t('upcoming')}`}
              predictions={upcomingPreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
            />
          )}

          {/* HISTORY */}
          {historyPreds.length > 0 && (
            <PredictionSection
              title={t('predictionHistory')}
              predictions={historyPreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
              paginated
            />
          )}
        </>
      )}

      <div className="pt-4">
        <NeonButton variant="danger" onClick={handleSignOut} loading={signingOut} className="w-full">{t('signOut')}</NeonButton>
      </div>

      <AnimatePresence>
        {showAvatarPicker && <AvatarPicker onClose={() => setShowAvatarPicker(false)} />}
        {showShareCard && <ShareableRecapCard onClose={() => setShowShareCard(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

const HISTORY_PAGE_SIZE = 5;

interface SectionProps {
  title: string;
  predictions: (Prediction & { match: Match })[];
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  deleting: string | null;
  saving: string | null;
  onSave: (data: PredictionData, id: string) => Promise<void>;
  onDelete: (id: string) => void;
  t: (key: TranslationKey) => string;
  paginated?: boolean;
}

function PredictionSection({ title, predictions, expandedIds, toggleExpanded, confirmDeleteId, setConfirmDeleteId, deleting, saving, onSave, onDelete, t, paginated }: SectionProps) {
  const [visibleCount, setVisibleCount] = useState(paginated ? HISTORY_PAGE_SIZE : predictions.length);
  // Reset pagination when the predictions list changes (e.g. group switch)
  useEffect(() => {
    if (paginated) setVisibleCount(HISTORY_PAGE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions.length]);
  const visible = predictions.slice(0, visibleCount);
  const hasMore = visibleCount < predictions.length;

  return (
    <div>
      <h2 className="font-bebas text-lg tracking-wider text-white mb-3">{title}</h2>
      <motion.div className="space-y-2" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
        {visible.map(pred => {
          const editable = pred.match.status === 'NS' && !isMatchLocked(pred.match.kickoff_time);
          const { lockCountdown } = formatKickoffTime(pred.match.kickoff_time);
          const isExpanded = expandedIds.has(pred.id);
          return (
            <motion.div key={pred.id} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 90, damping: 18 } } }}>
              <GlassCard className="overflow-hidden">
                <button
                  className="w-full p-3 flex items-center gap-3 text-start hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpanded(pred.id)}
                >
                  <div className="w-8 text-center shrink-0">
                    {pred.is_resolved ? (
                      pred.points_earned > 0 ? <span className="text-accent-green text-sm">✓</span> : <span className="text-text-muted text-sm">✗</span>
                    ) : editable ? (
                      <span className="text-blue-400 text-sm">✏️</span>
                    ) : (
                      <span className="text-yellow-400 text-sm">⏳</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{pred.match.home_team} vs {pred.match.away_team}</div>
                    <div className="text-text-muted text-xs flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{formatKickoffTime(pred.match.kickoff_time).date}</span>
                      <MatchStatusBadge status={
                        pred.match.went_to_penalties ? 'PEN'
                        : pred.match.regulation_home != null ? 'AET'
                        : pred.match.status
                      } />
                      {editable && lockCountdown && (
                        <span className="text-amber-400/80">🔒 {lockCountdown}</span>
                      )}
                      {editable && !lockCountdown && <span className="text-blue-400">· {t('editPrediction')}</span>}
                      {pred.match.regulation_home != null && (
                        <span className="text-amber-400/70">90′: {pred.match.regulation_home}–{pred.match.regulation_away}</span>
                      )}
                    </div>
                    {/* Prediction summary pills — always visible so user can verify without expanding */}
                    <PredictionSummaryPills prediction={pred} match={pred.match} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pred.is_resolved && (
                      <>
                        <div className={`font-bebas text-lg ${pred.points_earned > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
                          {pred.points_earned > 0 ? `+${pred.points_earned}` : '0'}
                        </div>
                        {(pred.coins_bet ?? 0) > 0 && (
                          <CoinNetPill coinsBet={pred.coins_bet ?? 0} pointsEarned={pred.points_earned} />
                        )}
                      </>
                    )}
                    {/* Only show staked pill for upcoming (pre-kickoff) predictions — not live */}
                    {!pred.is_resolved && (pred.coins_bet ?? 0) > 0 &&
                      pred.match.status === 'NS' &&
                      new Date(pred.match.kickoff_time).getTime() > Date.now() && (
                      <CoinStakedPill coins={pred.coins_bet ?? 0} />
                    )}
                    {editable && (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pred.id); }} className="text-text-muted hover:text-red-400 text-xs px-1.5 py-1 rounded-lg hover:bg-red-400/10 transition-all" title={t('removePrediction')}>🗑</button>
                    )}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-white/20 text-xs">▾</motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {confirmDeleteId === pred.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                        <span className="text-white/70 text-xs">Remove this prediction?</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setConfirmDeleteId(null)} className="text-text-muted text-xs hover:text-white px-2 py-1 rounded">{t('cancel')}</button>
                          <button onClick={() => onDelete(pred.id)} disabled={deleting === pred.id} className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                            {deleting === pred.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} className="overflow-hidden">
                      <div className="px-3 pb-3 border-t border-white/5 pt-3">
                        {editable ? (
                          <PredictionForm match={pred.match} existingPrediction={pred} onSave={(data) => onSave(data, pred.id)} saving={saving === pred.id} />
                        ) : (
                          <ResolvedBreakdown prediction={pred} match={pred.match} />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Load more history */}
      {paginated && hasMore && (
        <button
          onClick={() => setVisibleCount(v => v + HISTORY_PAGE_SIZE)}
          className="mt-3 w-full py-2 text-sm text-text-muted hover:text-white border border-white/8 hover:border-white/20 rounded-xl bg-white/3 hover:bg-white/6 transition-all"
        >
          Show {Math.min(HISTORY_PAGE_SIZE, predictions.length - visibleCount)} more · {predictions.length - visibleCount} remaining
        </button>
      )}
    </div>
  );
}

/** Compact coin badge for card headers — shows coins earned back (always positive framing) */
function CoinNetPill({ coinsBet, pointsEarned }: { coinsBet: number; pointsEarned: number }) {
  const coinsBack = pointsEarned * 2;
  const profit = coinsBack > coinsBet;
  return (
    <div className={`flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 border ${
      profit ? 'bg-amber-400/12 border-amber-400/25' : 'bg-white/4 border-white/10'
    }`}>
      <CoinIcon size={10} />
      <span className={`font-bebas text-sm leading-none ${profit ? 'text-amber-400' : 'text-white/28'}`}>
        {coinsBack > 0 ? `+${coinsBack}` : '0'}
      </span>
    </div>
  );
}

/** Amber pill showing coins staked on an unresolved prediction */
function CoinStakedPill({ coins }: { coins: number }) {
  return (
    <div className="flex items-center gap-0.5 bg-amber-400/8 border border-amber-400/18 rounded-lg px-1.5 py-0.5">
      <CoinIcon size={10} />
      <span className="font-bebas text-sm text-amber-400/45 leading-none">−{coins}</span>
    </div>
  );
}

/** Full coin economy row shown inside the expanded breakdown */
function CoinSummaryBar({ coinsBet, pointsEarned }: { coinsBet: number; pointsEarned: number }) {
  const { t } = useLangStore();
  const coinsBack = pointsEarned * 2;
  const net = coinsBack - coinsBet;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="mt-1 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-1.5">
        <CoinIcon size={13} />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-400/45">{t('coinsLabel')}</span>
      </div>
      <div className="flex items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1 text-white/35">
          <span>{t('stakedLabel')}</span>
          <span className="font-bold tabular-nums">−{coinsBet}</span>
        </div>
        <div className="w-px h-3 bg-white/10 shrink-0" />
        <div className="flex items-center gap-1 text-white/35">
          <span>{t('backLabel')}</span>
          <span className={`font-bold tabular-nums ${coinsBack > 0 ? 'text-amber-400/70' : ''}`}>+{coinsBack}</span>
        </div>
        {net > 0 && (
          <>
            <div className="w-px h-3 bg-white/10 shrink-0" />
            <div className="flex items-center gap-0.5 font-bold tabular-nums text-emerald-400">
              <span className="text-[11px] font-normal opacity-60">{t('profitLabel')}</span>
              <span>+{net}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, highlight, sub, info }: { label: string; value: string | number; highlight?: boolean; sub?: string; info?: string }) {
  return (
    <GlassCard className="p-4 text-center h-full flex flex-col items-center justify-between min-h-[88px]">
      <div className="flex items-center justify-center text-text-muted text-xs uppercase tracking-wider mb-1 gap-0.5">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className={`font-bebas text-2xl tracking-wider ${highlight ? 'text-accent-green text-glow-green' : 'text-white'}`}>{value}</div>
      <div className="text-white/20 text-[10px] mt-0.5 leading-tight min-h-[14px]">{sub ?? ''}</div>
    </GlassCard>
  );
}

const PILL_COLORS: Record<string, string> = {
  result:  'bg-blue-500/20 border-blue-400/35 text-blue-200',
  score:   'bg-violet-500/20 border-violet-400/35 text-violet-200',
  corners: 'bg-amber-500/20 border-amber-400/35 text-amber-200',
  btts:    'bg-teal-500/20 border-teal-400/35 text-teal-200',
  goals:   'bg-emerald-500/20 border-emerald-400/35 text-emerald-200',
};

/** Compact inline summary of what a user predicted — always visible so user can verify at a glance */
function PredictionSummaryPills({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const pills: { key: string; label: string; value: string }[] = [];

  const teamName = (outcome: 'H' | 'D' | 'A' | null) =>
    outcome === 'H' ? (match.home_team.split(' ').slice(-1)[0] ?? t('home'))
    : outcome === 'A' ? (match.away_team.split(' ').slice(-1)[0] ?? t('away'))
    : outcome === 'D' ? t('draw') : '';

  if (prediction.predicted_outcome) {
    pills.push({ key: 'result', label: t('result'), value: teamName(prediction.predicted_outcome) });
  }
  if (prediction.predicted_home_score !== null && prediction.predicted_away_score !== null) {
    pills.push({ key: 'score', label: t('score'), value: `${prediction.predicted_home_score}–${prediction.predicted_away_score}` });
  }
  if (prediction.predicted_corners) {
    const cl = prediction.predicted_corners === 'under9' ? t('cornersUnder9') : prediction.predicted_corners === 'ten' ? t('cornersTen') : t('cornersOver11');
    pills.push({ key: 'corners', label: t('corners'), value: cl });
  }
  if (prediction.predicted_btts !== null) {
    pills.push({ key: 'btts', label: t('btts'), value: prediction.predicted_btts ? t('yes') : t('no') });
  }
  if (prediction.predicted_over_under) {
    pills.push({ key: 'goals', label: t('goals'), value: prediction.predicted_over_under === 'over' ? t('over25') : t('under25') });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {pills.map(p => (
        <span key={p.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${PILL_COLORS[p.key] ?? 'bg-white/8 border-white/15 text-white/70'}`}>
          <span className="opacity-55 text-[10px] font-normal">{p.label}</span>
          <span className="font-semibold">{p.value}</span>
        </span>
      ))}
    </div>
  );
}

function ResolvedBreakdown({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const breakdown = calcBreakdown(prediction, match);

  const teamLabel = (outcome: 'H' | 'D' | 'A' | null) =>
    outcome === 'H' ? (match.home_team.split(' ').pop() ?? t('home'))
    : outcome === 'A' ? (match.away_team.split(' ').pop() ?? t('away'))
    : outcome === 'D' ? t('draw') : null;

  const cornersLabel = (v: 'under9' | 'ten' | 'over11' | null) =>
    v === 'under9' ? t('cornersUnder9') : v === 'ten' ? t('cornersTen') : v === 'over11' ? t('cornersOver11') : null;

  const tierDetail = (key: string): string | null => {
    switch (key) {
      case 'result': return prediction.predicted_outcome ? teamLabel(prediction.predicted_outcome) : null;
      case 'score': return prediction.predicted_home_score !== null
        ? `${prediction.predicted_home_score}–${prediction.predicted_away_score}` : null;
      case 'ht': return prediction.predicted_halftime_outcome ? teamLabel(prediction.predicted_halftime_outcome) : null;
      case 'corners': return cornersLabel(prediction.predicted_corners ?? null);
      case 'btts': return prediction.predicted_btts !== null ? (prediction.predicted_btts ? t('yes') : t('no')) : null;
      case 'ou': return prediction.predicted_over_under
        ? (prediction.predicted_over_under === 'over' ? t('over25') : t('under25')) : null;
      default: return null;
    }
  };

  const tierName = (key: string): string => {
    switch (key) {
      case 'result': return t('result');
      case 'score': return t('exactScore');
      case 'ht': return t('halfTime');
      case 'corners': return t('corners');
      case 'btts': return t('btts');
      case 'ou': return t('overUnder');
      default: return key;
    }
  };

  // Compute actual values to show alongside wrong predictions
  const scoringHome = match.regulation_home ?? match.home_score;
  const scoringAway = match.regulation_away ?? match.away_score;
  const actualOutcome = scoringHome !== null && scoringAway !== null
    ? (scoringHome > scoringAway ? 'H' : scoringHome < scoringAway ? 'A' : 'D') : null;
  const actualBTTS = scoringHome !== null && scoringAway !== null ? scoringHome > 0 && scoringAway > 0 : null;
  const totalGoals = scoringHome !== null && scoringAway !== null ? scoringHome + scoringAway : null;
  const actualCornersBucket = match.corners_total !== null
    ? (match.corners_total <= 9 ? 'under9' : match.corners_total === 10 ? 'ten' : 'over11') as 'under9' | 'ten' | 'over11'
    : null;
  const htOutcome = match.halftime_home !== null && match.halftime_away !== null
    ? (match.halftime_home > match.halftime_away ? 'H' : match.halftime_home < match.halftime_away ? 'A' : 'D') as 'H' | 'D' | 'A'
    : null;

  const actualFor = (key: string): string | null => {
    switch (key) {
      case 'result': return actualOutcome ? teamLabel(actualOutcome) : null;
      case 'score': return scoringHome !== null && scoringAway !== null ? `${scoringHome}–${scoringAway}` : null;
      case 'ht': return htOutcome ? teamLabel(htOutcome) : null;
      case 'corners': return cornersLabel(actualCornersBucket);
      case 'btts': return actualBTTS !== null ? (actualBTTS ? t('yes') : t('no')) : null;
      case 'ou': return totalGoals !== null ? (totalGoals > 2.5 ? t('over25') : t('under25')) : null;
      default: return null;
    }
  };

  if (!breakdown) {
    return (
      <div className="grid grid-cols-2 gap-1.5 text-sm">
        {prediction.predicted_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('result')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{teamLabel(prediction.predicted_outcome)}</span>
          </div>
        )}
        {prediction.predicted_home_score !== null && prediction.predicted_away_score !== null && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('score')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_home_score}–{prediction.predicted_away_score}</span>
          </div>
        )}
        {prediction.predicted_halftime_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('halfTime')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{teamLabel(prediction.predicted_halftime_outcome)}</span>
          </div>
        )}
        {prediction.predicted_corners && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('corners')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{cornersLabel(prediction.predicted_corners)}</span>
          </div>
        )}
        {prediction.predicted_btts !== null && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('btts')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_btts ? t('yes') : t('no')}</span>
          </div>
        )}
        {prediction.predicted_over_under && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('goals')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_over_under === 'over' ? t('over25') : t('under25')}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {breakdown.map(tier => {
        const detail = tierDetail(tier.key);
        const isPending = tier.pending === true;
        const actual = !tier.earned && !isPending ? actualFor(tier.key) : null;
        const showActual = actual && actual !== detail; // only show actual when different from prediction
        return (
          <div key={tier.key} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${tier.earned ? 'bg-accent-green/8 border border-accent-green/15' : isPending ? 'bg-blue-500/6 border border-blue-500/15' : 'bg-white/3 border border-white/5'}`}>
            <span className={`flex items-center gap-1 min-w-0 flex-wrap ${tier.earned ? 'text-accent-green' : isPending ? 'text-blue-400 opacity-70' : 'text-white/35'}`}>
              <span className="shrink-0">{tier.earned ? '✓' : isPending ? '…' : '✗'}</span>
              <span className="shrink-0">{tierName(tier.key)}</span>
              {detail && (
                <span className={`shrink-0 font-semibold ${tier.earned ? 'text-accent-green' : 'text-white/40'}`}>· {detail}</span>
              )}
              {showActual && (
                <>
                  <span className="text-white/20 shrink-0">→</span>
                  <span className="text-white/55 font-semibold shrink-0">{actual}</span>
                </>
              )}
            </span>
            <span className={`shrink-0 ml-2 ${tier.earned ? 'text-accent-green font-semibold' : isPending ? 'text-blue-400/50' : 'text-white/20'}`}>
              {tier.earned ? `+${tier.pts}` : isPending ? '?' : '0'}
            </span>
          </div>
        );
      })}
      {/* Coin result summary */}
      {prediction.is_resolved && (prediction.coins_bet ?? 0) > 0 && (
        <CoinSummaryBar coinsBet={prediction.coins_bet ?? 0} pointsEarned={prediction.points_earned} />
      )}
    </div>
  );
}
