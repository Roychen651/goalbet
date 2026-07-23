import { useState, Fragment } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatSeasonLabel } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { useTeamForm } from '../../hooks/useLeagueStats';
import { EntityBadge } from '../ui/EntityBadge';
import { haptic } from '../../lib/haptics';
import type { StandingsRow, HomeAwaySplits } from '../../hooks/useLeagueStats';

interface StandingsTableProps {
  rows: StandingsRow[];
  leagueId: number;
  // V5 Sprint 55 — both optional, both hidden entirely when absent (ESPN
  // doesn't expose a home/away split for every league; a rank-change
  // signal only exists once this backend process has seen a real
  // matchday for this league — see stats.ts's computeRankChanges()).
  homeAwaySplits?: HomeAwaySplits | null;
  rankChanges?: Record<string, number> | null;
  // V5 Sprint 55 hotfix — real, live-reported confusion: when a new UEFA
  // cup season's league-phase table has no rows yet (weeks after
  // qualifying begins), stats.ts falls back to the last COMPLETED
  // season's final table rather than showing nothing — but nothing in the
  // UI said so, so a fully-finished table (every team P=8/38/etc.) read as
  // "the current live table," not "last season's result." Both optional
  // so an older caller passing neither still renders exactly as before.
  season?: number;
  isFallbackSeason?: boolean;
  // V7 Sprint 56 follow-up — The Season Archive. True when the caller
  // deliberately selected a past archived season (StatsPage's season
  // selector), as opposed to isFallbackSeason above (an UNintentional
  // fallback the user never asked for). Distinct copy/tone on purpose —
  // this one is informational, not a "heads up, this isn't what you think"
  // warning.
  viewingArchivedSeason?: boolean;
}

const COLUMN_COUNT = 9; // sticky rank·team + P/W/D/L/GF/GA/GD/Pts

type SplitView = 'total' | 'home' | 'away';

