/**
 * TacticalPitch3D — Pure CSS 3D perspective wrapper around TacticalPitch's
 * proven, RTL-correct formation-positioning math (layoutTeam/parseFormation,
 * exported from TacticalPitch.tsx the moment this became a second real
 * consumer — the same "extract on second consumer" precedent as
 * lib/espnEvents.ts/lib/teamNameUtils.ts/lib/tierVisuals.ts).
 *
 * V7 Sprint 53 — "Spatial 3D Tactical Pitch". Zero external 3D engine —
 * plain CSS `perspective`/`rotateX` + Framer Motion's own `animate` prop
 * (already-loaded, no new dependency). A single `is3D` boolean, owned by
 * the caller (MatchRosters.tsx's toggle row), drives one motion value:
 * `rotateX` animates between 0deg (flat — visually identical to the 2D
 * TacticalPitch) and 55deg (tilted broadcast-camera angle).
 *
 * WEBKIT-TRAP CORRECTION (checked against this app's own history before
 * writing this file): TacticalPitch.tsx's 2D surface safely carries
 * `backdrop-blur-glass` because it's a static, untransformed element. This
 * 3D surface's `rotateX` is a CONTINUOUS, spring-animated transform on
 * toggle — combining that with `backdrop-filter` is the exact class of bug
 * this app has shipped broken twice (PredictionModal's Vaul sheet,
 * BottomNav's scroll drift) and has explicitly designed around every time
 * since (HeroMatchCard, §50: "Zero backdrop-filter anywhere on the
 * transformed layer"). The turf here uses `.pitch-grass`'s plain gradient
 * background with ZERO backdrop-blur — never add one back.
 *
 * BILLBOARDED PLAYER PINS: each pin gets a counter-rotation
 * (`rotateX(-angle)`) synced to the exact same spring as the pitch surface,
 * so jersey numbers/names stay flat and legible while the plane underneath
 * them tilts — the standard CSS-3D "billboard" technique. This only works
 * because `transformStyle: 'preserve-3d'` is set on the pitch surface,
 * letting children participate in true 3D space instead of being flattened
 * onto the parent's already-rotated 2D plane.
 */

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  parseFormation,
  layoutTeam,
  PitchMarkings,
  PlayerNode,
  type PitchPlayer,
  type PositionedPlayer,
} from './TacticalPitch';

const TILT_ANGLE = 55;
const TILT_SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

/**
 * V7 Sprint 53 Commit 2 — a real, name-matched ESPN key event (goal or red
 * card), resolved by MatchRosters.tsx's event-polling effect against
 * lib/espnEvents.ts's already-proven MatchEvent feed. `player` is ESPN's
 * own athlete shortName/displayName — the exact same field the roster
 * parse itself uses, so matching by name against the currently rendered
 * starters/subs is comparing two values sourced from the same underlying
 * ESPN athlete object, not two independently-guessed strings.
 */
export interface PitchPulseEvent {
  team: 'home' | 'away';
  player: string;
  type: 'goal' | 'red';
}

interface TacticalPitch3DProps {
  homeFormation: string | null;
  awayFormation: string | null;
  homeStarters: PitchPlayer[];
  awayStarters: PitchPlayer[];
  homeTeam: string;
  awayTeam: string;
  rtl?: boolean;
  is3D: boolean;
  /** V7 Sprint 53 Commit 2 hook point — omitted call sites keep the 2D show/hide-name tap behavior via PlayerNode's own fallback. */
  onPlayerTap?: (player: PitchPlayer, isHome: boolean) => void;
  pulseEvent?: PitchPulseEvent | null;
}

