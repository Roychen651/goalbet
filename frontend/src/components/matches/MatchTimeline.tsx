import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { LEAGUE_ESPN_SLUG } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import type { Match } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchEvent {
  minute: number;
  stoppage: number | null; // e.g. 45+2 → stoppage=2
  period: number;          // 1=1H, 2=2H, 3=ET1, 4=ET2, 5=PEN
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow' | 'red' | 'second_yellow' | 'sub';
  team: 'home' | 'away';
  player: string;
  assist?: string;   // player who assisted the goal
  playerOff?: string; // sub: player leaving
}

// ─── ESPN Fetch ───────────────────────────────────────────────────────────────

async function fetchEspnEvents(externalId: string, leagueId: number): Promise<MatchEvent[]> {
  const slug = LEAGUE_ESPN_SLUG[leagueId];
  if (!slug) return [];

  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return [];

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  // Identify which team is home/away from the header
  const comp = data?.header?.competitions?.[0];
  const competitors: Record<string, unknown>[] = comp?.competitors ?? [];
  const homeComp = competitors.find((c) => c.homeAway === 'home') as Record<string, unknown> | undefined;
  const awayComp = competitors.find((c) => c.homeAway === 'away') as Record<string, unknown> | undefined;
  const homeTeamId = String((homeComp?.team as Record<string, unknown>)?.id ?? '');
  const awayTeamId = String((awayComp?.team as Record<string, unknown>)?.id ?? '');

  // ESPN soccer summary exposes key events in `keyEvents`
  const rawEvents: Record<string, unknown>[] = data?.keyEvents ?? [];
  if (!rawEvents.length) return [];

  const events: MatchEvent[] = [];

  for (const ev of rawEvents) {
    // ── Clock ─────────────────────────────────────────────────────────────────
    // ESPN clock displayValue is "MM:SS" (e.g. "28:30") or "MM:SS+" for stoppage
    // Fall back to clock.value (seconds) if displayValue is absent.
    const clockRaw = ev.clock as Record<string, unknown> | undefined;
    const clockDisplay = String(clockRaw?.displayValue ?? '');
    const clockSeconds = typeof clockRaw?.value === 'number' ? clockRaw.value as number : null;

    let minute = 0;
    let stoppage: number | null = null;

    if (clockDisplay) {
      const stoppageMatch = clockDisplay.match(/\+(\d+)/);
      if (stoppageMatch) stoppage = parseInt(stoppageMatch[1]);
      const minsMatch = clockDisplay.match(/^(\d+)/);
      if (minsMatch) minute = parseInt(minsMatch[1]);
    } else if (clockSeconds !== null) {
      minute = Math.floor(clockSeconds / 60);
    } else {
      continue; // no timing info — skip
    }

    const period: number = ((ev.period as Record<string, unknown>)?.number as number) ?? 1;

    // ── Event type ────────────────────────────────────────────────────────────
    // ESPN uses BOTH top-level booleans (yellowCard/redCard) AND type.text strings.
    // Check both to handle all ESPN response variants reliably.
    const typeText = String(((ev.type as Record<string, unknown>)?.text ?? '')).toLowerCase();
    const isScoring = ev.scoringPlay === true;
    const isOwnGoal = ev.ownGoal === true;
    const isPenaltyGoal = ev.penaltyKick === true && isScoring;
    const isYellow = ev.yellowCard === true || typeText === 'yellow card' || typeText === 'yellow-red card';
    const isRed   = ev.redCard   === true || typeText === 'red card'    || typeText === 'straight red card';
    const isSub   = typeText.includes('sub') || typeText.includes('substitut');

    let type: MatchEvent['type'];
    if (isOwnGoal) type = 'own_goal';
    else if (isPenaltyGoal) type = 'penalty_goal';
    else if (isScoring) type = 'goal';
    else if (isYellow && isRed) type = 'second_yellow';
    else if (isRed) type = 'red';
    else if (isYellow) type = 'yellow';
    else if (isSub) type = 'sub';
    else continue; // not a key event we care about

    // ── Team side ─────────────────────────────────────────────────────────────
    const teamId = String((ev.team as Record<string, unknown>)?.id ?? '');
    const team: 'home' | 'away' =
      teamId === homeTeamId ? 'home' : teamId === awayTeamId ? 'away' : 'home';

    // ── Players ───────────────────────────────────────────────────────────────
    const participants: Record<string, unknown>[] =
      (ev.participants as Record<string, unknown>[]) ??
      (ev.athletesInvolved as Record<string, unknown>[]) ?? [];

    const getName = (p: Record<string, unknown> | undefined): string => {
      if (!p) return '';
      const ath = p.athlete as Record<string, unknown> | undefined;
      return String(ath?.shortName ?? ath?.displayName ?? p.displayName ?? '').trim();
    };

    const getRole = (p: Record<string, unknown>): string =>
      String(((p.type as Record<string, unknown>)?.text ?? p.type ?? '')).toLowerCase();

    let player = '';
    let assist: string | undefined;
    let playerOff: string | undefined;

    if (isSub) {
      const pIn  = participants.find(p => getRole(p).includes('in')  || getRole(p).includes('enter')) ?? participants[0];
      const pOut = participants.find(p => getRole(p).includes('out') || getRole(p).includes('exit')  || getRole(p).includes('replac'));
      player    = getName(pIn);
      playerOff = pOut ? getName(pOut) : undefined;
    } else {
      const scorer  = participants.find(p => getRole(p).includes('scor') || getRole(p) === 'scorer') ?? participants[0];
      const assister = participants.find(p => getRole(p).includes('assist'));
      player = getName(scorer);
      if (assister) assist = getName(assister);
    }

    if (!player) continue; // skip events with no player info

    events.push({ minute, stoppage, period, type, team, player, assist, playerOff });
  }

  // Sort: period ASC, minute ASC, stoppage ASC
  events.sort((a, b) =>
    a.period !== b.period ? a.period - b.period :
    a.minute !== b.minute ? a.minute - b.minute :
    (a.stoppage ?? 0) - (b.stoppage ?? 0)
  );

  return events;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function clockLabel(ev: MatchEvent) {
  return ev.stoppage !== null ? `${ev.minute}+${ev.stoppage}'` : `${ev.minute}'`;
}

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  goal:          '⚽',
  own_goal:      '⚽',
  penalty_goal:  '⚽',
  yellow:        '🟨',
  red:           '🟥',
  second_yellow: '🟨🟥',
  sub:           '🔄',
};

