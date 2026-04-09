/**
 * TacticalPitch — Glass tactical formation view for Starting XI.
 *
 * Horizontal pitch with percentage-based absolute positioning.
 * Formation badges sit ABOVE the pitch. Player nodes are compact
 * with jersey numbers only — name appears on tap/hover.
 *
 * Starters arrive pre-sorted (GK → DEF → MID → FWD) from MatchRosters.
 * Sliced by formation numbers — no positionShort filtering.
 */

import { useMemo, useState } from 'react';
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

interface PositionedPlayer {
  player: PitchPlayer;
  /** 0–100 % from left edge of the team's half */
  x: number;
  /** 0–100 % from top edge */
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
 * Position players on one team's half.
 * x: 0 = own goal line, 100 = center line.
 * y: 0 = top touchline, 100 = bottom touchline.
 */
function layoutTeam(
  starters: PitchPlayer[],
  formation: number[] | null,
): PositionedPlayer[] {
  if (starters.length === 0) return [];

  const result: PositionedPlayer[] = [];

  // GK — pushed close to own goal but with enough margin to not clip
  if (starters[0]) {
    result.push({ player: starters[0], x: 10, y: 50 });
  }

  const outfield = starters.slice(1);
  const rows = formation ?? defaultFormation(outfield.length);
  const totalRows = rows.length;

  let idx = 0;
  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const count = rows[rowIdx];
    // Rows span from 24% to 92% — keep away from edges
    const x = totalRows === 1
      ? 55
      : 24 + (rowIdx / (totalRows - 1)) * 68;

    for (let i = 0; i < count && idx < outfield.length; i++, idx++) {
      // Generous vertical padding — 14% from each edge prevents clipping
      const pad = 14;
      const y = count === 1
        ? 50
        : pad + (i / (count - 1)) * (100 - pad * 2);

      result.push({ player: outfield[idx], x, y });
    }
  }

  return result;
}

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
  const [showName, setShowName] = useState(false);

  const shortName = player.name.includes('.')
    ? player.name.split('.').pop()?.trim() ?? player.name
    : player.name.split(' ').pop() ?? player.name;

  return (
    <motion.div
      className="flex flex-col items-center pointer-events-auto cursor-default select-none gap-[1px]"
      initial={{ opacity: 0, scale: 0.2 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 22,
        delay: index * 0.03,
      }}
      onHoverStart={() => setShowName(true)}
      onHoverEnd={() => setShowName(false)}
      onTap={() => setShowName(s => !s)}
    >
      {/* Jersey circle */}
      <div
        className={cn(
          'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8',
          'rounded-full flex items-center justify-center',
          'text-[8px] sm:text-[9px] md:text-[10px] font-display font-bold tabular-nums leading-none',
          'border-2',
          player.subbedOut && 'opacity-30',
          isHome
            ? 'bg-accent-green/30 border-accent-green/70 text-accent-green'
            : 'bg-accent-orange/30 border-accent-orange/70 text-accent-orange',
        )}
      >
        {player.jersey || '–'}
      </div>

      {/* Name — hidden on mobile, visible on sm+ or on tap */}
      <span
        className={cn(
          'text-[5.5px] sm:text-[6.5px] md:text-[7px] font-mono leading-none',
          'text-center whitespace-nowrap max-w-[42px] sm:max-w-[52px] truncate',
          'transition-opacity duration-150',
          player.subbedOut ? 'text-white/15' : 'text-white/60',
          showName ? 'opacity-100' : 'opacity-0 sm:opacity-100',
        )}
      >
        {shortName}
      </span>
    </motion.div>
  );
}

// ── Pitch Markings ───────────────────────────────────────────────────────────

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
        opacity="0.22"
      >
        <rect x="2" y="2" width="196" height="96" rx="1" />
        <line x1="100" y1="2" x2="100" y2="98" />
        <circle cx="100" cy="50" r="12" />
        <circle cx="100" cy="50" r="0.6" fill="var(--color-border-bright)" />
        {/* Left penalty area */}
        <rect x="2" y="22" width="24" height="56" />
        <rect x="2" y="33" width="10" height="34" />
        <path d="M 26 40 A 7 7 0 0 0 26 60" />
        <circle cx="18" cy="50" r="0.5" fill="var(--color-border-bright)" />
        {/* Right penalty area */}
        <rect x="174" y="22" width="24" height="56" />
        <rect x="188" y="33" width="10" height="34" />
        <path d="M 174 40 A 7 7 0 0 1 174 60" />
        <circle cx="182" cy="50" r="0.5" fill="var(--color-border-bright)" />
        {/* Corners */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" />
        <path d="M 195 2 A 3 3 0 0 0 198 5" />
        <path d="M 2 95 A 3 3 0 0 1 5 98" />
        <path d="M 195 98 A 3 3 0 0 1 198 95" />
      </g>
    </svg>
  );
}

// ── Player Layer ─────────────────────────────────────────────────────────────

function PlayerLayer({
  positioned,
  isHome,
  flipX,
}: {
  positioned: PositionedPlayer[];
  isHome: boolean;
  flipX: boolean;
}) {
  return (
    <>
      {positioned.map((pp, i) => {
        const halfOffset = isHome ? 0 : 50;
        const xInHalf = flipX ? (100 - pp.x) : pp.x;
        const left = halfOffset + (xInHalf / 100) * 50;

        return (
          <div
            key={`${isHome ? 'h' : 'a'}-${pp.player.jersey}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${pp.y}%` }}
          >
            <PlayerNode player={pp.player} index={i} isHome={isHome} />
          </div>
        );
      })}
    </>
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

  if (homePositioned.length === 0 && awayPositioned.length === 0) return null;

  const isRtl = rtl ?? false;
  const homeFlipX = isRtl;
  const awayFlipX = !isRtl;

  const homeShort = homeTeam.split(' ').pop() ?? homeTeam;
  const awayShort = awayTeam.split(' ').pop() ?? awayTeam;

  return (
    <div className="space-y-1.5">
      {/* Formation header — OUTSIDE the pitch so it never overlaps players */}
      <div className="flex items-center justify-between px-1">
        <span className={cn(
          'text-[8px] sm:text-[9px] md:text-[10px] font-mono tabular-nums',
          'text-accent-green/60 bg-accent-green/[0.06] border border-accent-green/15 rounded px-1.5 py-0.5',
        )}>
          {isRtl ? awayShort : homeShort} {isRtl ? awayFormation : homeFormation}
        </span>
        <span className={cn(
          'text-[8px] sm:text-[9px] md:text-[10px] font-mono tabular-nums',
          'text-accent-orange/60 bg-accent-orange/[0.06] border border-accent-orange/15 rounded px-1.5 py-0.5',
        )}>
          {isRtl ? homeShort : awayShort} {isRtl ? homeFormation : awayFormation}
        </span>
      </div>

      {/* Pitch — responsive ratio: taller on mobile, wider on desktop */}
      <div
        className={cn(
          'relative w-full rounded-xl overflow-hidden',
          'bg-[var(--color-bg-card)] backdrop-blur-glass',
          'border border-border-subtle',
          'pitch-grass',
        )}
        style={{ paddingBottom: 'clamp(48%, 52vw, 56%)' }}
      >
        <PitchMarkings />

        <div className="absolute inset-0 z-[1]">
          <PlayerLayer
            positioned={homePositioned}
            isHome={true}
            flipX={homeFlipX}
          />
          <PlayerLayer
            positioned={awayPositioned}
            isHome={false}
            flipX={awayFlipX}
          />
        </div>
      </div>
    </div>
  );
}
