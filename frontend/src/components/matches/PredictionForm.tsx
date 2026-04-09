import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { MagneticButtonV2 } from '../ui/MagneticButtonV2';
import { CoinIcon } from '../ui/CoinIcon';
import { cn, isMatchLocked, calcBreakdown, calcLiveBreakdown } from '../../lib/utils';
import { LIVE_STATUSES, POINTS, calcPredictionCost } from '../../lib/constants';

// International Friendlies: hundreds of matches per week, corners never tracked
const LEAGUES_WITHOUT_CORNERS = new Set([4396]);
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';

interface PredictionFormProps {
  match: Match;
  existingPrediction: Prediction | undefined;
  onSave: (data: PredictionData) => Promise<void>;
  saving: boolean;
  /** Normalised implied probabilities from ESPN odds (0–1 each, sum ≈ 1) */
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
}

export interface PredictionData {
  match_id: string;
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_corners: 'under9' | 'ten' | 'over11' | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
}

type OutcomeOption = 'H' | 'D' | 'A';

const TIER_COLORS = [
  { dot: 'bg-emerald-400', pts: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.3)]' },
  { dot: 'bg-yellow-400',  pts: 'text-yellow-400',  glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]'  },
  { dot: 'bg-blue-400',    pts: 'text-blue-400',    glow: 'shadow-[0_0_12px_rgba(96,165,250,0.3)]'  },
  { dot: 'bg-orange-400',  pts: 'text-orange-400',  glow: 'shadow-[0_0_12px_rgba(251,146,60,0.3)]'  },
  { dot: 'bg-purple-400',  pts: 'text-purple-400',  glow: 'shadow-[0_0_12px_rgba(192,132,252,0.3)]' },
];

