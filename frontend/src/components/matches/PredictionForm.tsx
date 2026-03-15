import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { NeonButton } from '../ui/NeonButton';
import { cn, isMatchLocked, calcBreakdown, calcLiveBreakdown } from '../../lib/utils';
import { LIVE_STATUSES } from '../../lib/constants';
import { POINTS } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';

interface PredictionFormProps {
  match: Match;
  existingPrediction: Prediction | undefined;
  onSave: (data: PredictionData) => Promise<void>;
  saving: boolean;
}

export interface PredictionData {
  match_id: string;
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_halftime_outcome: 'H' | 'D' | 'A' | null;
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

export function PredictionForm({ match, existingPrediction, onSave, saving }: PredictionFormProps) {
  const { t } = useLangStore();
  const locked = isMatchLocked(match.kickoff_time) || match.status !== 'NS';
  const resolved = existingPrediction?.is_resolved ?? false;

  const [outcome, setOutcome] = useState<OutcomeOption | null>(existingPrediction?.predicted_outcome ?? null);
  const [homeScore, setHomeScore] = useState<string>(existingPrediction?.predicted_home_score?.toString() ?? '');
  const [awayScore, setAwayScore] = useState<string>(existingPrediction?.predicted_away_score?.toString() ?? '');
  const [htOutcome, setHtOutcome] = useState<OutcomeOption | null>(existingPrediction?.predicted_halftime_outcome ?? null);
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
      setHtOutcome(existingPrediction.predicted_halftime_outcome ?? null);
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

  useEffect(() => {
    if (scoreDerivedOutcome !== null) setOutcome(scoreDerivedOutcome);
  }, [scoreDerivedOutcome]);

  useEffect(() => {
    if (scoreDerivedBTTS !== null) { setBtts(scoreDerivedBTTS); setSaved(false); }
  }, [scoreDerivedBTTS]);

  useEffect(() => {
    if (scoreDerivedOU !== null) { setOverUnder(scoreDerivedOU); setSaved(false); }
  }, [scoreDerivedOU]);

  const handleSubmit = async () => {
    await onSave({
      match_id: match.id,
      predicted_outcome: outcome,
      predicted_home_score: homeScore !== '' ? parseInt(homeScore) : null,
      predicted_away_score: awayScore !== '' ? parseInt(awayScore) : null,
      predicted_halftime_outcome: htOutcome,
      predicted_btts: btts,
      predicted_over_under: overUnder,
    });
    setSaved(true);
  };

  const hasAnyPrediction = outcome !== null || homeScore !== '' || htOutcome !== null || btts !== null || overUnder !== null;

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
        />
      ),
    },
    {
      key: 'tier2',
      label: t('exactScore'),
      pts: POINTS.TIER2_EXACT_SCORE,
      ptsNote: hasExactScore ? '+10 w/ result' : '+7',
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
      key: 'tier3',
      label: t('halfTimeResult'),
      pts: POINTS.TIER3_HALFTIME,
      active: htOutcome !== null,
      content: (
        <OutcomePicker
          value={htOutcome}
          onChange={(v) => { setHtOutcome(v); setSaved(false); }}
          homeTeam={match.home_team}
          awayTeam={match.away_team}
          color={TIER_COLORS[2]}
        />
      ),
    },
    {
      key: 'tier5',
      label: t('bothTeamsToScore'),
      pts: POINTS.TIER5_BTTS,
      active: btts !== null,
      content: (
        <BoolPicker
          value={btts}
          onChange={(v) => { setBtts(v); setSaved(false); }}
          yesLabel={t('yes')}
          noLabel={t('no')}
          color={TIER_COLORS[3]}
          lockedByScore={hasExactScore}
        />
      ),
    },
    {
      key: 'tier6',
      label: t('totalGoals'),
      pts: POINTS.TIER6_OVER_UNDER,
      active: overUnder !== null,
      content: (
        <BoolPicker
          value={overUnder === null ? null : overUnder === 'over'}
          onChange={(v) => { setOverUnder(v === null ? null : v ? 'over' : 'under'); setSaved(false); }}
          yesLabel={t('over25')}
          noLabel={t('under25')}
          color={TIER_COLORS[4]}
          lockedByScore={hasExactScore}
        />
      ),
    },
  ];

  return (
    <div className="space-y-2">
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

      {/* Submit */}
      <AnimatePresence>
        {hasAnyPrediction && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="pt-1"
          >
            <NeonButton
              variant={saved ? 'ghost' : 'green'}
              size="lg"
              loading={saving}
              onClick={handleSubmit}
              className="w-full"
            >
              {saved ? `✓ ${t('predictionSaved')}` : t('lockInPrediction')}
            </NeonButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
      'rounded-xl border p-2.5 transition-all duration-200',
      active
        ? 'bg-white/5 border-white/12 tier-row-active'
        : 'bg-white/2 border-white/6 tier-row-inactive',
    )}>
      <div className="flex items-center justify-between mb-2">
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