export function StandingsTable({ rows, leagueId, homeAwaySplits, rankChanges, season, isFallbackSeason, viewingArchivedSeason }: StandingsTableProps) {
  const { t } = useLangStore();
  // V4 Sprint 27 — which team's Interactive Team Sheet is open, if any. Same
  // parent-owned single-expanded-id shape as LeaderboardTable's
  // expandedUserId (§36) — only one row open at a time, in-place, no modal,
  // no full page reload.
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  // V5 Sprint 55 — Total/Home/Away toggle. Only rendered at all when
  // homeAwaySplits has real data; rank-change badges only ever apply to
  // the Total view (a home-only or away-only "rank" isn't a real concept
  // ESPN exposes), so switching away from Total hides them for that reason,
  // not a bug.
  const [splitView, setSplitView] = useState<SplitView>('total');
  const hasHomeAway = !!(homeAwaySplits && (homeAwaySplits.home.length > 0 || homeAwaySplits.away.length > 0));
  const activeRows = splitView === 'home' ? (homeAwaySplits?.home ?? []) : splitView === 'away' ? (homeAwaySplits?.away ?? []) : rows;

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {isFallbackSeason && season != null && (
        <div className="rounded-lg border border-accent-orange/25 bg-accent-orange/10 px-3 py-2 text-xs text-white/90">
          {t('statsFallbackSeasonLabel').replace('{0}', formatSeasonLabel(season))}
        </div>
      )}
      {viewingArchivedSeason && season != null && (
        <div className="rounded-lg border border-accent-secondary/30 bg-accent-secondary/10 px-3 py-2 text-xs text-white/90">
          {t('statsArchivedSeasonLabel').replace('{0}', formatSeasonLabel(season))}
        </div>
      )}
      {hasHomeAway && (
        <div className="flex gap-1.5 rounded-xl border border-border-subtle bg-bg-card/60 p-1 w-fit ms-auto">
          {([
            { id: 'total' as SplitView, label: t('statsStandings') },
            { id: 'home' as SplitView, label: t('statsHomeSplit') },
            { id: 'away' as SplitView, label: t('statsAwaySplit') },
          ]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSplitView(opt.id)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
                splitView === opt.id ? 'bg-accent-green/15 text-white ring-1 ring-accent-green/30' : 'text-text-muted hover:text-white/80',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <StandingsGrid rows={activeRows} leagueId={leagueId} rankChanges={splitView === 'total' ? rankChanges : null} expandedTeamId={expandedTeamId} setExpandedTeamId={setExpandedTeamId} />
    </div>
  );
}

function StandingsGrid({
  rows,
  leagueId,
  rankChanges,
  expandedTeamId,
  setExpandedTeamId,
}: {
  rows: StandingsRow[];
  leagueId: number;
  rankChanges?: Record<string, number> | null;
  expandedTeamId: string | null;
  setExpandedTeamId: (id: string | null | ((prev: string | null) => string | null)) => void;
}) {
  const { t } = useLangStore();

  if (rows.length === 0) return null;

  return (
    // Wrapper is the horizontal scroller. The first column inside the table
    // is sticky to the inline-start edge so Rank + Team stay visible on mobile.
    // Sticky cells need a solid background so scrolling content doesn't bleed through.
    <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-card backdrop-blur-glass">
      <table className="w-full text-start text-[11px] font-mono border-separate border-spacing-0">
        <thead>
          <tr className="text-text-muted uppercase tracking-wider text-[10px]">
            <th className="sticky start-0 z-10 bg-bg-card px-3 py-2.5 text-start whitespace-nowrap font-semibold">
              {t('statsColRank')} · {t('statsColTeam')}
            </th>
            <Th>{t('statsColPlayed')}</Th>
            <Th>{t('statsColWon')}</Th>
            <Th>{t('statsColDrawn')}</Th>
            <Th>{t('statsColLost')}</Th>
            <Th>{t('statsColGF')}</Th>
            <Th>{t('statsColGA')}</Th>
            <Th>{t('statsColGD')}</Th>
            <Th bold>{t('statsColPts')}</Th>
          </tr>
        </thead>
        <LayoutGroup id="standings-rows">
          <tbody>
            {rows.map((row) => {
              const teamId = row.team.id;
              const isExpanded = teamId !== '' && expandedTeamId === teamId;
              const rowKey = teamId || `${row.rank}-${row.team.name}`;
              return (
                <Fragment key={rowKey}>
                  {/* Data row — same real <td> grid as before the accordion
                      work, so the sticky-first-column-only scroll behavior
                      (rest of the row scrolls horizontally, team identity
                      stays pinned) is unchanged. The whole sticky cell is
                      now a button (rank+badge+name+chevron) toggling the
                      panel row below — no separate stopPropagation needed
                      since, unlike LeaderboardRow, nothing else on this row
                      has a competing click handler to preserve. */}
                  <motion.tr layout transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                    <td className="sticky start-0 z-10 bg-bg-card p-0 text-start whitespace-nowrap border-t border-border-subtle/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (!teamId) return;
                          haptic('selection');
                          setExpandedTeamId(prev => prev === teamId ? null : teamId);
                        }}
                        disabled={!teamId}
                        aria-expanded={isExpanded}
                        aria-label={t('statsExpandTeam')}
                        className={cn(
                          'flex items-center gap-2 min-w-[150px] w-full px-3 py-2.5 text-start transition-colors',
                          teamId && 'hover:bg-white/4 cursor-pointer',
                        )}
                      >
                        <span className="w-5 text-end text-text-muted font-mono tabular-nums shrink-0">{row.rank || '—'}</span>
                        {/* V5 Sprint 55 — rank-change badge. Rendered ONLY
                            when a real delta exists for this team this tick
                            (see computeRankChanges()'s honest, gp-gated
                            design) — never a static/zero placeholder. Color
                            reuses this app's existing accent-green (up) /
                            accent-orange (down) pair, never color alone
                            (the chevron direction + aria-label carry the
                            same information). */}
                        {teamId && rankChanges?.[teamId] != null && (
                          <span
                            className={cn(
                              'flex items-center shrink-0',
                              rankChanges[teamId] > 0 ? 'text-accent-green' : 'text-accent-orange',
                            )}
                            aria-label={t(rankChanges[teamId] > 0 ? 'statsRankUp' : 'statsRankDown').replace('{0}', String(Math.abs(rankChanges[teamId])))}
                            title={t(rankChanges[teamId] > 0 ? 'statsRankUp' : 'statsRankDown').replace('{0}', String(Math.abs(rankChanges[teamId])))}
                          >
                            {rankChanges[teamId] > 0 ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            <span className="font-mono text-[10px] tabular-nums">{Math.abs(rankChanges[teamId])}</span>
                          </span>
                        )}
                        <EntityBadge
                          src={row.team.logo}
                          name={row.team.shortName || row.team.name}
                          hashSeed={row.team.name}
                          size={18}
                          className="shrink-0"
                        />
                        <span className="text-white text-xs font-sans font-medium truncate flex-1 min-w-0">
                          {row.team.shortName || row.team.name}
                        </span>
                        {teamId && (
                          <motion.div
                            className="shrink-0"
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' as const }}
                          >
                            <ChevronDown size={13} className="text-text-muted" />
                          </motion.div>
                        )}
                      </button>
                    </td>
                    <Td>{row.gp}</Td>
                    <Td>{row.w}</Td>
                    <Td>{row.d}</Td>
                    <Td>{row.l}</Td>
                    <Td>{row.gf}</Td>
                    <Td>{row.ga}</Td>
                    <Td>{formatSigned(row.gd)}</Td>
                    <Td bold>{row.points}</Td>
                  </motion.tr>

                  {/* Panel row — always present in the DOM (so AnimatePresence's
                      exit animation has somewhere to play), collapses to zero
                      height via the inner motion.div when not expanded. Same
                      shape as LeaderboardRow's in-place preview, adapted to
                      valid <table> markup: a panel can't live inside a <tr>
                      except as its own full-width <td colSpan>. */}
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="p-0 border-0">
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                            className="overflow-hidden"
                          >
                            <TeamSheetPanel leagueId={leagueId} teamId={teamId} row={row} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </LayoutGroup>
      </table>
    </div>
  );
}

function TeamSheetPanel({ leagueId, teamId, row }: { leagueId: number; teamId: string; row: StandingsRow }) {
  const { t, lang } = useLangStore();
  const { data, loading } = useTeamForm(leagueId, teamId);

  const goalsPerMatch = row.gp > 0 ? (row.gf / row.gp).toFixed(1) : '—';

  return (
    <div className="px-3 pb-3 pt-2 border-t border-border-subtle/40 space-y-3 min-w-[520px]">
      {/* Form Guide — last 5 matches, oldest -> newest, left-to-right */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{t('statsFormGuide')}</div>
        {loading ? (
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(i => <span key={i} className="w-6 h-6 rounded-full bg-white/5 animate-pulse" />)}
          </div>
        ) : !data || data.form.length === 0 ? (
          <div className="text-text-muted text-xs">{t('statsNoFormData')}</div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {data.form.map((result, i) => {
              const match = [...data.matches].reverse()[i];
              const letter = lang === 'he'
                ? (result === 'W' ? 'נ' : result === 'D' ? 'ת' : 'ה')
                : result;
              const label = result === 'W' ? t('statsResultWin') : result === 'D' ? t('statsResultDraw') : t('statsResultLoss');
              return (
                <span
                  key={`${match?.eventId ?? i}`}
                  title={match ? `${match.opponent} · ${match.teamScore}-${match.opponentScore}` : label}
                  aria-label={label}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold tabular-nums shrink-0 ring-1',
                    result === 'W' && 'bg-accent-green/15 text-accent-green ring-accent-green/30',
                    result === 'D' && 'bg-white/8 text-text-muted ring-white/15',
                    result === 'L' && 'bg-accent-orange/15 text-accent-orange ring-accent-orange/30',
                  )}
                >
                  {letter}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Stats */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{t('statsTeamStats')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t('statsGoalsPerMatch')} value={goalsPerMatch} />
          <StatTile label={t('statsCornersPerMatch')} value={data?.cornersPerMatch != null ? data.cornersPerMatch.toFixed(1) : '—'} />
          <StatTile label={t('statsCleanSheets')} value={data ? String(data.cleanSheets) : '—'} />
          <StatTile label={t('statsAvgCards')} value={data?.cardsPerMatch != null ? data.cardsPerMatch.toFixed(1) : '—'} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/3 border border-white/8 px-2.5 py-2">
      <div className="font-mono text-sm tabular-nums font-semibold text-white">{value}</div>
      <div className="text-text-muted text-[9px] mt-0.5 truncate">{label}</div>
    </div>
  );
}

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function Th({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <th
      className={cn(
        'px-2 py-2.5 text-end whitespace-nowrap font-semibold',
        bold && 'text-white',
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td
      className={cn(
        'px-2 py-2.5 text-end whitespace-nowrap tabular-nums border-t border-border-subtle/60',
        bold ? 'text-white font-semibold' : 'text-white/80',
      )}
    >
      {children}
    </td>
  );
}