function deriveOutcomeFromScore(home: string, away: string): OutcomeOption | null {
  const h = parseInt(home);
  const a = parseInt(away);
  if (isNaN(h) || isNaN(a) || home === '' || away === '') return null;
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

export const PredictionForm = memo(function PredictionForm({ match, existingPrediction, onSave, saving, odds }: PredictionFormProps) {
  const { t } = useLangStore();
  const locked = isMatchLocked(match.kickoff_time) || match.status !== 'NS';
  const resolved = existingPrediction?.is_resolved ?? false;

  const [outcome, setOutcome] = useState<OutcomeOption | null>(existingPrediction?.predicted_outcome ?? null);
  const [homeScore, setHomeScore] = useState<string>(existingPrediction?.predicted_home_score?.toString() ?? '');
  const [awayScore, setAwayScore] = useState<string>(existingPrediction?.predicted_away_score?.toString() ?? '');
  const [cornersValue, setCornersValue] = useState<'under9' | 'ten' | 'over11' | null>(existingPrediction?.predicted_corners ?? null);
  const [btts, setBtts] = useState<boolean | null>(existingPrediction?.predicted_btts ?? null);
  const [overUnder, setOverUnder] = useState<'over' | 'under' | null>(existingPrediction?.predicted_over_under ?? null);
  const [saved, setSaved] = useState(!!existingPrediction);

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

  const handleSubmit = async () => {
    await onSave({
      match_id: match.id,
      predicted_outcome: outcome,
      predicted_home_score: homeScore !== '' ? parseInt(homeScore) : null,
      predicted_away_score: awayScore !== '' ? parseInt(awayScore) : null,
      predicted_corners: cornersValue,
      predicted_btts: btts,
      predicted_over_under: overUnder,
    });
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

  if (locked) {
    return <LockedPrediction match={match} prediction={existingPrediction} resolved={resolved} />;
  }

  const tiers = [
    {
      key: 'tier1',
      label: t('fullTimeResult'),
      pts: POINTS.TIER1_OUTCOME,
      active: outcome !== null,
      content: (
        <OutcomePicker
          value={outcome}
          onChange={(v) => { setOutcome(v); setSaved(false); }}
          homeTeam={match.home_team}
          awayTeam={match.away_team}
          color={TIER_COLORS[0]}
          lockedByScore={hasExactScore}
          odds={odds}
        />
      ),
    },
    {
      key: 'tier2',
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
    ...(!LEAGUES_WITHOUT_CORNERS.has(match.league_id) ? [{
      key: 'tier3',
      label: t('totalCorners'),
      pts: POINTS.TIER3_CORNERS,
      active: cornersValue !== null,
      content: (
        <CornersPicker
          value={cornersValue}
          onChange={(v) => { setCornersValue(v); setSaved(false); }}
          color={TIER_COLORS[2]}
        />
      ),
    }] : []),
  ];

  return (
    <div className="space-y-1.5">
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
          >
            {tier.content}
          </TierRow>
        </motion.div>
      ))}

      {/* BTTS + O/U as compact single-line rows */}
      <InlineBoolTier
        label={t('bothTeamsToScore')}
        pts={POINTS.TIER5_BTTS}
        active={btts !== null}
        color={TIER_COLORS[tiers.length]}
        value={btts}
        onChange={(v) => { setBtts(v); setSaved(false); }}
        yesLabel={t('yes')}
        noLabel={t('no')}
        impossibleValue={hasExactScore && scoreDerivedBTTS !== null ? !scoreDerivedBTTS : undefined}
        delay={tiers.length * 0.05}
      />
      <InlineBoolTier
        label={t('totalGoals')}
        pts={POINTS.TIER6_OVER_UNDER}
        active={overUnder !== null}
        color={TIER_COLORS[tiers.length + 1]}
        value={overUnder === null ? null : overUnder === 'over'}
        onChange={(v) => { setOverUnder(v === null ? null : v ? 'over' : 'under'); setSaved(false); }}
        yesLabel="O 2.5"
        noLabel="U 2.5"
        impossibleValue={hasExactScore && scoreDerivedOU !== null ? scoreDerivedOU === 'under' : undefined}
        delay={(tiers.length + 1) * 0.05}
      />

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
            {/* Coin summary row */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/6 border border-amber-500/15 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">Cost</span>
                <span className="flex items-center gap-1 text-amber-400 font-bold tabular-nums">
                  <CoinIcon size={13} /> {netCost > 0 ? netCost : currentCost}
                  {netCost < 0 && <span className="text-emerald-400 ms-1">(+{Math.abs(netCost)} refund)</span>}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">Balance</span>
                <span className={cn('flex items-center gap-1 font-bold tabular-nums', insufficientCoins ? 'text-red-400' : 'text-white/70')}>
                  <CoinIcon size={13} /> {coins}
                </span>
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

function TierRow({
  label, pts, ptsNote, active, color, children,
}: {
  label: string;
  pts: number;
  ptsNote?: string;
  active: boolean;
  color: typeof TIER_COLORS[number];
  children: React.ReactNode;
}) {
  const { t } = useLangStore();
  return (
    <div className={cn(
      'rounded-xl border p-2 transition-all duration-200',
      active
        ? 'bg-white/5 border-white/12 tier-row-active'
        : 'bg-white/2 border-white/6 tier-row-inactive',
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color.dot)} />
          <span className="text-text-muted text-xs font-medium tracking-wide">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {ptsNote && (
            <span className="text-text-muted text-xs opacity-60">{ptsNote}</span>
          )}
          <span className={cn('text-xs font-bold tabular-nums', active ? color.pts : 'text-text-muted opacity-50')}>
            +{pts} {t('pts')}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function InlineBoolTier({
  label, pts, active, color, value, onChange, yesLabel, noLabel, impossibleValue, delay,
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
      <span className="text-text-muted text-[10px] font-medium flex-1 leading-tight">{label}</span>
      <span className={cn('text-[10px] font-bold tabular-nums me-1 shrink-0', active ? color.pts : 'text-text-muted opacity-40')}>
        +{pts} {t('pts')}
      </span>
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
                'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all duration-150 border whitespace-nowrap',
                isSelected && !isImpossible
                  ? cn('border-current text-current bg-current/10', color.pts)
                  : isImpossible
                  ? 'opacity-25 cursor-not-allowed bg-white/3 border-white/5 text-text-muted'
                  : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:text-text-primary',
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
            'py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border',
            value === val
              ? cn('border-current text-current bg-current/10', color.pts, color.glow)
              : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary',
            lockedByScore && value !== val && 'opacity-40 cursor-not-allowed',
          )}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="truncate w-full text-center">{label}</span>
            {prob[val] !== null && (
              <span className="font-barlow text-[9px] opacity-45 leading-none">{prob[val]}%</span>
            )}
          </div>
        </button>
      ))}
      {lockedByScore && (
        <div className="col-span-3 text-center text-xs text-text-muted opacity-60 mt-0.5">
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
      <ScoreInput value={homeValue} onChange={onHomeChange} />
      <span className="text-text-muted text-base font-bold shrink-0">—</span>
      <ScoreInput value={awayValue} onChange={onAwayChange} />
    </div>
  );
}

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      min="0"
      max="20"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className="flex-1 py-1.5 text-center text-lg font-bebas tracking-wider rounded-lg border bg-transparent border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-yellow-400/60 focus:bg-yellow-400/5 transition-all duration-150"
      style={{ WebkitAppearance: 'none', opacity: 1 }}
    />
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
              'py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border relative',
              isSelected && !isImpossible
                ? cn('border-current text-current bg-current/10', color.pts, color.glow)
                : isImpossible
                ? 'opacity-30 cursor-not-allowed bg-white/3 border-white/5 text-text-muted line-through'
                : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary',
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
  const { t } = useLangStore();
  const outcomeLabel = (v: 'H' | 'D' | 'A' | null) =>
    v === 'H' ? match.home_team.split(' ').pop() || t('home')
    : v === 'A' ? match.away_team.split(' ').pop() || t('away')
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
        <span className="shrink-0">{tier.label}</span>
        {predDetail && (
          <span className={`truncate font-semibold ${tier.earned ? 'text-accent-green' : isPending ? 'text-blue-300/60' : 'text-white/40'}`}>
            · {predDetail}
          </span>
        )}
        {isPending && <span className="text-[9px] text-blue-400/60 shrink-0">pending</span>}
      </span>
      <span className={`shrink-0 font-bold tabular-nums ${
        tier.earned ? 'text-accent-green' : isPending ? 'text-blue-400/50' : 'text-text-muted opacity-40'
      }`}>
        {tier.earned ? `+${tier.pts}` : isPending ? '?' : '0'}
      </span>
    </motion.div>
  );
}

function LockedPrediction({
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
              {livePotential > 0 ? `+${livePotential}` : '0'} <span className="text-sm">pts</span>
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
            <Pill label="Half Time" value={outcomeLabel(prediction.predicted_halftime_outcome)} />
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
  value, onChange, color,
}: {
  value: 'under9' | 'ten' | 'over11' | null;
  onChange: (v: 'under9' | 'ten' | 'over11' | null) => void;
  color: typeof TIER_COLORS[number];
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
          // Clicking the already-selected option deselects it (returns null = removes this tier)
          onClick={() => onChange(value === val ? null : val)}
          className={cn(
            'py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border',
            value === val
              ? cn('border-current text-current bg-current/10', color.pts, color.glow)
              : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary',
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