function OutcomePicker({
  value, onChange, homeTeam, awayTeam, color, lockedByScore,
}: {
  value: OutcomeOption | null;
  onChange: (v: OutcomeOption) => void;
  homeTeam: string;
  awayTeam: string;
  color: typeof TIER_COLORS[number];
  lockedByScore?: boolean;
}) {
  const { t } = useLangStore();
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
            'py-2 rounded-lg text-sm font-semibold transition-all duration-150 border truncate',
            value === val
              ? cn('border-current text-current bg-current/10', color.pts, color.glow)
              : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary',
            lockedByScore && value !== val && 'opacity-40 cursor-not-allowed',
          )}
        >
          {label}
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
      className="flex-1 py-2 text-center text-xl font-bebas tracking-wider rounded-lg border bg-transparent border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-yellow-400/60 focus:bg-yellow-400/5 transition-all duration-150"
      style={{ WebkitAppearance: 'none', opacity: 1 }}
    />
  );
}

function BoolPicker({
  value, onChange, yesLabel, noLabel, color, lockedByScore,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesLabel: string;
  noLabel: string;
  color: typeof TIER_COLORS[number];
  lockedByScore?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          onClick={() => { if (!lockedByScore) onChange(value === v ? null : v); }}
          disabled={lockedByScore}
          className={cn(
            'py-2 rounded-lg text-sm font-semibold transition-all duration-150 border',
            value === v
              ? cn('border-current text-current bg-current/10', color.pts, color.glow)
              : 'bg-white/4 border-white/8 text-text-muted hover:bg-white/8 hover:border-white/15 hover:text-text-primary',
            lockedByScore && value !== v && 'opacity-40 cursor-not-allowed',
          )}
        >
          {v ? yesLabel : noLabel}
        </button>
      ))}
      {lockedByScore && (
        <div className="col-span-2 text-center text-xs text-text-muted opacity-60 mt-0.5">
          ↑ auto from score
        </div>
      )}
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
  const liveBreakdown = !resolved && isInProgress && hasLiveScore
    ? calcLiveBreakdown(prediction, match)
    : null;
  const livePotential = liveBreakdown ? liveBreakdown.filter(r => r.earned).reduce((s, r) => s + r.pts, 0) : 0;

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
              <span className="text-[11px] text-accent-green/70 font-medium leading-tight">Live • If final score</span>
              <span className="text-xs text-white/70 font-semibold">{match.home_score} — {match.away_score}</span>
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
          {/* Bonus rows — streak bonus (stored) + any unexplained gap (e.g. HT data changed) */}
          {(() => {
            const streakBonus = prediction.streak_bonus_earned ?? 0;
            const baseTotal = breakdown.filter(r => r.earned).reduce((s, r) => s + r.pts, 0);
            const unexplained = Math.max(0, (prediction.points_earned ?? 0) - baseTotal - streakBonus);
            return (
              <>
                {streakBonus > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: breakdown.length * 0.05 }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-yellow-500/10 border border-yellow-500/25"
                  >
                    <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                      <span>⚡</span>
                      <span>{t('streakBonus')}</span>
                      <span className="text-yellow-400/60 font-normal">· {t('threeInARow')}</span>
                    </span>
                    <span className="font-bold tabular-nums text-yellow-400">+{streakBonus}</span>
                  </motion.div>
                )}
                {unexplained > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (breakdown.length + 1) * 0.05 }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-yellow-500/10 border border-yellow-500/25"
                  >
                    <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                      <span>⚡</span>
                      <span>{t('streakBonus')}</span>
                      <span className="text-yellow-400/60 font-normal">· {t('threeInARow')}</span>
                    </span>
                    <span className="font-bold tabular-nums text-yellow-400">+{unexplained}</span>
                  </motion.div>
                )}
              </>
            );
          })()}
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

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
      <span className="text-text-muted text-xs">{label}</span>
      <span className="text-text-primary text-sm font-semibold mt-0.5">{value}</span>
    </div>
  );
}
