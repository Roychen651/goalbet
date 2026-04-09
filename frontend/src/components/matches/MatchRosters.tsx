/**
 * MatchRosters — Formation string + Starting XI grid for Live / FT matches.
 *
 * Extracts `rosters` from ESPN summary endpoint.
 * Shows formation (e.g. "4-3-3"), starting XI with jersey numbers and positions,
 * and substitutes. Gracefully hidden when roster data unavailable.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, AlertCircle, LayoutGrid, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LEAGUE_ESPN_SLUG } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import { TacticalPitch } from './TacticalPitch';
import type { Match } from '../../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface Player {
  name: string;
  jersey: string;
  position: string;       // "Goalkeeper", "Defender", "Midfielder", "Forward"
  positionShort: string;  // "GK", "DEF", "MID", "FWD"
  starter: boolean;
  subbedIn?: boolean;
  subbedOut?: boolean;
  injured?: boolean;      // flagged by ESPN injuries array or status type
}

interface TeamRoster {
  teamName: string;
  formation: string | null;
  starters: Player[];
  subs: Player[];
}

// ── ESPN Fetch ───────────────────────────────────────────────────────────────

function mapPosition(pos: string): { full: string; short: string } {
  const p = pos.toLowerCase();
  if (p.includes('goal'))    return { full: 'Goalkeeper',  short: 'GK' };
  if (p.includes('defend'))  return { full: 'Defender',    short: 'DEF' };
  if (p.includes('midfield'))return { full: 'Midfielder',  short: 'MID' };
  if (p.includes('forward') || p.includes('striker') || p.includes('attack'))
                             return { full: 'Forward',     short: 'FWD' };
  return { full: pos, short: pos.slice(0, 3).toUpperCase() };
}

async function fetchRosters(externalId: string, leagueId: number): Promise<TeamRoster[]> {
  const slug = LEAGUE_ESPN_SLUG[leagueId];
  if (!slug) return [];

  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return [];

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>;

    const rosters = (data?.rosters as Record<string, unknown>[]) ?? [];
    if (rosters.length < 2) return [];

    const result: TeamRoster[] = [];

    for (const roster of rosters.slice(0, 2)) {
      const teamObj = (roster.team as Record<string, unknown>) ?? {};
      const teamName = String(teamObj.displayName ?? teamObj.shortDisplayName ?? teamObj.name ?? '');

      // Formation — sometimes at roster level, sometimes nested in team
      const formation = typeof roster.formation === 'string' && roster.formation
        ? roster.formation
        : null;

      const entries = (roster.roster as Record<string, unknown>[]) ?? [];
      const starters: Player[] = [];
      const subs: Player[] = [];

      for (const entry of entries) {
        const athlete = (entry.athlete as Record<string, unknown>) ?? {};
        const name = String(athlete.shortName ?? athlete.displayName ?? '').trim();
        if (!name) continue;

        const jersey = String(athlete.jersey ?? entry.jersey ?? '');
        const posObj = (athlete.position as Record<string, unknown>) ?? {};
        const posName = String(posObj.displayName ?? posObj.name ?? posObj.abbreviation ?? '');
        const { full, short } = mapPosition(posName);

        const isStarter = entry.starter === true;
        const subbedIn = entry.subbedIn === true || (entry.didNotPlay === false && !isStarter);
        const subbedOut = entry.subbedOut === true;

        // Injury detection — ESPN may surface via athlete.injuries[] or athlete.status.type
        const injuries = (athlete.injuries as Record<string, unknown>[]) ?? [];
        const statusType = String(
          ((athlete.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name
          ?? (athlete.status as Record<string, unknown>)?.type
          ?? ''
        ).toLowerCase();
        const injured =
          injuries.length > 0 ||
          statusType.includes('injur') ||
          statusType.includes('suspend') ||
          statusType === 'out' ||
          undefined;

        const player: Player = {
          name,
          jersey,
          position: full,
          positionShort: short,
          starter: isStarter,
          subbedIn: subbedIn || undefined,
          subbedOut: subbedOut || undefined,
          injured,
        };

        if (isStarter) starters.push(player);
        else subs.push(player);
      }

      // Sort starters: GK first, then DEF, MID, FWD
      const posOrder: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
      starters.sort((a, b) => (posOrder[a.positionShort] ?? 9) - (posOrder[b.positionShort] ?? 9));

      if (starters.length > 0) {
        result.push({ teamName, formation, starters, subs });
      }
    }

    return result;
  } catch {
    return [];
  }
}

// ── Position badge colors ────────────────────────────────────────────────────

function posBadgeClass(short: string): string {
  switch (short) {
    case 'GK':  return 'bg-amber-500/15 text-amber-400/80 border-amber-500/20';
    case 'DEF': return 'bg-blue-500/15 text-blue-400/80 border-blue-500/20';
    case 'MID': return 'bg-emerald-500/15 text-emerald-400/80 border-emerald-500/20';
    case 'FWD': return 'bg-red-500/15 text-red-400/80 border-red-500/20';
    default:    return 'bg-white/8 text-white/50 border-white/10';
  }
}

// ── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({ player, idx, he }: { player: Player; idx: number; he: boolean }) {
  const posLabel = he ? ({
    GK: 'שוער', DEF: 'הגנה', MID: 'קישור', FWD: 'התקפה',
  }[player.positionShort] ?? player.positionShort) : player.positionShort;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.02, duration: 0.15 }}
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-lg',
        'hover:bg-white/[0.03] transition-colors',
        player.subbedOut && 'opacity-40',
      )}
    >
      {/* Jersey number */}
      <span className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/8 flex items-center justify-center text-[11px] font-bold tabular-nums text-text-muted shrink-0">
        {player.jersey || '–'}
      </span>

      {/* Name */}
      <span className={cn(
        'text-[12px] font-medium truncate flex-1 min-w-0',
        player.subbedOut ? 'text-white/30 line-through' : 'text-text-primary/80',
      )}>
        {player.name}
      </span>

      {/* Injury indicator */}
      {player.injured && (
        <AlertCircle size={10} className="text-accent-orange shrink-0" aria-label="Injured / Suspended" />
      )}

      {/* Sub indicators */}
      {player.subbedIn && (
        <span className="text-[9px] text-emerald-400/60 shrink-0">▲</span>
      )}
      {player.subbedOut && (
        <span className="text-[9px] text-red-400/60 shrink-0">▼</span>
      )}

      {/* Position badge */}
      <span className={cn(
        'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
        posBadgeClass(player.positionShort),
      )}>
        {posLabel}
      </span>
    </motion.div>
  );
}

