/**
 * TacticalPitch — shared formation-positioning math + primitives for the
 * Starting XI pitch view (percentage-based layout, SVG pitch markings,
 * the player pin itself). Horizontal pitch, percentage-based absolute
 * positioning. Starters arrive pre-sorted (GK → DEF → MID → FWD) from
 * MatchRosters. Sliced by formation numbers — no positionShort filtering.
 *
 * V7 Sprint 53 — this file's own top-level `TacticalPitch` component (flat
 * 2D-only) was removed: `TacticalPitch3D.tsx` (the real render target now,
 * wired from MatchRosters.tsx) renders byte-for-byte the same output at
 * `is3D={false}`, reusing every export below verbatim rather than
 * re-deriving formation placement. Everything here is now a shared,
 * exported primitive — the "extract on second consumer" precedent this
 * codebase already applied to lib/espnEvents.ts (Sprint 19) /
 * lib/teamNameUtils.ts (Sprint 24) / lib/tierVisuals.ts (Sprint 25).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PitchPlayer {
  name: string;
  jersey: string;
  positionShort: string;
  subbedOut?: boolean;
  /**
   * V7 Sprint 53 Commit 2 — optional real fields, all already computed by
   * MatchRosters.tsx's own ESPN roster parse (position: full label,
   * starter/subbedIn: booleans, injured: derived from athlete.injuries[] /
   * status.type). Optional because PitchPlayer is also structurally
   * satisfied by lighter shapes (this file's own preview/harness usage);
   * MatchRosters.tsx is the one real production caller and already
   * supplies all four. The player tap-card (PlayerCardSheet.tsx) only
   * ever renders fields that are actually present — never a fabricated
   * rating/goal/assist count that doesn't exist anywhere in this data.
   */
  position?: string;
  starter?: boolean;
  subbedIn?: boolean;
  injured?: boolean;
}

export interface PositionedPlayer {
  player: PitchPlayer;
  /** 0–100 % from left edge of the team's half */
  x: number;
  /** 0–100 % from top edge */
  y: number;
}

// ── Formation parser ─────────────────────────────────────────────────────────

export function parseFormation(f: string | null): number[] | null {
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
export function layoutTeam(
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

export function PlayerNode({
  player,
  index,
  isHome,
  onTap,
  pulseEvent,
}: {
  player: PitchPlayer;
  index: number;
  isHome: boolean;
  /** V7 Sprint 53 — optional override for TacticalPitch3D's player-card tap target; falls back to the original show/hide-name toggle when omitted. */
  onTap?: () => void;
  /**
   * V7 Sprint 53 Commit 2 — set only when a REAL, just-fetched ESPN key
   * event (a goal or red card) was matched by player name to this exact
   * pin (see MatchRosters.tsx's event-polling effect). Never a fabricated
   * "momentum"/pressure signal — the since-removed Live Pressure Cooker
   * (§47) is the standing lesson this deliberately avoids repeating.
   */
  pulseEvent?: 'goal' | 'red' | null;
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
      onTap={onTap ?? (() => setShowName(s => !s))}
    >
      {/* Jersey circle */}
      <div
        className={cn(
          'relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8',
          'rounded-full flex items-center justify-center',
          'text-[8px] sm:text-[9px] md:text-[10px] font-display font-bold tabular-nums leading-none',
          'border-2',
          isHome
            ? 'bg-accent-green/30 border-accent-green/70 text-accent-green'
            : 'bg-accent-orange/30 border-accent-orange/70 text-accent-orange',
          pulseEvent === 'goal' && 'pin-pulse-goal',
          pulseEvent === 'red' && 'pin-pulse-red',
        )}
      >
        {player.jersey || '–'}
        {/* Small red arrow if subbed out */}
        {player.subbedOut && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[6px] text-red-400 leading-none">▼</span>
        )}
      </div>

      {/* Name — hidden on mobile, visible on sm+ or on tap */}
      <span
        className={cn(
          'text-[5.5px] sm:text-[6.5px] md:text-[7px] font-mono leading-none',
          'text-center whitespace-nowrap max-w-[42px] sm:max-w-[52px] truncate',
          'transition-opacity duration-150',
          'text-white/60',
          showName ? 'opacity-100' : 'opacity-0 sm:opacity-100',
        )}
      >
        {shortName}
      </span>
    </motion.div>
  );
}

// ── Pitch Markings ───────────────────────────────────────────────────────────

export function PitchMarkings() {
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

// V7 Sprint 53 — the old flat 2D `TacticalPitch` component (and its private
// `PlayerLayer` helper) were removed here: `TacticalPitch3D.tsx` with
// `is3D={false}` renders byte-for-byte the same positioning output (it
// reuses `layoutTeam`/`parseFormation`/`PitchMarkings`/`PlayerNode` from
// this file verbatim, just wrapped in a `rotateX(0deg)` no-op transform),
// and MatchRosters.tsx — the only real call site — was updated to render
// `TacticalPitch3D` for both the 2D and 3D toggle states instead of
// switching between two separate components. Keeping a second, now-dead
// component here would be exactly the "leave unused code around" pattern
// this codebase avoids elsewhere.
