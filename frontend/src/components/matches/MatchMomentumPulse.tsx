import { memo, useEffect, useRef, useState } from 'react';
import { useLangStore } from '../../stores/langStore';
import { teamHaloColor } from '../../lib/oklch';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { fetchEspnEvents, type MatchEvent } from '../../lib/espnEvents';
import { getLiveClock } from '../../lib/utils';
import type { Match } from '../../lib/supabase';

// Sprint 19 — "Attack Event Pulse". Deliberately NOT a smoothed "momentum"
// curve: ESPN's soccer keyEvents feed only exposes discrete goal/card/sub
// markers, timestamped by minute — no shots, no possession, no per-minute
// pressure metric of any kind (MatchStats.tsx's boxscore fields are running
// cumulative totals, not time-bucketed). A hand-smoothed continuous line
// through 2-3 sparse points would visually claim a precision this data
// source can't back up. This renders exactly what's real: sparse markers at
// their true minute, recency-weighted opacity, nothing invented.

const WINDOW_MINUTES = 10;
const POLL_MS = 30_000; // matches MatchStats.tsx's existing live-poll cadence

function currentMinute(match: Match): number {
  const clock = getLiveClock(match);
  if (!clock) return 0;
  const m = clock.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

interface MatchMomentumPulseProps {
  match: Match;
}

function MatchMomentumPulseImpl({ match }: MatchMomentumPulseProps) {
  const { t, lang } = useLangStore();
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchEspnEvents(match.external_id, match.league_id)
        .then(evs => {
          if (cancelled) return;
          setEvents(evs);
          hasDataRef.current = true;
        })
        .catch(() => {
          // Silent — a failed poll just leaves the previous (or empty) state
          // in place rather than flashing an error into a secondary panel.
          if (!cancelled && !hasDataRef.current) setEvents([]);
        });
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [match.external_id, match.league_id]);

  // No skeleton — this is a secondary, may-render-nothing panel (matches
  // MatchTimeline's own "hidden until real data exists" convention). A
  // loading flash here would be more noise than the eventual empty state.
  if (events === null) return null;

  const nowMin = currentMinute(match);
  const windowStart = Math.max(0, nowMin - WINDOW_MINUTES);
  const recent = events.filter(
    e => e.type !== 'sub' && e.minute >= windowStart && e.minute <= nowMin
  );
  if (recent.length === 0) return null;

  const homeColor = teamHaloColor(match.home_team, 1);
  const awayColor = teamHaloColor(match.away_team, 1);
  const isRTL = lang === 'he';

  return (
    <div className="mt-2 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30">{t('attackPulseLabel')}</p>
        <p className="text-[9px] text-white/20">{t('attackPulseWindow').replace('{0}', String(WINDOW_MINUTES))}</p>
      </div>
      {/* direction pinned to ltr regardless of page direction — the x-axis
          encodes elapsed-time data (older -> newer, left -> right), a
          coordinate fact, not a reading-direction one. Mirroring it under
          Hebrew would flip "older" and "newer" positions, not just text
          alignment (same reasoning as the Bento Arena heatmap's RTL fix). */}
      <svg
        viewBox="0 0 200 32"
        preserveAspectRatio="none"
        className="w-full h-8"
        style={{ direction: 'ltr' }}
        role="img"
        aria-label={t('attackPulseLabel')}
      >
        <line x1="0" y1="16" x2="200" y2="16" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {recent.map((ev, i) => {
          const x = WINDOW_MINUTES > 0 ? ((ev.minute - windowStart) / WINDOW_MINUTES) * 200 : 200;
          const minutesAgo = nowMin - ev.minute;
          const opacity = Math.max(0.28, 1 - minutesAgo / WINDOW_MINUTES);
          const isGoal = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_goal';
          const y = ev.team === 'home' ? 9 : 23;
          const color = ev.team === 'home' ? homeColor : awayColor;
          return isGoal ? (
            <circle key={i} cx={x} cy={y} r={5} fill={color} opacity={opacity} />
          ) : (
            <rect key={i} x={x - 2.5} y={y - 2.5} width={5} height={5} fill={color} opacity={opacity} rx={1} />
          );
        })}
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

// Strictly memoized on match reference equality — mergeMatches (useMatches.ts)
// already preserves object identity for unchanged matches, so a sync tick
// that touches other matches never gives this component a "new" match
// object and never re-renders it. Its own 30s poll only ever updates its
// own local state, which by React's model can never invalidate MatchCard or
// the surrounding match-feed list above it.
export const MatchMomentumPulse = memo(
  MatchMomentumPulseImpl,
  (prev, next) => prev.match === next.match
);
