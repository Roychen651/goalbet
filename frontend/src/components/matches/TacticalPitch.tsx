/**
 * TacticalPitch — Glass tactical formation view for Starting XI.
 *
 * Always horizontal (goal-to-goal left↔right). Compact on mobile.
 * Players positioned via percentage-based absolute placement — no
 * flex height propagation issues.
 *
 * Starters arrive pre-sorted (GK → DEF → MID → FWD) from MatchRosters.
 * We slice them by formation numbers — no positionShort filtering.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface PitchPlayer {
  name: string;
  jersey: string;
  positionShort: string;
  subbedOut?: boolean;
}

interface TacticalPitchProps {
  homeFormation: string | null;
  awayFormation: string | null;
  homeStarters: PitchPlayer[];
  awayStarters: PitchPlayer[];
  homeTeam: string;
  awayTeam: string;
  rtl?: boolean;
}

// ── Positioned player (after layout math) ────────────────────────────────────

interface PositionedPlayer {
  player: PitchPlayer;
  /** 0–100 from left edge of the half */
  x: number;
  /** 0–100 from top edge */
  y: number;
}

// ── Formation parser ─────────────────────────────────────────────────────────

function parseFormation(f: string | null): number[] | null {
  if (!f) return null;
  const parts = f.split('-').map(Number);
  if (parts.some(isNaN) || parts.length < 2) return null;
  return parts;
}

/**
 * Build positioned players for one team's half.
 *
 * Starters are pre-sorted: GK first, then outfield by position.
 * We slice them into rows using formation numbers (no positionShort filtering).
 *
 * Returns players with x/y percentages within the team's half.
 * x: 0 = near own goal, 100 = near center line.
 * y: 0 = top edge, 100 = bottom edge.
 */
function layoutTeam(
  starters: PitchPlayer[],
  formation: number[] | null,
): PositionedPlayer[] {
  if (starters.length === 0) return [];

  const result: PositionedPlayer[] = [];

  // Row 0: GK (always 1 player, at x=8%)
  const gk = starters[0];
  if (gk) {
    result.push({ player: gk, x: 8, y: 50 });
  }

  // Build rows from formation, slicing the starters array sequentially
  const outfield = starters.slice(1);
  const rows = formation ?? defaultFormation(outfield.length);
  const totalRows = rows.length;

  let idx = 0;
  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const count = rows[rowIdx];
    // x position: evenly space rows from 22% to 92% of the half
    const x = totalRows === 1
      ? 55
      : 22 + (rowIdx / (totalRows - 1)) * 70;

    for (let i = 0; i < count && idx < outfield.length; i++, idx++) {
      // y position: evenly space players in the row
      const y = count === 1
        ? 50
        : 12 + (i / (count - 1)) * 76;

      result.push({ player: outfield[idx], x, y });
    }
  }

  return result;
}

/** Fallback formation when none provided: split N outfield players roughly */
function defaultFormation(n: number): number[] {
  if (n <= 3) return [n];
  if (n <= 6) return [Math.ceil(n / 2), Math.floor(n / 2)];
  if (n === 10) return [4, 3, 3];
  return [4, Math.ceil((n - 4) / 2), Math.floor((n - 4) / 2)];
}

// ── Player Node ──────────────────────────────────────────────────────────────

function PlayerNode({
  player,
  index,
  isHome,
}: {
  player: PitchPlayer;
  index: number;
  isHome: boolean;
}) {
  const shortName = player.name.includes('.')
    ? player.name
    : player.name.split(' ').pop() ?? player.name;

  return (
    <motion.div
      className="flex flex-col items-center gap-px pointer-events-auto"
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: index * 0.035,
      }}
    >
      <div
        className={cn(
          'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center',
          'text-[9px] sm:text-[10px] md:text-[11px] font-display font-bold tabular-nums leading-none',
          'border transition-colors',
          player.subbedOut && 'opacity-30',
          isHome
            ? 'bg-accent-green/25 border-accent-green/50 text-accent-green shadow-[0_0_6px_var(--color-accent-green,rgba(189,232,245,0.2))]'
            : 'bg-accent-orange/25 border-accent-orange/50 text-accent-orange shadow-[0_0_6px_var(--color-accent-orange,rgba(255,51,102,0.2))]',
        )}
      >
        {player.jersey || '–'}
      </div>
      <span
        className={cn(
          'text-[6px] sm:text-[7px] md:text-[8px] font-mono leading-tight text-center',
          'truncate max-w-[40px] sm:max-w-[48px] md:max-w-[56px]',
          player.subbedOut ? 'text-white/15' : 'text-white/55',
        )}
      >
        {shortName}
      </span>
    </motion.div>
  );
}

