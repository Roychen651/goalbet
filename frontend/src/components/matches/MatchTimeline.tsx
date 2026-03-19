import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { Match } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchEvent {
  minute: number;
  extraTime: number | null;
  period: number;
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow_card' | 'red_card' | 'second_yellow' | 'substitution';
  team: 'home' | 'away';
  playerName: string;
  playerOff?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useMatchEvents(match: Match) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched || !match.external_id || match.status !== 'FT') return;

    let cancelled = false;
    setLoading(true);
    setFetched(true);

    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
    const url = `${backendUrl}/api/matches/events?external_id=${encodeURIComponent(match.external_id)}&league_id=${match.league_id}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [match.external_id, match.league_id, match.status, fetched]);

  return { events, loading };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clockLabel(ev: MatchEvent): string {
  if (ev.extraTime !== null) return `${ev.minute}+${ev.extraTime}'`;
  return `${ev.minute}'`;
}

function eventIcon(type: MatchEvent['type']): string {
  switch (type) {
    case 'goal':          return '⚽';
    case 'own_goal':      return '⚽';
    case 'penalty_goal':  return '⚽';
    case 'yellow_card':   return '🟨';
    case 'red_card':      return '🟥';
    case 'second_yellow': return '🟨🟥';
    case 'substitution':  return '🔄';
  }
}

function eventColor(type: MatchEvent['type']): string {
  switch (type) {
    case 'goal':          return 'text-white';
    case 'own_goal':      return 'text-red-400';
    case 'penalty_goal':  return 'text-accent-green';
    case 'yellow_card':   return 'text-yellow-400';
    case 'red_card':      return 'text-red-500';
    case 'second_yellow': return 'text-orange-400';
    case 'substitution':  return 'text-blue-400/70';
  }
}