// ── Team Roster Panel ────────────────────────────────────────────────────────

function TeamPanel({ roster, he }: { roster: TeamRoster; he: boolean }) {
  const { t } = useLangStore();
  const shortName = roster.teamName.split(' ').pop() || roster.teamName;

  return (
    <div className="space-y-2">
      {/* Team header + formation */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-text-primary/70 uppercase tracking-wider truncate">
          {shortName}
        </span>
        {roster.formation && (
          <span className="text-[10px] font-mono text-accent-green/60 bg-accent-green/8 border border-accent-green/15 rounded px-1.5 py-0.5 shrink-0">
            {roster.formation}
          </span>
        )}
      </div>

      {/* Starting XI */}
      <div className="rounded-xl border border-border-subtle bg-white/[0.015] overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-white/5">
          <span className="text-[9px] uppercase tracking-widest text-text-muted/50 font-semibold">
            {t('startingXI')}
          </span>
        </div>
        <div className="py-0.5">
          {roster.starters.map((p, i) => (
            <PlayerRow key={`${p.jersey}-${p.name}`} player={p} idx={i} he={he} />
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function RosterSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 py-2">
      {[0, 1].map(c => (
        <div key={c} className="space-y-2">
          <div className="flex justify-between px-1">
            <div className="w-16 h-3 rounded bg-white/6 animate-pulse" />
            <div className="w-10 h-3 rounded bg-white/6 animate-pulse" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-2 px-2">
              <div className="w-6 h-6 rounded bg-white/6 animate-pulse shrink-0" />
              <div className="flex-1 h-3 rounded bg-white/6 animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function MatchRosters({ match }: { match: Match }) {
  const { t, lang } = useLangStore();
  const he = lang === 'he';
  const [open, setOpen] = useState(false);
  const [rosters, setRosters] = useState<TeamRoster[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;
    fetchedRef.current = true;

    let cancelled = false;
    setLoading(true);

    fetchRosters(match.external_id, match.league_id)
      .then(data => { if (!cancelled) setRosters(data); })
      .catch(() => { if (!cancelled) setRosters([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, match.external_id, match.league_id]);

  // Can we show the tactical pitch? Need 2 rosters with formations
  const canShowPitch = rosters != null && rosters.length >= 2 &&
    rosters[0].starters.length >= 5 && rosters[1].starters.length >= 5;
  const hasFormations = canShowPitch && (rosters[0].formation || rosters[1].formation);

  // If formations are missing, fall back to list automatically
  const effectiveView = hasFormations ? viewMode : 'list';

  // Hide for leagues without ESPN coverage
  if (!LEAGUE_ESPN_SLUG[match.league_id]) return null;
  // Hide once we know there are no rosters
  if (rosters !== null && rosters.length === 0 && !loading) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-2 py-1 rounded-xl hover:bg-white/3 transition-colors group"
      >
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-white/30 group-hover:text-white/50 transition-colors">
          <Users size={12} className="opacity-50" />
          {t('lineups')}
          {rosters && rosters.length > 0 && rosters[0].formation && (
            <span className="ms-1 text-white/18 normal-case tracking-normal">
              · {rosters[0].formation} vs {rosters[1]?.formation ?? '?'}
            </span>
          )}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' as const }}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200',
            'border border-border-subtle',
            open
              ? 'bg-[rgba(73,136,196,0.18)] text-text-primary'
              : 'bg-transparent text-text-muted group-hover:bg-[rgba(73,136,196,0.10)] group-hover:text-text-primary',
          )}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="match-rosters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-2 px-1">
              {loading && <RosterSkeleton />}

              {rosters && rosters.length >= 2 && !loading && (
                <>
                  {/* View toggle — only when formations exist */}
                  {hasFormations && (
                    <div className="flex items-center justify-center gap-1 mb-3">
                      <button
                        onClick={() => setViewMode('pitch')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-semibold transition-colors',
                          effectiveView === 'pitch'
                            ? 'bg-accent-green/15 text-accent-green border border-accent-green/25'
                            : 'text-text-muted/40 hover:text-text-muted/60 border border-transparent',
                        )}
                      >
                        <MapPin size={10} />
                        {t('pitchView')}
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-semibold transition-colors',
                          effectiveView === 'list'
                            ? 'bg-accent-green/15 text-accent-green border border-accent-green/25'
                            : 'text-text-muted/40 hover:text-text-muted/60 border border-transparent',
                        )}
                      >
                        <LayoutGrid size={10} />
                        {t('listView')}
                      </button>
                    </div>
                  )}

                  {/* Tactical Pitch View */}
                  {effectiveView === 'pitch' && canShowPitch && (
                    <TacticalPitch
                      homeFormation={rosters[0].formation}
                      awayFormation={rosters[1].formation}
                      homeStarters={rosters[0].starters}
                      awayStarters={rosters[1].starters}
                      homeTeam={rosters[0].teamName}
                      awayTeam={rosters[1].teamName}
                      rtl={he}
                    />
                  )}

                  {/* List View */}
                  {effectiveView === 'list' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {rosters.map((r, i) => (
                        <TeamPanel key={i} roster={r} he={he} />
                      ))}
                    </div>
                  )}

                  {/* Subs (shown below both views) */}
                  {rosters.some(r => r.subs.length > 0) && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {rosters.map((r, i) => (
                        r.subs.length > 0 ? (
                          <div key={i} className="rounded-xl border border-border-subtle bg-white/[0.015] overflow-hidden">
                            <div className="px-2.5 py-1.5 border-b border-white/5">
                              <span className="text-[9px] uppercase tracking-widest text-text-muted/50 font-semibold">
                                {(r.teamName.split(' ').pop() ?? r.teamName)} · {t('substitutes')}
                              </span>
                            </div>
                            <div
                              className="py-0.5 max-h-[200px] overflow-y-auto overscroll-contain"
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {r.subs.map((p, j) => (
                                <PlayerRow key={`${p.jersey}-${p.name}`} player={p} idx={j} he={he} />
                              ))}
                            </div>
                          </div>
                        ) : <div key={i} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