// ── Pitch Markings (horizontal, always) ──────────────────────────────────────

function PitchMarkings() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="var(--color-border-bright)"
        strokeWidth="0.4"
        opacity="0.3"
      >
        {/* Outer boundary */}
        <rect x="2" y="2" width="196" height="96" rx="1" />
        {/* Center line */}
        <line x1="100" y1="2" x2="100" y2="98" />
        {/* Center circle */}
        <circle cx="100" cy="50" r="12" />
        <circle cx="100" cy="50" r="0.8" fill="var(--color-border-bright)" />
        {/* Left penalty box */}
        <rect x="2" y="22" width="26" height="56" />
        <rect x="2" y="32" width="12" height="36" />
        <path d="M 28 38 A 8 8 0 0 0 28 62" />
        <circle cx="20" cy="50" r="0.6" fill="var(--color-border-bright)" />
        {/* Right penalty box */}
        <rect x="172" y="22" width="26" height="56" />
        <rect x="186" y="32" width="12" height="36" />
        <path d="M 172 38 A 8 8 0 0 1 172 62" />
        <circle cx="180" cy="50" r="0.6" fill="var(--color-border-bright)" />
        {/* Corner arcs */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" />
        <path d="M 195 2 A 3 3 0 0 0 198 5" />
        <path d="M 2 95 A 3 3 0 0 1 5 98" />
        <path d="M 195 98 A 3 3 0 0 1 198 95" />
      </g>
    </svg>
  );
}

// ── Team Half Renderer ───────────────────────────────────────────────────────

function TeamHalfView({
  positioned,
  isHome,
  flipX,
  teamName,
  formationStr,
}: {
  positioned: PositionedPlayer[];
  isHome: boolean;
  /** If true, mirror x so GK is on the right side */
  flipX: boolean;
  teamName: string;
  formationStr: string | null;
}) {
  const shortName = teamName.split(' ').pop() ?? teamName;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Formation badge */}
      {formationStr && (
        <div className={cn(
          'absolute z-10 top-1',
          flipX ? 'right-1' : 'left-1',
        )}>
          <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono text-accent-green/40 bg-accent-green/[0.06] border border-accent-green/10 rounded px-1 py-0.5 pointer-events-auto">
            {shortName} {formationStr}
          </span>
        </div>
      )}

      {/* Players */}
      {positioned.map((pp, i) => {
        // Each team half is 50% of the pitch width.
        // x is 0–100 within the half. Convert to % of full pitch.
        const halfOffset = isHome ? 0 : 50;
        const xInHalf = flipX ? (100 - pp.x) : pp.x;
        const left = halfOffset + (xInHalf / 100) * 50;

        return (
          <div
            key={`${pp.player.jersey}-${pp.player.name}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${pp.y}%` }}
          >
            <PlayerNode player={pp.player} index={i} isHome={isHome} />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TacticalPitch({
  homeFormation,
  awayFormation,
  homeStarters,
  awayStarters,
  homeTeam,
  awayTeam,
  rtl,
}: TacticalPitchProps) {
  const homeParsed = useMemo(() => parseFormation(homeFormation), [homeFormation]);
  const awayParsed = useMemo(() => parseFormation(awayFormation), [awayFormation]);

  const homePositioned = useMemo(
    () => layoutTeam(homeStarters, homeParsed),
    [homeStarters, homeParsed],
  );
  const awayPositioned = useMemo(
    () => layoutTeam(awayStarters, awayParsed),
    [awayStarters, awayParsed],
  );

  // Need players to render
  if (homePositioned.length === 0 && awayPositioned.length === 0) return null;

  // In LTR: home on left (attacking right), away on right (attacking left → flipX).
  // In RTL: reversed.
  const isRtl = rtl ?? false;
  const homeFlipX = isRtl;
  const awayFlipX = !isRtl;

  return (
    <div
      className={cn(
        'relative w-full rounded-xl overflow-hidden',
        'bg-[var(--color-bg-card)] backdrop-blur-glass',
        'border border-border-subtle',
        'pitch-grass',
      )}
      style={{ aspectRatio: '2 / 1', minHeight: 180, maxHeight: 400 }}
    >
      <PitchMarkings />

      {/* Player overlay — absolute so it definitely fills the pitch */}
      <div className="absolute inset-0 z-[1]">
        <TeamHalfView
          positioned={homePositioned}
          isHome={true}
          flipX={homeFlipX}
          teamName={homeTeam}
          formationStr={homeFormation}
        />
        <TeamHalfView
          positioned={awayPositioned}
          isHome={false}
          flipX={awayFlipX}
          teamName={awayTeam}
          formationStr={awayFormation}
        />
      </div>
    </div>
  );
}
