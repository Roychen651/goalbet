import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { smoothPath, type PathPoint } from '../../lib/svgPath';
import { PRESSURE_CLAMP } from '../../lib/matchBoxscore';
import { useMatchPressureFlow } from '../../hooks/useMatchPressureFlow';
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

export function MatchMomentumFlow({ match }: MatchMomentumFlowProps) {
  const { t, lang } = useLangStore();
  const { samples, hasData } = useMatchPressureFlow(match);
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

  return (
    <div className="mt-2 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30">{t('pressureFlowTitle')}</p>
      </div>

      {/* direction pinned to ltr regardless of page direction — the x-axis
          encodes elapsed-time data (older -> newer, left -> right), a
          coordinate fact, not a reading-direction one (same reasoning as
          MatchMomentumPulse's own pin, and the Bento Arena heatmap fix). */}
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

        <g clipPath={`url(#${clipAboveId})`}>
          <motion.path d={areaD} animate={{ d: areaD }} transition={PATH_TRANSITION} fill={`url(#${homeGradId})`} stroke="none" />
        </g>
        <g clipPath={`url(#${clipBelowId})`}>
          <motion.path d={areaD} animate={{ d: areaD }} transition={PATH_TRANSITION} fill={`url(#${awayGradId})`} stroke="none" />
        </g>
      </svg>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-white/25 truncate max-w-[45%]" dir={isRTL ? 'rtl' : 'ltr'}>
          {(isRTL ? tTeam(match.home_team) : match.home_team).split(' ').pop()}
        </span>
        <span className="text-[9px] text-white/25 truncate max-w-[45%]" dir={isRTL ? 'rtl' : 'ltr'}>
          {(isRTL ? tTeam(match.away_team) : match.away_team).split(' ').pop()}
        </span>
      </div>
    </div>
  );
}