function BillboardedPlayerLayer({
  positioned,
  isHome,
  flipX,
  is3D,
  onPlayerTap,
  pulseEvent,
}: {
  positioned: PositionedPlayer[];
  isHome: boolean;
  flipX: boolean;
  is3D: boolean;
  onPlayerTap?: (player: PitchPlayer, isHome: boolean) => void;
  pulseEvent?: PitchPulseEvent | null;
}) {
  const pulseTeam: 'home' | 'away' = isHome ? 'home' : 'away';

  return (
    <>
      {positioned.map((pp, i) => {
        const halfOffset = isHome ? 0 : 50;
        const xInHalf = flipX ? 100 - pp.x : pp.x;
        const left = halfOffset + (xInHalf / 100) * 50;
        const isPulsing = !!pulseEvent && pulseEvent.team === pulseTeam && pulseEvent.player === pp.player.name;

        return (
          <div
            key={`${isHome ? 'h' : 'a'}-${pp.player.jersey}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            // `transformStyle: 'preserve-3d'` is required here, not just on the
            // pitch surface and the counter-rotation child — without it this
            // positioning wrapper defaults to `flat`, which FLATTENS the
            // counter-rotation motion.div's rotateX(-angle) into a 2D bitmap
            // before the pitch surface's own rotateX(+angle) ever applies,
            // breaking the billboard cancellation (confirmed via a real
            // Playwright screenshot showing squashed ellipses instead of flat
            // circles before this fix — see the Sprint 53 Commit 1 verification
            // notes). `transform-style` must be `preserve-3d` on EVERY element
            // in the chain between the two rotateX transforms being cancelled,
            // or the browser silently flattens the intermediate one.
            style={{ left: `${left}%`, top: `${pp.y}%`, transformStyle: 'preserve-3d' }}
          >
            {/* Counter-rotation billboard — cancels the pitch surface's own
                tilt so this content always reads flat, in sync with the
                exact same spring so neither ever lags the other visually. */}
            <motion.div
              animate={{ rotateX: is3D ? -TILT_ANGLE : 0 }}
              transition={TILT_SPRING}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <PlayerNode
                player={pp.player}
                index={i}
                isHome={isHome}
                onTap={onPlayerTap ? () => onPlayerTap(pp.player, isHome) : undefined}
                pulseEvent={isPulsing ? pulseEvent!.type : null}
              />
            </motion.div>
          </div>
        );
      })}
    </>
  );
}

export function TacticalPitch3D({
  homeFormation,
  awayFormation,
  homeStarters,
  awayStarters,
  homeTeam,
  awayTeam,
  rtl,
  is3D,
  onPlayerTap,
  pulseEvent,
}: TacticalPitch3DProps) {
  const homeParsed = parseFormation(homeFormation);
  const awayParsed = parseFormation(awayFormation);
  const homePositioned = layoutTeam(homeStarters, homeParsed);
  const awayPositioned = layoutTeam(awayStarters, awayParsed);

  if (homePositioned.length === 0 && awayPositioned.length === 0) return null;

  const isRtl = rtl ?? false;
  const homeFlipX = isRtl;
  const awayFlipX = !isRtl;

  const homeShort = homeTeam.split(' ').pop() ?? homeTeam;
  const awayShort = awayTeam.split(' ').pop() ?? awayTeam;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span
          className={cn(
            'text-[8px] sm:text-[9px] md:text-[10px] font-mono tabular-nums',
            'text-accent-green/60 bg-accent-green/[0.06] border border-accent-green/15 rounded px-1.5 py-0.5',
          )}
        >
          {isRtl ? awayShort : homeShort} {isRtl ? awayFormation : homeFormation}
        </span>
        <span
          className={cn(
            'text-[8px] sm:text-[9px] md:text-[10px] font-mono tabular-nums',
            'text-accent-orange/60 bg-accent-orange/[0.06] border border-accent-orange/15 rounded px-1.5 py-0.5',
          )}
        >
          {isRtl ? homeShort : awayShort} {isRtl ? homeFormation : awayFormation}
        </span>
      </div>

      {/* `perspective` on the ancestor of the transformed element — this is
          what makes rotateX below actually read as depth instead of a flat
          squash. Generous bottom padding since a 55deg tilt visually
          "shortens" the pitch vertically; keeps player pins clear of the
          card edge at the steepest angle. */}
      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{ perspective: 1000, paddingBottom: 'clamp(58%, 62vw, 68%)' }}
      >
        <motion.div
          className={cn(
            // NOTE: deliberately no `overflow-hidden` here — per the CSS
            // Transforms spec, `overflow` other than `visible` forces the
            // USED value of `transform-style` to `flat` regardless of the
            // declared `preserve-3d` below (a real bug caught via a live
            // Playwright screenshot showing squashed-ellipse player pins
            // instead of flat billboarded circles — getComputedStyle()
            // reports the requested `preserve-3d` even while the renderer
            // silently flattens, so this can't be caught by inspecting
            // computed styles alone). Unlike WorldCupBracket.tsx's
            // GroupCard/StadiumCard (single-level rotateX, no nested
            // counter-rotation depending on true 3D compositing), this
            // surface has a nested billboarded child that must genuinely
            // cancel the parent's tilt — content here is already bounded
            // within 0–100% by construction (percentage-based layout), so
            // there's nothing real for overflow-hidden to clip anyway.
            'absolute inset-0 rounded-xl',
            'border border-border-subtle',
            'pitch-grass', // plain gradient background — never backdrop-blur here, see file header
          )}
          animate={{ rotateX: is3D ? TILT_ANGLE : 0 }}
          transition={TILT_SPRING}
          style={{ transformStyle: 'preserve-3d', transformOrigin: '50% 85%' }}
        >
          <PitchMarkings />

          <div className="absolute inset-0 z-[1]" style={{ transformStyle: 'preserve-3d' }}>
            <BillboardedPlayerLayer
              positioned={homePositioned}
              isHome={true}
              flipX={homeFlipX}
              is3D={is3D}
              onPlayerTap={onPlayerTap}
              pulseEvent={pulseEvent}
            />
            <BillboardedPlayerLayer
              positioned={awayPositioned}
              isHome={false}
              flipX={awayFlipX}
              is3D={is3D}
              onPlayerTap={onPlayerTap}
              pulseEvent={pulseEvent}
            />
          </div>
        </motion.div>

        {/* V7 Sprint 53 Commit 3 — broadcast-camera vignette. Deliberately
            on the OUTER, never-rotated wrapper (which already carries
            overflow-hidden safely, see the comment above) rather than
            inside the tilted `preserve-3d` chain — a lens vignette
            represents the camera framing the shot, not something painted
            onto the pitch surface itself, and keeping it off the rotated
            element sidesteps the WebKit backdrop-filter/transform trap
            question entirely (it's not blurred, just a plain gradient, but
            "never add a new layer to the transformed chain without a real
            reason" is the safer default this app has learned the hard way
            — §21/§34/§50). Pure CSS, theme-aware pair in index.css. */}
        <div className="pitch-vignette pointer-events-none absolute inset-0 rounded-xl" aria-hidden="true" />
      </div>
    </div>
  );
}
