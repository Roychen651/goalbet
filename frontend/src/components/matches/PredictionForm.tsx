import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Link2 } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { Match, Prediction } from '../../lib/supabase';
import { MagneticButtonV2 } from '../ui/MagneticButtonV2';
import { CoinIcon } from '../ui/CoinIcon';
import { AIScoutCard } from '../ui/AIScoutCard';
import { OracleStatsPanel } from './OracleStatsPanel';
import { cn, isMatchLocked, calcBreakdown, calcLiveBreakdown } from '../../lib/utils';
import { LIVE_STATUSES, POINTS, COIN_COSTS, calcPredictionCost, calcParlayBonusPreview, type ParlayTierKey } from '../../lib/constants';
import { interpolateRisk } from '../../lib/oklch';

// International Friendlies: hundreds of matches per week, corners never tracked
const LEAGUES_WITHOUT_CORNERS = new Set([4396]);
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { TIER_COLORS, DEBOSS_SHADOW } from '../../lib/tierVisuals';
import { InfoTip } from '../ui/InfoTip';

interface PredictionFormProps {
  match: Match;
  existingPrediction: Prediction | undefined;
  onSave: (data: PredictionData) => Promise<void>;
  saving: boolean;
  /** Normalised implied probabilities from ESPN odds (0–1 each, sum ≈ 1) */
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
  /** First-timer → lock advanced tiers (2–5) behind a frosted overlay */
  isNewUser?: boolean;
}

export interface PredictionData {
  match_id: string;
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_corners: 'under9' | 'ten' | 'over11' | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
  is_parlay?: boolean;
  parlay_linked_tiers?: ParlayTierKey[] | null;
}

type OutcomeOption = 'H' | 'D' | 'A';

// TIER_COLORS / DEBOSS_SHADOW moved to lib/tierVisuals.ts (Sprint 25) — the
// Bento Almanac's Tier Ledger card needed the same 5-color system as a
// second consumer. Emboss (Sprint 20) replaces glow as the selected-chip
// shadow: an inner light-catch plus an outward glow in the tier's own
// color. `glow` itself is kept (still referenced by TierRow's point label).

