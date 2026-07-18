import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { smoothPath, type PathPoint } from '../../lib/svgPath';
import { PRESSURE_CLAMP } from '../../lib/matchBoxscore';
import { useMatchPressureFlow } from '../../hooks/useMatchPressureFlow';
import { InfoTip } from '../ui/InfoTip';
import type { Match } from '../../lib/supabase';

// V4 Sprint 32 — "The Live Pressure Cooker". A genuinely different case from
// MatchMomentumPulse.tsx's sparse event markers: the pressure samples here
// come from a real 30s-cadence time series (ESPN's boxscore deltas, see
// lib/matchBoxscore.ts), so a continuous smoothed curve is an honest
// representation, not fabricated precision — MatchMomentumPulse's own
// header comment explains why THAT component avoids smoothing; this one
// legitimately can, because the underlying data is structurally different.

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 60;
const ZERO_Y = VIEWBOX_HEIGHT / 2;
const MAX_AMPLITUDE = 24; // leaves a 6px margin top/bottom inside the viewBox

const PATH_TRANSITION = { duration: 0.8, ease: 'easeInOut' as const };

function samplesToAreaPath(samples: number[]): string {
  const points: PathPoint[] = samples.map((v, i) => ({
    x: (i / (samples.length - 1)) * VIEWBOX_WIDTH,
    y: ZERO_Y - (v / PRESSURE_CLAMP) * MAX_AMPLITUDE,
  }));
  const curve = smoothPath(points);
  if (!curve) return '';
  const lastX = points[points.length - 1].x;
  const firstX = points[0].x;
  // Close the curve back down to the zero-line baseline, then back to the
  // start — a closed shape following the curve on top, the baseline below.
  // The SAME closed path renders twice (see below), clipped to opposite
  // halves, so it produces a two-tone area chart without two separate
  // curve computations.
  return `${curve} L ${lastX} ${ZERO_Y} L ${firstX} ${ZERO_Y} Z`;
}

interface MatchMomentumFlowProps {
  match: Match;
}

// Minimum real (non-padding) samples before the curve is shown at all.
// Below this, most of the 20-slot window is still zero-padding from the
// hook's own initial state (it starts fresh on every mount, not from
// kickoff — see useMatchPressureFlow.ts), and the resulting line reads as
// a flat, broken-looking nothing rather than an honest "gathering data"
// state. 3 samples = ~90s at the 30s poll cadence.
const MIN_SAMPLES_TO_SHOW = 3;