function periodLabel(period: number): string {
  switch (period) {
    case 1: return '1st Half';
    case 2: return '2nd Half';
    case 3: return 'Extra Time 1st';
    case 4: return 'Extra Time 2nd';
    default: return `Period ${period}`;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-[9px] uppercase tracking-widest text-white/25 font-semibold px-1">{label}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

function ScoreSnapshot({ label, home, away }: { label: string; home: number; away: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 my-2">
      <span className="text-[9px] uppercase tracking-widest text-white/25">{label}</span>
      <span className="text-xs font-bebas tracking-wider text-white/40">{home}–{away}</span>
    </div>
  );
}

function EventRow({ ev, homeTeam, awayTeam, index }: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  index: number;
}) {
  const isHome = ev.team === 'home';
  const color = eventColor(ev.type);
  const isSub = ev.type === 'substitution';
  const isGoalType = ['goal', 'own_goal', 'penalty_goal'].includes(ev.type);

  const clock = (
    <span className={cn(
      'text-[11px] font-bold tabular-nums shrink-0 w-10 text-center',
      isGoalType ? 'text-white/70' : 'text-white/30',
    )}>
      {clockLabel(ev)}
    </span>
  );

  const icon = (
    <span className="text-sm shrink-0 leading-none">{eventIcon(ev.type)}</span>
  );

  const playerInfo = (
    <div className={cn('flex flex-col min-w-0', isHome ? '' : 'items-end')}>
      <span className={cn('text-[12px] font-semibold leading-tight truncate max-w-[90px]', color)}>
        {ev.type === 'own_goal' ? `${ev.playerName} (OG)` : ev.playerName}
      </span>
      {isSub && ev.playerOff && (
        <span className="text-[10px] text-white/25 truncate max-w-[90px]">↑ {ev.playerOff}</span>
      )}
      {ev.type === 'penalty_goal' && (
        <span className="text-[9px] text-accent-green/60">Penalty</span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.2 }}
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-lg',
        isGoalType ? 'bg-white/4 border border-white/6' : '',
      )}
    >
      {isHome ? (
        <>
          {clock}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {icon}
            {playerInfo}
          </div>
          <div className="w-[90px]" /> {/* spacer for away side */}
        </>
      ) : (
        <>
          <div className="w-[90px]" /> {/* spacer for home side */}
          <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
            {playerInfo}
            {icon}
          </div>
          {clock}
        </>
      )}
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-2 animate-pulse py-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2 px-2">
          <div className="w-10 h-3 bg-white/8 rounded" />
          <div className="flex-1 h-3 bg-white/8 rounded" style={{ width: `${40 + i * 15}%` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MatchTimelineProps {
  match: Match;
}

export function MatchTimeline({ match }: MatchTimelineProps) {
  const [open, setOpen] = useState(false);
  const { events, loading } = useMatchEvents(match);

  // Only fetch/show once opened
  if (match.status !== 'FT') return null;

  const hasEvents = events && events.length > 0;
  const isEmpty = events !== null && events.length === 0;

  // Group events by period and compute running score for dividers
  const periods = hasEvents ? [1, 2, 3, 4].filter(p => events.some(e => e.period === p)) : [];

  // Compute cumulative goal score per period transition
  const scoreAtPeriodEnd = (upToPeriod: number): { home: number; away: number } => {
    if (!hasEvents) return { home: 0, away: 0 };
    let home = 0, away = 0;
    for (const ev of events) {
      if (ev.period > upToPeriod) break;
      if (['goal', 'penalty_goal'].includes(ev.type)) {
        if (ev.team === 'home') home++; else away++;
      } else if (ev.type === 'own_goal') {
        if (ev.team === 'home') away++; else home++;
      }
    }
    return { home, away };
  };

  return (
    <div className="mt-3 border-t border-white/6 pt-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/3 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold group-hover:text-white/50 transition-colors">
            Match Timeline
          </span>
          {hasEvents && (
            <span className="text-[9px] text-white/20">
              {events.filter(e => ['goal','own_goal','penalty_goal'].includes(e.type)).length} goals
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/25 text-xs group-hover:text-white/40 transition-colors"
        >
          ▾
        </motion.span>
      </button>

      {/* Timeline content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="timeline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1">
              {/* Column headers */}
              <div className="flex items-center px-2 mb-1">
                <span className="flex-1 text-[9px] uppercase tracking-widest text-white/20 text-left">
                  {match.home_team.split(' ').pop()}
                </span>
                <span className="w-10 text-center text-[9px] text-white/15">time</span>
                <span className="flex-1 text-[9px] uppercase tracking-widest text-white/20 text-right">
                  {match.away_team.split(' ').pop()}
                </span>
              </div>

              {loading && <TimelineSkeleton />}

              {isEmpty && !loading && (
                <p className="text-center text-[11px] text-white/20 py-3">No event data available</p>
              )}

              {hasEvents && !loading && (
                <div className="space-y-0.5">
                  {periods.map((period, pi) => {
                    const periodEvents = events.filter(e => e.period === period);
                    const prevScore = pi > 0 ? scoreAtPeriodEnd(periods[pi - 1]) : null;

                    return (
                      <div key={period}>
                        {/* Period divider */}
                        {pi === 0 ? (
                          <Divider label={periodLabel(period)} />
                        ) : (
                          <>
                            {prevScore && (
                              <ScoreSnapshot
                                label={period === 2 ? 'Half Time' : period === 3 ? 'Full Time' : 'AET'}
                                home={prevScore.home}
                                away={prevScore.away}
                              />
                            )}
                            <Divider label={periodLabel(period)} />
                          </>
                        )}

                        {/* Events in this period */}
                        {periodEvents.map((ev, i) => (
                          <EventRow
                            key={`${ev.period}-${ev.minute}-${ev.extraTime}-${ev.team}-${i}`}
                            ev={ev}
                            homeTeam={match.home_team}
                            awayTeam={match.away_team}
                            index={i + pi * 5}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {/* Final score footer */}
                  <div className="mt-3 pt-2 border-t border-white/6">
                    <ScoreSnapshot
                      label="Full Time"
                      home={scoreAtPeriodEnd(Math.max(...periods)).home}
                      away={scoreAtPeriodEnd(Math.max(...periods)).away}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