function deriveOutcomeFromScore(home: string, away: string): OutcomeOption | null {
  const h = parseInt(home);
  const a = parseInt(away);
  if (isNaN(h) || isNaN(a) || home === '' || away === '') return null;
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

// Progressive disclosure: wraps an advanced tier for a first-timer — the tier
// stays visible (so they know the depth exists) but is blurred + non-interactive
// under a frosted overlay with a centered lock and an unlock hint.
function LockedTier({ locked = true, children }: { locked?: boolean; children: React.ReactNode }) {
  const { t } = useLangStore();
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[1.5px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-black/25 backdrop-blur-[3px]">
        <span className="text-2xl leading-none" aria-hidden>🔒</span>
        <span className="px-4 text-center text-[11px] font-semibold leading-snug text-white/85">
          {t('unlockTierHint')}
        </span>
      </div>
    </div>
  );
}

export const PredictionForm = memo(function PredictionForm({ match, existingPrediction, onSave, saving, odds, isNewUser }: PredictionFormProps) {
  const { t, lang } = useLangStore();
  const locked = isMatchLocked(match.kickoff_time) || match.status !== 'NS';
  const resolved = existingPrediction?.is_resolved ?? false;

  // V4 Sprint 26 — the static LEAGUES_WITHOUT_CORNERS exclusion stays the
  // floor (a curated, zero-sample-size-needed signal for a league we
  // already know about); match.corners_supported === false is the new
  // empirical signal (migration 048), computed per-league from this
  // league's own resolved-match history. NULL/undefined (not enough
  // history yet, or the migration hasn't landed) fails OPEN — an unknown
  // league is treated as normal, never preemptively restricted. Without
  // this, a league whose ESPN feed silently never reports corners leaves a
  // prediction's Corners tier permanently unresolvable — the user already
  // paid COIN_COSTS.CORNERS and can never win it back (pointsEngine.ts's
  // corners branch only fires when match.corners_total !== null). Computed
  // here (before any hooks) so the clear-stale-value effect below can use
  // it as a dependency.
  const cornersDisabled = LEAGUES_WITHOUT_CORNERS.has(match.league_id) || match.corners_supported === false;

  const [outcome, setOutcome] = useState<OutcomeOption | null>(existingPrediction?.predicted_outcome ?? null);
  const [homeScore, setHomeScore] = useState<string>(existingPrediction?.predicted_home_score?.toString() ?? '');
  const [awayScore, setAwayScore] = useState<string>(existingPrediction?.predicted_away_score?.toString() ?? '');
  const [cornersValue, setCornersValue] = useState<'under9' | 'ten' | 'over11' | null>(existingPrediction?.predicted_corners ?? null);
  const [btts, setBtts] = useState<boolean | null>(existingPrediction?.predicted_btts ?? null);
  const [overUnder, setOverUnder] = useState<'over' | 'under' | null>(existingPrediction?.predicted_over_under ?? null);
  const [saved, setSaved] = useState(!!existingPrediction);
  // V5 Sprint 34 — "The Prediction Matrix". A Set, not an array: toggling is
  // naturally idempotent (link/unlink) and membership checks are O(1) for
  // every tier row's `linked` prop on every render.
  const [linkedTiers, setLinkedTiers] = useState<Set<ParlayTierKey>>(
    new Set(existingPrediction?.is_parlay ? existingPrediction.parlay_linked_tiers ?? [] : []),
  );

  // Sync form values only when the prediction ID changes (new prediction loaded).
  const predId = existingPrediction?.id;
  useEffect(() => {
    if (existingPrediction) {
      setOutcome(existingPrediction.predicted_outcome ?? null);
      setHomeScore(existingPrediction.predicted_home_score?.toString() ?? '');
      setAwayScore(existingPrediction.predicted_away_score?.toString() ?? '');
      setCornersValue(existingPrediction.predicted_corners ?? null);
      setBtts(existingPrediction.predicted_btts ?? null);
      setOverUnder(existingPrediction.predicted_over_under ?? null);
      setLinkedTiers(new Set(existingPrediction.is_parlay ? existingPrediction.parlay_linked_tiers ?? [] : []));
      setSaved(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predId]);

  // Auto-derive outcome, BTTS, and Over/Under from exact score
  // These three are mathematically determined once both score fields are filled
  const hasExactScore = homeScore !== '' && awayScore !== '';
  const scoreDerivedOutcome = deriveOutcomeFromScore(homeScore, awayScore);
  const scoreDerivedBTTS = hasExactScore
    ? parseInt(homeScore) > 0 && parseInt(awayScore) > 0
    : null;
  const scoreDerivedOU = hasExactScore
    ? (parseInt(homeScore) + parseInt(awayScore)) > 2.5 ? 'over' as const : 'under' as const
    : null;

  // Auto-derive OUTCOME from score — this is always implied and free (no extra cost)
  useEffect(() => {
    if (scoreDerivedOutcome !== null) setOutcome(scoreDerivedOutcome);
  }, [scoreDerivedOutcome]);

  // BTTS and O/U are NOT auto-selected — user must choose them explicitly.
  // However, if a selection becomes logically impossible given the score, auto-clear it
  // so the user doesn't pay for a contradictory prediction.
  useEffect(() => {
    if (!hasExactScore || scoreDerivedBTTS === null) return;
    if (btts === true && !scoreDerivedBTTS)  { setBtts(null); setSaved(false); }
    if (btts === false && scoreDerivedBTTS)  { setBtts(null); setSaved(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreDerivedBTTS, hasExactScore]);

  useEffect(() => {
    if (!hasExactScore || scoreDerivedOU === null) return;
    // scoreDerivedOU is already the string 'over'|'under' — compare directly
    if (overUnder !== null && overUnder !== scoreDerivedOU) { setOverUnder(null); setSaved(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreDerivedOU, hasExactScore]);

  // V4 Sprint 26 — a narrow edge case: a corners pick was made while this
  // league was still considered supported, and it later got empirically
  // re-flagged as unsupported before kickoff. Without this, re-saving any
  // OTHER tier would resubmit the now-stale corners value, and
  // submit_prediction() (migration 049) would reject the entire save — the
  // user would be blocked from editing anything else about this
  // prediction. Clearing it client-side means they just silently lose the
  // now-unresolvable pick instead.
  useEffect(() => {
    if (cornersDisabled && cornersValue !== null) { setCornersValue(null); setSaved(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cornersDisabled]);

  // V5 Sprint 34 — "The Prediction Matrix". Per-tier active state, using
  // the same canonical keys the backend's submit_prediction() validates
  // against (migration 054) and calcBreakdown() already emits — one
  // vocabulary, not a second one invented for this UI.
  const tierActive: Record<ParlayTierKey, boolean> = {
    result: outcome !== null || hasExactScore,
    score: hasExactScore,
    corners: cornersValue !== null,
    btts: btts !== null,
    ou: overUnder !== null,
  };

  const toggleLink = (key: ParlayTierKey) => {
    if (!tierActive[key]) return; // mirrors the RPC's own linkage validation
    setLinkedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 3) return prev; // capped at 3 — no-op, never silently evicts an existing link
        next.add(key);
      }
      return next;
    });
    haptic('selection');
    playSound('toggle_click');
    setSaved(false);
  };

  // A linked tier whose value gets cleared (by the user, or by one of the
  // auto-clear effects above) can no longer be part of a valid parlay —
  // mirrors the cornersDisabled cleanup effect immediately above: silently
  // drop it from the link set rather than letting the next save fail
  // submit_prediction()'s server-side linkage check.
  useEffect(() => {
    setLinkedTiers((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (!tierActive[key]) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierActive.result, tierActive.score, tierActive.corners, tierActive.btts, tierActive.ou]);

  const isParlayArmed = linkedTiers.size >= 2;

  const handleSubmit = async () => {
    await onSave({
      match_id: match.id,
      predicted_outcome: outcome,
      predicted_home_score: homeScore !== '' ? parseInt(homeScore) : null,
      predicted_away_score: awayScore !== '' ? parseInt(awayScore) : null,
      predicted_corners: cornersValue,
      predicted_btts: btts,
      predicted_over_under: overUnder,
      is_parlay: isParlayArmed,
      parlay_linked_tiers: isParlayArmed ? Array.from(linkedTiers) : null,
    });
    // lock_thud, not coin_chime — coin_chime already means "you received
    // coins" everywhere else in the app (daily bonus, prediction wins).
    // lock_thud already means "something just became final" (Momentum Bets
    // lock) — the correct semantic match for locking in a prediction.
    playSound('lock_thud');
    setSaved(true);
  };

  const hasAnyPrediction = outcome !== null || homeScore !== '' || cornersValue !== null || btts !== null || overUnder !== null;

  // ── Coin cost for current form state ───────────────────────────────────────
  const coins = useCoinsStore(s => s.coins);
  const currentCost = calcPredictionCost({
    predicted_outcome: outcome,
    predicted_home_score: homeScore !== '' ? parseInt(homeScore) : null,
    predicted_away_score: awayScore !== '' ? parseInt(awayScore) : null,
    predicted_corners: cornersValue,
    predicted_btts: btts,
    predicted_over_under: overUnder,
  });
  const oldCost = existingPrediction?.coins_bet ?? 0;
  const netCost = currentCost - oldCost; // positive = spending more, negative = getting refund
  const insufficientCoins = netCost > 0 && coins < netCost;
  const displayCost = netCost > 0 ? netCost : currentCost;
  // Risk Meter — a live gauge reflecting the already-computed cost, never a
  // draggable input. GoalBet's coin cost is fixed per tier selection
  // (submit_prediction, migration 040) — there is no discretionary stake to
  // "slide"; sending a client-chosen amount to a coin-spending RPC is
  // exactly what rule 4.11/SS27 forbids.
  //
  // Ratio is cost-vs-MAX_PER_MATCH (19), not cost-vs-balance. A single
  // match can cost at most 19 coins while typical balances run into the
  // hundreds (120 join bonus + 30/day) — cost/balance is almost always a
  // few percent regardless of which tiers are picked, so the bar looked
  // frozen no matter what a user tapped (reported live). cost/19 sweeps the
  // full 0-100% range across the tiers a user can actually toggle, so the
  // bar responds visibly to every tap — insufficientCoins still forces full
  // red regardless of this ratio, since "can't afford it" is a real signal
  // independent of how "loaded up" the pick is.
  const riskRatio = insufficientCoins
    ? 1
    : Math.max(0, Math.min(1, displayCost / COIN_COSTS.MAX_PER_MATCH));

  if (locked) {
    return <LockedPrediction match={match} prediction={existingPrediction} resolved={resolved} />;
  }

  const tiers = [
    {
      key: 'tier1',
      parlayKey: 'result' as ParlayTierKey,
      label: t('fullTimeResult'),
      pts: POINTS.TIER1_OUTCOME,
      active: outcome !== null,
      content: (
        <OutcomePicker
          value={outcome}
          onChange={(v) => { haptic('selection'); playSound('toggle_click'); setOutcome(v); setSaved(false); }}
          homeTeam={lang === 'he' ? tTeam(match.home_team) : match.home_team}
          awayTeam={lang === 'he' ? tTeam(match.away_team) : match.away_team}
          color={TIER_COLORS[0]}
          lockedByScore={hasExactScore}
          odds={odds}
        />
      ),
    },
    {
      key: 'tier2',
      parlayKey: 'score' as ParlayTierKey,
      label: t('exactScore'),
      pts: POINTS.TIER2_EXACT_SCORE,  // +7 — stacks with Result's +3 = +10 when correct
      ptsNote: t('scoreStacksNote'),
      active: hasExactScore,
      content: (
        <ScorePicker
          homeValue={homeScore}
          awayValue={awayScore}
          onHomeChange={(v) => { setHomeScore(v); setSaved(false); }}
          onAwayChange={(v) => { setAwayScore(v); setSaved(false); }}
        />
      ),
    },
    {
      // V4 Sprint 26 — always in the array now (was conditionally spread
      // out entirely for LEAGUES_WITHOUT_CORNERS leagues). A disabled,
      // explained chip is a real UX upgrade over a tier that just silently
      // isn't there with no indication why — and it keeps TIER_COLORS'
      // positional indexing fixed (0=Result/1=Score/2=Corners/3=BTTS/
      // 4=O-U) instead of shifting depending on whether corners is
      // excluded for this particular match's league.
      key: 'tier3',
      parlayKey: 'corners' as ParlayTierKey,
      label: t('totalCorners'),
      pts: POINTS.TIER3_CORNERS,
      active: cornersValue !== null,
      disabled: cornersDisabled,
      content: (
        <CornersPicker
          value={cornersValue}
          onChange={(v) => { haptic('selection'); playSound('toggle_click'); setCornersValue(v); setSaved(false); }}
          color={TIER_COLORS[2]}
          disabled={cornersDisabled}
        />
      ),
    },
  ];

  const preMatchInsight = (lang === 'he' && match.ai_pre_match_insight_he) || match.ai_pre_match_insight;

  return (
    <div className="space-y-1.5">
      {preMatchInsight && (
        <div className="pb-1">
          <AIScoutCard title="aiScoutPreMatchTitle" text={preMatchInsight} tone="pre" />
        </div>
      )}
      <OracleStatsPanel match={match} />
      {tiers.map((tier, i) => (
        <motion.div
          key={tier.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 24 }}
        >
          <TierRow
            label={tier.label}
            pts={tier.pts}
            ptsNote={tier.ptsNote}
            active={tier.active}
            color={TIER_COLORS[i]}
            disabled={tier.disabled}
            disabledTooltip={tier.disabled ? t('cornersUnsupportedTooltip') : undefined}
            linkKey={tier.parlayKey}
            linked={linkedTiers.has(tier.parlayKey)}
            canLink={tierActive[tier.parlayKey]}
            onToggleLink={toggleLink}
          >
            <LockedTier locked={!!isNewUser && tier.key !== 'tier1'}>{tier.content}</LockedTier>
          </TierRow>
        </motion.div>
      ))}

      {/* BTTS + O/U as compact single-line rows */}
      <LockedTier locked={!!isNewUser}>
        <InlineBoolTier
          label={t('bothTeamsToScore')}
          pts={POINTS.TIER5_BTTS}
          active={btts !== null}
          color={TIER_COLORS[tiers.length]}
          value={btts}
          onChange={(v) => { haptic('selection'); playSound('toggle_click'); setBtts(v); setSaved(false); }}
          yesLabel={t('yes')}
          noLabel={t('no')}
          impossibleValue={hasExactScore && scoreDerivedBTTS !== null ? !scoreDerivedBTTS : undefined}
          delay={tiers.length * 0.05}
          linkKey="btts"
          linked={linkedTiers.has('btts')}
          canLink={tierActive.btts}
          onToggleLink={toggleLink}
        />
      </LockedTier>
      <LockedTier locked={!!isNewUser}>
        <InlineBoolTier
          label={t('totalGoals')}
          pts={POINTS.TIER6_OVER_UNDER}
          active={overUnder !== null}
          color={TIER_COLORS[tiers.length + 1]}
          value={overUnder === null ? null : overUnder === 'over'}
          onChange={(v) => { haptic('selection'); playSound('toggle_click'); setOverUnder(v === null ? null : v ? 'over' : 'under'); setSaved(false); }}
          yesLabel="O 2.5"
          noLabel="U 2.5"
          impossibleValue={hasExactScore && scoreDerivedOU !== null ? scoreDerivedOU === 'under' : undefined}
          delay={(tiers.length + 1) * 0.05}
          linkKey="ou"
          linked={linkedTiers.has('ou')}
          canLink={tierActive.ou}
          onToggleLink={toggleLink}
        />
      </LockedTier>

      {/* Coin cost bar + submit */}
      <AnimatePresence>
        {hasAnyPrediction && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="pt-1 space-y-2"
          >
            {/* Coin summary row + Risk Meter */}
            <div className="px-3 py-2.5 rounded-xl bg-amber-500/6 border border-amber-500/15 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] font-headline uppercase tracking-wider">Cost</span>
                  <span className="flex items-center gap-1 text-amber-400 font-display font-bold tabular-nums text-xs">
                    <CoinIcon size={13} /> <NumberFlow value={displayCost} />
                    {netCost < 0 && <span className="text-emerald-400 ms-1 text-[10px]">(+{Math.abs(netCost)} refund)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] font-headline uppercase tracking-wider">Balance</span>
                  <span className={cn('flex items-center gap-1 font-display font-bold tabular-nums text-xs', insufficientCoins ? 'text-red-400' : 'text-white/70')}>
                    <CoinIcon size={13} /> <NumberFlow value={coins} />
                  </span>
                </div>
              </div>
              {/* Risk Meter — a live gauge, not a slider. There is no
                  discretionary stake in this economy to drag/choose; this
                  bar only ever reflects the cost your current tier
                  selections already computed, animating gold -> warning as
                  that cost approaches your balance. */}
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: interpolateRisk(riskRatio).color }}
                  animate={{ width: `${riskRatio * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            </div>
            {insufficientCoins && (
              <p className="text-red-400 text-[11px] text-center px-2">
                Not enough coins — remove some tiers or wait for your daily bonus
              </p>
            )}
            <MagneticButtonV2
              variant={saved ? 'ghost' : 'volt'}
              size="lg"
              onClick={handleSubmit}
              disabled={insufficientCoins || saving}
              className="w-full"
            >
              {saving ? '···' : saved ? `✓ ${t('predictionSaved')}` : t('lockInPrediction')}
            </MagneticButtonV2>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================================
// Sub-components
// ============================================================

// V5 Sprint 34 — "The Prediction Matrix". A small chain-link toggle shared
// by TierRow (tiers 1-3) and InlineBoolTier (BTTS, O/U) — the two separate
// render paths a canonical tier can come from (PredictionForm has no single
// unified list of all 5 tiers). Only interactive when the tier currently
// has an active value (mirrors the RPC's own linkage validation, migration
// 054); an inactive tier's icon renders dimmed and non-interactive rather
// than just being absent — the same "a disabled element must look
// disabled" rule already applied to the Corners guard (§21/§41).
function ChainLinkToggle({
  linked, canLink, onToggle, color,
}: {
  linked: boolean;
  canLink: boolean;
  onToggle: () => void;
  color: typeof TIER_COLORS[number];
}) {
  const { t } = useLangStore();
  return (
    <button
      type="button"
      onClick={canLink ? onToggle : undefined}
      disabled={!canLink}
      aria-pressed={linked}
      title={canLink ? t('parlayChainToggle') : t('parlayChainToggleDisabled')}
      className={cn(
        'shrink-0 flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 active:scale-90',
        !canLink
          ? 'opacity-25 cursor-not-allowed bg-white/3 border-white/6 text-text-muted'
          : linked
            ? cn('border-current text-current bg-current/15', color.pts)
            : 'bg-white/4 border-white/10 text-text-muted hover:bg-white/8 hover:text-text-primary',
      )}
    >
      <Link2 size={12} strokeWidth={2.5} />
    </button>
  );
}

function TierRow({
  label, pts, ptsNote, active, color, children, disabled, disabledTooltip,
  linkKey, linked, canLink, onToggleLink,
}: {
  label: string;
  pts: number;
  ptsNote?: string;
  active: boolean;
  color: typeof TIER_COLORS[number];
  children: React.ReactNode;
  /** V4 Sprint 26 — this specific match's league doesn't reliably report
      this stat (LEAGUES_WITHOUT_CORNERS or corners_supported===false).
      Dims the row and surfaces disabledTooltip via InfoTip next to the
      label — never just a silently-missing tier (rule: a disabled
      interactive element must look disabled, not just behave disabled,
      CLAUDE.md §21). */
  disabled?: boolean;
  disabledTooltip?: string;
  /** V5 Sprint 34 — omit linkKey entirely to keep a tier out of parlay
      chaining altogether (not used today, but keeps the prop optional). */
  linkKey?: ParlayTierKey;
  linked?: boolean;
  canLink?: boolean;
  onToggleLink?: (key: ParlayTierKey) => void;
}) {
  const { t } = useLangStore();
  return (
    <div className={cn(
      'rounded-xl border p-2.5 transition-all duration-200',
      disabled
        ? 'bg-white/2 border-white/6 opacity-60'
        : active
          ? 'bg-white/5 border-white/12 tier-row-active'
          : 'bg-white/2 border-white/6 tier-row-inactive',
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', disabled ? 'bg-text-muted/40' : color.dot)} />
          <span className="text-text-primary text-xs sm:text-[13px] font-headline uppercase tracking-wider leading-none">{label}</span>
          {disabled && disabledTooltip && <InfoTip text={disabledTooltip} />}
        </div>
        <div className="flex items-center gap-1.5">
          {ptsNote && (
            <span className="text-text-muted text-[9px] font-display italic opacity-40">{ptsNote}</span>
          )}
          <span className={cn('text-[10px] font-display font-semibold tabular-nums', !disabled && active ? color.pts : 'text-text-muted opacity-35')}>
            +{pts} {t('pts')}
          </span>
          {linkKey && !disabled && onToggleLink && (
            <ChainLinkToggle
              linked={!!linked}
              canLink={!!canLink}
              onToggle={() => onToggleLink(linkKey)}
              color={color}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function InlineBoolTier({
  label, pts, active, color, value, onChange, yesLabel, noLabel, impossibleValue, delay,
  linkKey, linked, canLink, onToggleLink,
}: {
  label: string;
  pts: number;
  active: boolean;
  color: typeof TIER_COLORS[number];
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesLabel: string;
  noLabel: string;
  impossibleValue?: boolean;
  delay?: number;
  linkKey?: ParlayTierKey;
  linked?: boolean;
  canLink?: boolean;
  onToggleLink?: (key: ParlayTierKey) => void;
}) {
  const { t } = useLangStore();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0, type: 'spring', stiffness: 200, damping: 24 }}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-200',
        active ? 'bg-white/5 border-white/12 tier-row-active' : 'bg-white/2 border-white/6 tier-row-inactive',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color.dot)} />
      <span className="text-text-primary text-xs sm:text-[13px] font-headline uppercase tracking-wider flex-1 leading-none">{label}</span>
      <span className={cn('text-[10px] font-display font-semibold tabular-nums shrink-0', active ? color.pts : 'text-text-muted opacity-35')}>
        +{pts} {t('pts')}
      </span>
      {linkKey && onToggleLink && (
        <ChainLinkToggle
          linked={!!linked}
          canLink={!!canLink}
          onToggle={() => onToggleLink(linkKey)}
          color={color}
        />
      )}
      <div className="flex gap-1 shrink-0">
        {([true, false] as const).map((v) => {
          const isImpossible = impossibleValue !== undefined && impossibleValue === v;
          const isSelected = value === v;
          return (
            <button
              key={String(v)}
              onClick={() => { if (!isImpossible) onChange(isSelected ? null : v); }}
              disabled={isImpossible}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] border whitespace-nowrap active:scale-95',
                isSelected && !isImpossible
                  ? cn('border-current text-current bg-current/10 -translate-y-px', color.pts, color.emboss)
                  : isImpossible
                  ? 'opacity-25 cursor-not-allowed bg-white/3 border-white/5 text-text-muted'
                  : cn('bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:text-text-primary', DEBOSS_SHADOW),
              )}
            >
              {v ? yesLabel : noLabel}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function OutcomePicker({
  value, onChange, homeTeam, awayTeam, color, lockedByScore, odds,
}: {
  value: OutcomeOption | null;
  onChange: (v: OutcomeOption) => void;
  homeTeam: string;
  awayTeam: string;
  color: typeof TIER_COLORS[number];
  lockedByScore?: boolean;
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
}) {
  const { t } = useLangStore();
  const prob: Record<OutcomeOption, number | null> = odds
    ? { H: Math.round(odds.homeWin * 100), D: Math.round(odds.draw * 100), A: Math.round(odds.awayWin * 100) }
    : { H: null, D: null, A: null };

  const options: { val: OutcomeOption; label: string }[] = [
    { val: 'H', label: homeTeam.split(' ').pop() || t('home') },
    { val: 'D', label: t('draw') },
    { val: 'A', label: awayTeam.split(' ').pop() || t('away') },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map(({ val, label }) => (
        <button
          key={val}
          onClick={() => { if (!lockedByScore) onChange(val); }}
          disabled={lockedByScore}
          className={cn(
            'py-1.5 rounded-lg transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] border active:scale-95',
            value === val
              ? cn('border-current text-current bg-current/10 -translate-y-px', color.pts, color.emboss)
              : cn('bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary', DEBOSS_SHADOW),
            lockedByScore && value !== val && 'opacity-40 cursor-not-allowed',
          )}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="truncate w-full text-center text-sm sm:text-[15px] font-display font-semibold">{label}</span>
            {prob[val] !== null && (
              <span className="font-display text-[10px] sm:text-[11px] opacity-35 leading-none tabular-nums">{prob[val]}%</span>
            )}
          </div>
        </button>
      ))}
      {lockedByScore && (
        <div className="col-span-3 text-center text-[11px] font-display text-text-muted opacity-45 mt-0.5 italic">
          ↑ auto from score
        </div>
      )}
    </div>
  );
}

function ScorePicker({
  homeValue, awayValue, onHomeChange, onAwayChange,
}: {
  homeValue: string; awayValue: string;
  onHomeChange: (v: string) => void; onAwayChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ScoreStepper value={homeValue} onChange={onHomeChange} />
      <span className="text-text-muted text-base font-display font-bold shrink-0">—</span>
      <ScoreStepper value={awayValue} onChange={onAwayChange} />
    </div>
  );
}

// A tap-driven stepper, not a native <input type="number">. The native
// number keyboard, opening inside a Vaul bottom sheet that's already
// `position: fixed`, forced the visual viewport to resize on focus — the
// whole sheet visibly jumped/reflowed on open (reported live, on a real
// phone). A stepper has no focusable text field and never triggers the
// keyboard at all, which doesn't just work around the jump, it makes it
// structurally impossible: there's nothing here for iOS/Android to attach
// a keyboard to.
const SCORE_MAX = 20;

function ScoreStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const numValue = value === '' ? null : parseInt(value, 10);
  const canDecrement = numValue !== null && numValue > 0;
  const canIncrement = numValue === null || numValue < SCORE_MAX;

  const step = (delta: 1 | -1) => {
    if (delta === 1 && !canIncrement) return;
    if (delta === -1 && !canDecrement) return;
    haptic('selection');
    playSound('toggle_click');
    const next = Math.max(0, Math.min(SCORE_MAX, (numValue ?? -1) + delta));
    onChange(String(next));
  };

  const btnBase = 'w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg border flex items-center justify-center transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90';
  const btnEnabled = cn('bg-white/4 border-white/8 text-text-primary hover:bg-yellow-400/10 hover:border-yellow-400/40', DEBOSS_SHADOW);
  const btnDisabled = 'bg-white/2 border-white/5 text-text-muted/30 cursor-not-allowed';

  return (
    <div className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-lg border border-border-subtle bg-transparent">
      <button
        type="button"
        aria-label="decrement"
        onClick={() => step(-1)}
        disabled={!canDecrement}
        className={cn(btnBase, canDecrement ? btnEnabled : btnDisabled)}
      >
        <Minus size={14} strokeWidth={3} />
      </button>

      <div className="w-8 text-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={numValue ?? 'empty'}
            initial={{ y: -14, opacity: 0, scale: 1.2 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22, mass: 0.7 }}
            className={cn(
              'inline-block text-lg font-mono font-bold tabular-nums',
              numValue === null ? 'text-text-muted/40' : 'text-yellow-400',
            )}
          >
            {/* Deliberately NOT "0" for the unset state — a real committed
                0 and a dimmed placeholder "0" read as the exact same glyph
                at a glance, so the first tap (unset -> 0) looked like
                nothing had happened, even though it had just silently
                committed a real, coin-costing prediction (and, via the
                score->outcome auto-derivation below, locked Full Time
                Result too). An em-dash placeholder makes "you have not
                picked a value yet" vs. "you picked 0" two unmistakably
                different glyphs — first tap has to visibly *replace* the
                dash with a digit. */}
            {numValue === null ? '—' : numValue}
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        type="button"
        aria-label="increment"
        onClick={() => step(1)}
        disabled={!canIncrement}
        className={cn(btnBase, canIncrement ? btnEnabled : btnDisabled)}
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  );
}

function BoolPicker({
  value, onChange, yesLabel, noLabel, color, impossibleValue,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesLabel: string;
  noLabel: string;
  color: typeof TIER_COLORS[number];
  /** When set, this specific option is disabled because the score makes it impossible. */
  impossibleValue?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {([true, false] as const).map((v) => {
        const isImpossible = impossibleValue !== undefined && impossibleValue === v;
        const isSelected = value === v;
        return (
          <button
            key={String(v)}
            onClick={() => { if (!isImpossible) onChange(isSelected ? null : v); }}
            disabled={isImpossible}
            title={isImpossible ? 'Not possible with your score' : undefined}
            className={cn(
              'py-1.5 rounded-lg text-xs font-semibold transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] border relative active:scale-95',
              isSelected && !isImpossible
                ? cn('border-current text-current bg-current/10 -translate-y-px', color.pts, color.emboss)
                : isImpossible
                ? 'opacity-30 cursor-not-allowed bg-white/3 border-white/5 text-text-muted line-through'
                : cn('bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary', DEBOSS_SHADOW),
            )}
          >
            {v ? yesLabel : noLabel}
          </button>
        );
      })}
    </div>
  );
}

// Shows what user predicted + whether it's correct/earning for a single tier
function TierBreakdownRow({ tier, prediction, match, delay }: {
  tier: import('../../lib/utils').TierResult;
  prediction: Prediction;
  match: Match;
  delay: number;
}) {
  const { t, lang } = useLangStore();

  // Map calcBreakdown keys → i18n labels
  const tierLabel: Record<string, string> = {
    result: t('tierResult'),
    score: t('tierScore'),
    ht: t('halfTimeResult'),
    corners: t('tierCorners'),
    btts: t('tierBTTS'),
    ou: t('tierOU'),
  };

  const outcomeLabel = (v: 'H' | 'D' | 'A' | null) =>
    v === 'H' ? (lang === 'he' ? tTeam(match.home_team) : match.home_team).split(' ').pop() || t('home')
    : v === 'A' ? (lang === 'he' ? tTeam(match.away_team) : match.away_team).split(' ').pop() || t('away')
    : v === 'D' ? t('draw') : null;

  const predDetail = (() => {
    switch (tier.key) {
      case 'result': return prediction.predicted_outcome ? outcomeLabel(prediction.predicted_outcome) : null;
      case 'score': return prediction.predicted_home_score !== null
        ? `${prediction.predicted_home_score}–${prediction.predicted_away_score}` : null;
      case 'ht': return prediction.predicted_halftime_outcome ? outcomeLabel(prediction.predicted_halftime_outcome) : null;
      case 'corners': return prediction.predicted_corners === 'under9' ? t('cornersUnder9')
        : prediction.predicted_corners === 'ten' ? t('cornersTen')
        : prediction.predicted_corners === 'over11' ? t('cornersOver11') : null;
      case 'btts': return prediction.predicted_btts !== null ? (prediction.predicted_btts ? t('yes') : t('no')) : null;
      case 'ou': return prediction.predicted_over_under
        ? (prediction.predicted_over_under === 'over' ? t('over25') : t('under25')) : null;
      default: return null;
    }
  })();

  const isPending = tier.pending === true;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
        tier.earned
          ? 'bg-accent-green/8 border border-accent-green/15'
          : isPending
            ? 'bg-blue-500/6 border border-blue-500/15'
            : 'bg-white/3 border border-white/5'
      }`}
    >
      <span className={`flex items-center gap-1.5 min-w-0 ${
        tier.earned ? 'text-accent-green' : isPending ? 'text-blue-400 opacity-70' : 'text-text-muted opacity-60'
      }`}>
        <span className="shrink-0">{tier.earned ? '✓' : isPending ? '…' : '✗'}</span>
        <span className="shrink-0">{tierLabel[tier.key] ?? tier.label}</span>
        {predDetail && (
          <span className={`truncate font-semibold ${tier.earned ? 'text-accent-green' : isPending ? 'text-blue-300/60' : 'text-white/40'}`}>
            · {predDetail}
          </span>
        )}
        {isPending && <span className="text-[9px] text-blue-400/60 shrink-0">{t('pendingLabel')}</span>}
      </span>
      <span className={`shrink-0 font-bold tabular-nums ${
        tier.earned ? 'text-accent-green' : isPending ? 'text-blue-400/50' : 'text-text-muted opacity-40'
      }`}>
        {tier.earned ? `+${tier.pts}` : isPending ? '?' : '0'}
      </span>
    </motion.div>
  );
}

export function LockedPrediction({
  match, prediction, resolved,
}: {
  match: Match;
  prediction: Prediction | undefined;
  resolved: boolean;
}) {
  const { t } = useLangStore();

  if (!prediction) {
    return (
      <div className="py-3 text-center text-text-muted text-sm opacity-60">{t('predictionLocked')}</div>
    );
  }

  const outcomeLabel = (v: 'H' | 'D' | 'A' | null) =>
    v === 'H' ? t('home') : v === 'A' ? t('away') : v === 'D' ? t('draw') : '—';

  const isLive = LIVE_STATUSES.includes(match.status);
  const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now();
  const isInProgress = isLive || isPastKickoffNS;
  const hasLiveScore = match.home_score !== null && match.away_score !== null;

  const breakdown = resolved ? calcBreakdown(prediction, match) : null;
  // During ET, evaluate against the 90-min regulation score (not the ET-modified score)
  const isETInProgress = isInProgress && ['ET1', 'ET2', 'AET', 'PEN'].includes(match.status);
  const liveBreakdown = !resolved && isInProgress && hasLiveScore
    ? calcLiveBreakdown(prediction, match)
    : null;
  const livePotential = liveBreakdown ? liveBreakdown.filter(r => r.earned && !r.pending).reduce((s, r) => s + r.pts, 0) : 0;
  // Score to display in the live banner — show 90-min score during ET, not the ET score
  const bannerHome = isETInProgress && match.regulation_home !== null ? match.regulation_home : match.home_score;
  const bannerAway = isETInProgress && match.regulation_away !== null ? match.regulation_away : match.away_score;

  return (
    <div className="space-y-2">
      {/* Points earned banner (resolved) */}
      {resolved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl border ${
            prediction.points_earned > 0
              ? 'bg-accent-green/10 border-accent-green/20'
              : 'bg-white/4 border-white/8'
          }`}
        >
          <span className={`text-sm font-semibold ${prediction.points_earned > 0 ? 'text-accent-green' : 'text-text-muted opacity-60'}`}>
            {prediction.points_earned > 0 ? `+${prediction.points_earned} ${t('ptsEarned')}` : t('noPoints')}
          </span>
        </motion.div>
      )}

      {/* Live potential points banner */}
      {liveBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-accent-green/8 border border-accent-green/25"
        >
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-accent-green shrink-0"
            />
            <div className="flex flex-col">
              <span className="text-[11px] text-accent-green/70 font-medium leading-tight">
                {isETInProgress ? 'Live • 90′ score' : 'Live • If final score'}
              </span>
              <span className="text-xs text-white/70 font-semibold">{bannerHome} — {bannerAway}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 leading-tight">you collect</span>
            <span className={`text-xl font-bebas tracking-wide ${livePotential > 0 ? 'text-accent-green' : 'text-text-muted opacity-40'}`}>
              {livePotential > 0 ? `+${livePotential}` : '0'} <span className="text-sm">{t('pts')}</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Per-tier breakdown when resolved */}
      {breakdown && breakdown.length > 0 ? (
        <div className="space-y-1">
          {breakdown.map((tier, i) => (
            <TierBreakdownRow
              key={tier.key}
              tier={tier}
              prediction={prediction}
              match={match}
              delay={i * 0.05}
            />
          ))}
        </div>
      ) : liveBreakdown && liveBreakdown.length > 0 ? (
        /* Live in-progress: show tier-by-tier potential with user's prediction */
        <div className="space-y-1">
          {liveBreakdown.map((tier, i) => (
            <TierBreakdownRow
              key={tier.key}
              tier={tier}
              prediction={prediction}
              match={match}
              delay={i * 0.05}
            />
          ))}
        </div>
      ) : (
        /* Non-resolved, no live score: show what was predicted */
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          {prediction.predicted_outcome && (
            <Pill label={t('result')} value={outcomeLabel(prediction.predicted_outcome)} />
          )}
          {prediction.predicted_home_score !== null && prediction.predicted_away_score !== null && (
            <Pill label={t('score')} value={`${prediction.predicted_home_score} — ${prediction.predicted_away_score}`} />
          )}
          {prediction.predicted_halftime_outcome && (
            <Pill label={t('halfTimeResult')} value={outcomeLabel(prediction.predicted_halftime_outcome)} />
          )}
          {prediction.predicted_corners && (
            <Pill label={t('corners')} value={
              prediction.predicted_corners === 'under9' ? t('cornersUnder9') :
              prediction.predicted_corners === 'ten' ? t('cornersTen') : t('cornersOver11')
            } />
          )}
          {prediction.predicted_btts !== null && (
            <Pill label={t('btts')} value={prediction.predicted_btts ? t('yes') : t('no')} />
          )}
          {prediction.predicted_over_under && (
            <Pill label={t('goals')} value={prediction.predicted_over_under === 'over' ? t('over25') : t('under25')} />
          )}
        </div>
      )}
    </div>
  );
}

function CornersPicker({
  value, onChange, color, disabled,
}: {
  value: 'under9' | 'ten' | 'over11' | null;
  onChange: (v: 'under9' | 'ten' | 'over11' | null) => void;
  color: typeof TIER_COLORS[number];
  /** V4 Sprint 26 — every chip renders debossed-only (never the selected/
      emboss state, even if a stale historical value exists) and becomes
      genuinely inert: real disabled attribute (not just a no-op onClick),
      cursor-not-allowed, no hover/active feedback. */
  disabled?: boolean;
}) {
  const { t } = useLangStore();
  const options: { val: 'under9' | 'ten' | 'over11'; label: string }[] = [
    { val: 'under9', label: t('cornersUnder9') },
    { val: 'ten',    label: t('cornersTen')    },
    { val: 'over11', label: t('cornersOver11') },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map(({ val, label }) => (
        <button
          key={val}
          disabled={disabled}
          onClick={() => { if (!disabled) onChange(value === val ? null : val); }}
          className={cn(
            'py-1.5 rounded-lg text-xs sm:text-[13px] font-display font-semibold transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] border',
            disabled
              ? cn('bg-white/2 border-white/6 text-text-muted/50 cursor-not-allowed', DEBOSS_SHADOW)
              : cn('active:scale-95', value === val
                  ? cn('border-current text-current bg-current/10 -translate-y-px', color.pts, color.emboss)
                  : cn('bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary', DEBOSS_SHADOW)),
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
      <span className="text-text-muted text-xs">{label}</span>
      <span className="text-text-primary text-sm font-semibold mt-0.5">{value}</span>
    </div>
  );
}