function eventTextColor(type: MatchEvent['type']): string {
  switch (type) {
    case 'goal':         return 'text-white';
    case 'own_goal':     return 'text-red-400';
    case 'penalty_goal': return 'text-accent-green';
    case 'yellow':       return 'text-yellow-400';
    case 'red':          return 'text-red-500';
    case 'second_yellow':return 'text-orange-400';
    case 'sub':          return 'text-blue-400/70';
  }
}

function periodTitle(period: number): string {
  switch (period) {
    case 1: return '1st Half';
    case 2: return '2nd Half';
    case 3: return '1st Extra Time';
    case 4: return '2nd Extra Time';
    case 5: return 'Penalty Shootout';
    default: return `Period ${period}`;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2.5">
      <div className="flex-1 h-px bg-white/6" />
      <span className="text-[9px] font-semibold uppercase tracking-widest text-white/22 px-1 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

function ScorePin({ label, home, away }: { label: string; home: number; away: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 my-1.5">
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-3 py-0.5">
        <span className="text-[9px] uppercase tracking-wider text-white/30">{label}</span>
        <span className="text-[11px] font-bebas tracking-wider text-white/50">{home}–{away}</span>
      </div>
    </div>
  );
}

function EventRow({
  ev,
  idx,
}: {
  ev: MatchEvent;
  idx: number;
}) {
  const isHome = ev.team === 'home';
  const color = eventTextColor(ev.type);
  const isGoalType = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_goal';
  const isSub = ev.type === 'sub';

  // Clock pill
  const clockPill = (
    <span className={cn(
      'shrink-0 text-[10px] font-bold tabular-nums w-11 text-center',
      isGoalType ? 'text-white/60' : isSub ? 'text-blue-400/40' : 'text-white/25',
    )}>
      {clockLabel(ev)}
    </span>
  );

  // Icon
  const icon = (
    <span className="shrink-0 text-[13px] leading-none">{EVENT_ICON[ev.type]}</span>
  );

  // Player info block
  const playerBlock = (
    <div className={cn('flex flex-col min-w-0', isHome ? '' : 'items-end')}>
      <span className={cn('text-[12px] font-semibold leading-tight truncate max-w-[100px]', color)}>
        {ev.type === 'own_goal' ? `${ev.player} (OG)` : ev.player}
      </span>
      {isGoalType && ev.assist && (
        <span className="text-[9px] text-white/25 truncate max-w-[100px]">↳ {ev.assist}</span>
      )}
      {isSub && ev.playerOff && (
        <span className="text-[9px] text-white/25 truncate max-w-[100px]">↑ {ev.playerOff}</span>
      )}
      {ev.type === 'penalty_goal' && (
        <span className="text-[9px] text-accent-green/50">Penalty</span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.18 }}
      className={cn(
        'flex items-center gap-1.5 py-1 px-1.5 rounded-lg',
        isGoalType && 'bg-white/3 border border-white/5',
      )}
    >
      {isHome ? (
        <>
          {clockPill}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {icon}
            {playerBlock}
          </div>
          {/* Away spacer */}
          <div className="w-[100px] shrink-0" />
        </>
      ) : (
        <>
          {/* Home spacer */}
          <div className="w-[100px] shrink-0" />
          <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
            {playerBlock}
            {icon}
          </div>
          {clockPill}
        </>
      )}
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 py-2 px-1">
      {[70, 55, 80].map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-11 h-2.5 rounded bg-white/6 animate-pulse" />
          <div className="h-2.5 rounded bg-white/6 animate-pulse" style={{ width: `${w}px` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MatchTimeline({ match }: { match: Match }) {
  const { t } = useLangStore();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false); // ref: no re-render on change

  // Fetch once, when first opened
  useEffect(() => {
    if (!open || fetchedRef.current || match.status !== 'FT') return;
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;
    fetchedRef.current = true;

    let cancelled = false;
    setLoading(true);

    fetchEspnEvents(match.external_id, match.league_id)
      .then(evs => { if (!cancelled) setEvents(evs); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, match.external_id, match.league_id, match.status]);

  if (match.status !== 'FT') return null;
  // Hide toggle for leagues with no ESPN coverage
  if (!LEAGUE_ESPN_SLUG[match.league_id]) return null;
  // Hide entirely once we know there are no events (e.g. small-nation internationals)
  if (events !== null && events.length === 0 && !loading) return null;

  const hasEvents = events !== null && events.length > 0;
  const isEmpty   = false; // never shown — we return null above when empty

  // Compute running goal scores for score pins
  const goalsUpTo = (upToPeriod: number, inclusive = true) => {
    let h = 0, a = 0;
    for (const ev of events ?? []) {
      if (inclusive ? ev.period > upToPeriod : ev.period >= upToPeriod) break;
      if (ev.type === 'goal' || ev.type === 'penalty_goal') {
        ev.team === 'home' ? h++ : a++;
      } else if (ev.type === 'own_goal') {
        ev.team === 'home' ? a++ : h++;
      }
    }
    return { h, a };
  };

  const periods = hasEvents ? [...new Set(events.map(e => e.period))].sort((a, b) => a - b) : [];

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      {/* Toggle */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-2 py-1 rounded-xl hover:bg-white/3 transition-colors group"
      >
        <span className="text-[10px] uppercase tracking-widest font-semibold text-white/30 group-hover:text-white/50 transition-colors">
          {t('matchTimeline')}
          {hasEvents && (
            <span className="ml-1.5 text-white/18 normal-case tracking-normal">
              · {events.filter(e => ['goal','own_goal','penalty_goal'].includes(e.type)).length} goals
            </span>
          )}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-white/22 text-[11px] group-hover:text-white/40"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="tl"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-2">
              {/* Column labels */}
              <div className="flex items-center px-1.5 mb-1">
                <span className="flex-1 text-[9px] uppercase tracking-wider text-white/18 text-left truncate">
                  {match.home_team.split(' ').slice(-1)[0]}
                </span>
                <span className="w-11 text-center text-[9px] text-white/15 shrink-0">time</span>
                <span className="flex-1 text-[9px] uppercase tracking-wider text-white/18 text-right truncate">
                  {match.away_team.split(' ').slice(-1)[0]}
                </span>
              </div>

              {loading && <Skeleton />}

              {isEmpty && (
                <p className="text-center text-[11px] text-white/20 py-4">
                  No event data available
                </p>
              )}

              {hasEvents && !loading && (
                <div>
                  {periods.map((period, pi) => {
                    const periodEvents = events.filter(e => e.period === period);
                    const prevScore = pi > 0 ? goalsUpTo(periods[pi - 1]) : null;
                    const isNewSection = pi > 0;
                    const pinLabel =
                      period === 2 ? 'Half Time' :
                      period === 3 ? 'Full Time' :
                      period === 4 ? 'AET Half Time' :
                      period === 5 ? 'After Extra Time' : '';

                    return (
                      <div key={period}>
                        {isNewSection && prevScore && (
                          <ScorePin label={pinLabel} home={prevScore.h} away={prevScore.a} />
                        )}
                        <SectionDivider label={periodTitle(period)} />
                        {periodEvents.map((ev, i) => (
                          <EventRow
                            key={`${ev.period}-${ev.minute}-${ev.stoppage}-${ev.team}-${i}`}
                            ev={ev}
                            idx={i + pi * 4}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {/* Final score at bottom */}
                  {(() => {
                    const final = goalsUpTo(Math.max(...periods));
                    const label = match.went_to_penalties ? 'After Penalties' :
                                  match.regulation_home !== null ? 'After Extra Time' : 'Full Time';
                    return (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <ScorePin label={label} home={final.h} away={final.a} />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