export function MatchMomentumFlow({ match }: MatchMomentumFlowProps) {
  const { t, lang } = useLangStore();
  const { samples, hasData, sampleCount } = useMatchPressureFlow(match);
  const isRTL = lang === 'he';

  // SVG <defs> ids (gradients, clip paths) must be unique per instance — a
  // live match feed can render several of these simultaneously, and
  // colliding ids would make every instance render whichever one's defs
  // happen to land last in the DOM (the exact class of bug EntityBadge.tsx
  // deliberately avoided once already, Sprint 26, by not using inline SVG
  // gradients for a many-simultaneous-instances component). useId() is a
  // zero-dependency React 18 primitive — no new library for this.
  const uid = useId();
  const homeGradId = `pf-home-${uid}`;
  const awayGradId = `pf-away-${uid}`;
  const clipAboveId = `pf-above-${uid}`;
  const clipBelowId = `pf-below-${uid}`;

  const areaD = useMemo(() => samplesToAreaPath(samples), [samples]);

  // Hidden until real data exists — same convention as MatchMomentumPulse/
  // MatchTimeline/AIScoutCard. No skeleton: a loading flash on a secondary
  // panel is more noise than the eventual empty state.
  if (!hasData || !areaD) return null;

  // Real user report: opened a live match at minute 19 and saw an
  // essentially blank/flat chart. Root cause — this hook starts fresh on
  // every mount (not from kickoff), so the 20-slot/10-min rolling window
  // is still mostly its own zero-padding for a while after the card is
  // first expanded, regardless of match minute. Below MIN_SAMPLES_TO_SHOW
  // real samples, show an honest "gathering data" state instead of a
  // near-flat curve that reads as broken — consistent with this
  // codebase's standing rule to never let a modeled/incomplete value look
  // more confident than it actually is (§30's Oracle sample-size honesty,
  // GroupDistributionChart's modeled-curve disclosure).
  const isGathering = sampleCount < MIN_SAMPLES_TO_SHOW;

  return (
    <div className="mt-2 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center text-[9px] uppercase tracking-widest text-white/30">
          {t('pressureFlowTitle')}
          {/* Real user feedback: "not clear what this does, not intuitive."
              A diverging area chart with no legend/explanation reads as
              decorative noise, not data — dataviz skill's own rule 6
              ("a legend is always present for >=2 series, identity never
              color-alone") applies directly here. */}
          <InfoTip text={t('pressureFlowExplainer')} />
        </span>
        <p className="text-[9px] text-white/20">
          {isGathering ? t('pressureFlowGathering') : t('pressureFlowSubtitle')}
        </p>
      </div>

      {isGathering ? (
        <div className="h-14 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
        </div>
      ) : (
        // direction pinned to ltr regardless of page direction — the x-axis
        // encodes elapsed-time data (older -> newer, left -> right), a
        // coordinate fact, not a reading-direction one (same reasoning as
        // MatchMomentumPulse's own pin, and the Bento Arena heatmap fix).
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full h-14"
          style={{ direction: 'ltr' }}
          role="img"
          aria-label={t('pressureFlowTitle')}
        >
          <defs>
            <linearGradient id={homeGradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--pressure-home-start)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--pressure-home-end)" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id={awayGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pressure-away-start)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--pressure-away-end)" stopOpacity="0.85" />
            </linearGradient>
            <clipPath id={clipAboveId}>
              <rect x="0" y="0" width={VIEWBOX_WIDTH} height={ZERO_Y} />
            </clipPath>
            <clipPath id={clipBelowId}>
              <rect x="0" y={ZERO_Y} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT - ZERO_Y} />
            </clipPath>
          </defs>

          {/* soft zero-line the two gradients meet at */}
          <line x1="0" y1={ZERO_Y} x2={VIEWBOX_WIDTH} y2={ZERO_Y} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

          {/* initial={false}: on first mount there's no "previous" shape to
              morph from, so the very first paint should snap to the correct
              path immediately, not animate from nothing. Setting BOTH a
              static `d` prop and `animate.d` (an earlier draft did this)
              leaves Framer uncertain which one seeds the pre-animation DOM
              value and produced a real "undefined" path-data console error
              on first mount — caught during this sprint's own verification.
              `animate` alone, with `initial={false}`, is unambiguous. */}
          <g clipPath={`url(#${clipAboveId})`}>
            <motion.path initial={false} animate={{ d: areaD }} transition={PATH_TRANSITION} fill={`url(#${homeGradId})`} stroke="none" />
          </g>
          <g clipPath={`url(#${clipBelowId})`}>
            <motion.path initial={false} animate={{ d: areaD }} transition={PATH_TRANSITION} fill={`url(#${awayGradId})`} stroke="none" />
          </g>
        </svg>
      )}

      {/* Legend — per the dataviz skill's rule 6: a 2-series chart always
          needs a legend, and identity is never color-alone. Before this,
          the team names sat under the chart with no explicit tie back to
          which gradient color was "theirs" — a real user couldn't tell
          the two colors apart from the labels alone. Shown even while
          gathering, so the panel doesn't jump/reflow once real data lands. */}
      <div className="flex items-center justify-between mt-1">
        <span className="flex items-center gap-1 text-[9px] text-white/25 truncate max-w-[45%]" dir={isRTL ? 'rtl' : 'ltr'}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--pressure-home-end)' }} aria-hidden />
          {(isRTL ? tTeam(match.home_team) : match.home_team).split(' ').pop()}
        </span>
        <span className="flex items-center gap-1 text-[9px] text-white/25 truncate max-w-[45%]" dir={isRTL ? 'rtl' : 'ltr'}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--pressure-away-end)' }} aria-hidden />
          {(isRTL ? tTeam(match.away_team) : match.away_team).split(' ').pop()}
        </span>
      </div>
    </div>
  );
}
