import { useMemo, useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '../lib/utils';
import { FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../lib/constants';
import { useLangStore } from '../stores/langStore';
import { useGroupStore } from '../stores/groupStore';
import { useLeagueStats, useArchivedSeasonsList, useArchivedSeasonStats, useCurrentSeasonRaw } from '../hooks/useLeagueStats';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LeagueLeaders } from '../components/stats/LeagueLeaders';
import { TeamMetricsView } from '../components/stats/TeamMetricsView';
import { KnockoutBracketView, isKnockoutCapableLeague } from '../components/stats/KnockoutBracketView';
import { SeasonSelector, type SeasonSelectorValue } from '../components/stats/SeasonSelector';
import { PulseFeed } from '../components/stats/PulseFeed';
import { LeagueDropdown } from '../components/stats/LeagueDropdown';
import { WorldCupBracket } from '../components/stats/WorldCupBracket';
import { BentoArena } from '../components/stats/BentoArena';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import type { TranslationKey } from '../lib/i18n';

// Leagues handled by a custom view instead of the ESPN standings/leaders feed.
const WORLD_CUP_ID = 4480;
const CUSTOM_VIEW_LEAGUES = new Set<number>([WORLD_CUP_ID]);

type ArenaTab = 'leagues' | 'arena';
// V5 Sprint 55 — the 3 mandated tabs inside "Leagues": Standings / Player
// Leaders / Team Metrics. Reuses the exact layoutId shared-transition
// pattern already proven for LeagueLeaders' own sub-nav and HomePage's
// Segmented Snapper — a new literal id ("leagueStatsSubTab"), never the
// same id as either of those (Framer's layoutId is a plain string match,
// not automatically scoped per component tree).
// V7 Sprint 56 — a 4th sub-tab, 'knockout', only ever shown for the 3
// UEFA club competitions that actually run a knockout stage after their
// Swiss-model league phase (see isKnockoutCapableLeague). It renders its
// own KnockoutBracketView, which fetches independently of useLeagueStats
// (via useKnockoutMatches) — never gated behind the standings/leaders
// loading state below, since it has nothing to do with either.
type LeagueSubTab = 'standings' | 'leaders' | 'teamMetrics' | 'knockout';

export function StatsPage() {
  const { t, lang } = useLangStore();
  const { groups, activeGroupId } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const [tab, setTab] = useState<ArenaTab>('leagues');
  const [leagueSubTab, setLeagueSubTab] = useState<LeagueSubTab>('standings');

  // Offer leagues with ESPN data, plus tournaments we render with a custom view.
  const availableLeagues = useMemo(
    () => FOOTBALL_LEAGUES.filter(l => LEAGUE_ESPN_SLUG[l.id] || CUSTOM_VIEW_LEAGUES.has(l.id)),
    [],
  );

  const defaultLeagueId = useMemo(() => {
    const fromGroup = activeGroup?.active_leagues?.find(
      id => LEAGUE_ESPN_SLUG[id] || CUSTOM_VIEW_LEAGUES.has(id),
    );
    return fromGroup ?? availableLeagues[0]?.id ?? null;
  }, [activeGroup, availableLeagues]);

  const [leagueId, setLeagueId] = useState<number | null>(defaultLeagueId);

  useEffect(() => {
    if (leagueId == null && defaultLeagueId != null) setLeagueId(defaultLeagueId);
  }, [defaultLeagueId, leagueId]);

  // A league switch away from a knockout-capable competition must not leave
  // the sub-tab state pointed at a pill that's no longer rendered.
  useEffect(() => {
    if (leagueSubTab === 'knockout' && !isKnockoutCapableLeague(leagueId)) {
      setLeagueSubTab('standings');
    }
  }, [leagueId, leagueSubTab]);

  const isCustomView = leagueId != null && CUSTOM_VIEW_LEAGUES.has(leagueId);
  const { data, loading, error } = useLeagueStats(isCustomView ? null : leagueId);

  // V7 Sprint 56 follow-up — The Season Archive. `selectedSeason` is
  // deliberately reset to null (back to "current") on every league switch —
  // a season number that made sense for one league (e.g. it has a 2024
  // archive) has no guaranteed meaning for a different one, and silently
  // carrying it over could point at a season this new league never had.
  // V7 Sprint 57 — widened from `number | null` to also accept the literal
  // `'current'` sentinel (SeasonSelector's un-substituted true-current-
  // season option, distinct from `null`'s smart-default view).
  const [selectedSeason, setSelectedSeason] = useState<SeasonSelectorValue>(null);
  useEffect(() => { setSelectedSeason(null); }, [leagueId]);

  const { seasons: archivedSeasons } = useArchivedSeasonsList(isCustomView ? null : leagueId);
  const { data: archivedData, loading: archivedLoading } = useArchivedSeasonStats(
    isCustomView ? null : leagueId,
    typeof selectedSeason === 'number' ? selectedSeason : null,
  );
  const { data: currentRawData, loading: currentRawLoading } = useCurrentSeasonRaw(
    isCustomView ? null : leagueId,
    selectedSeason === 'current',
  );
  const viewingArchive = typeof selectedSeason === 'number';
  const viewingCurrentRaw = selectedSeason === 'current';

  // The TRUE current season number — never the fallback-substituted one.
  // Derived purely from fields the default useLeagueStats() call already
  // returns (isFallbackSeason + season), zero extra network cost: when
  // substitution happened, `data.season` IS the fallback (season-1), so
  // the real current season is one year ahead of it.
  const trueCurrentSeasonNumber = data ? (data.isFallbackSeason ? data.season + 1 : data.season) : null;

  // V7 Sprint 57 — the Knockout bracket now reads directly from the
  // already-synced `matches` table, filtered by kickoff-time date range
  // (useKnockoutMatches's own `season` param) — it is NOT sourced from
  // league_season_archive (which only ever stored standings/leaders
  // aggregates, never per-match data). This means a genuinely past season
  // CAN show its real historical bracket, as long as those matches exist
  // in `matches` with a real `round` value (backfillMatchRounds.ts is the
  // one-time repair for matches synced before Sprint 48 added live round
  // capture) — so the Knockout tab is no longer hidden while viewing an
  // archived season; it's fed the archived season's own number instead of
  // the true-current one.
  const knockoutSeason = viewingArchive ? (selectedSeason as number) : trueCurrentSeasonNumber;

  // Effective payload the render branches below actually consume — the
  // live useLeagueStats() data, the un-substituted true-current-season
  // fetch, or the selected archived season's snapshot, all reshaped into
  // the exact same field names. homeAwaySplits/rankChanges/isFallbackSeason
  // are live-tracking concepts with no meaning for a frozen historical
  // record, so they're always null/false on the archived side —
  // StandingsTable already hides those UI elements whenever absent.
  const effectiveStandings = viewingArchive
    ? (archivedData?.standings ?? [])
    : viewingCurrentRaw
      ? (currentRawData?.standings ?? [])
      : (data?.standings ?? []);
  const effectiveLeaders = viewingArchive
    ? (archivedData?.leaders ?? null)
    : viewingCurrentRaw
      ? (currentRawData?.leaders ?? null)
      : data?.leaders;
  const effectiveSeason = viewingArchive
    ? (archivedData?.season ?? selectedSeason ?? undefined)
    : viewingCurrentRaw
      ? (currentRawData?.season ?? trueCurrentSeasonNumber ?? undefined)
      : data?.season;
  const effectiveLoading = viewingArchive ? archivedLoading : viewingCurrentRaw ? currentRawLoading : (loading && !data);

  const selectedLeague = availableLeagues.find(l => l.id === leagueId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-white">
            {t('statsHubTitle')}
          </h1>
          {selectedLeague && (
            <p className="text-text-muted text-xs mt-0.5">{lang === 'he' ? selectedLeague.nameHe : selectedLeague.name}</p>
          )}
        </div>

        {tab === 'leagues' && (
          <LeagueDropdown
            leagues={availableLeagues}
            value={leagueId}
            onChange={setLeagueId}
          />
        )}
      </div>

      {/* V7 Sprint 56 follow-up — The Season Archive. Self-hides via
          SeasonSelector's own `seasons.length === 0` check; never rendered
          at all for the World Cup's custom view (no seasons concept there). */}
      {tab === 'leagues' && !isCustomView && (
        <SeasonSelector
          seasons={archivedSeasons}
          selectedSeason={selectedSeason}
          onSelect={setSelectedSeason}
          currentSeasonNumber={trueCurrentSeasonNumber}
          showCurrentOption={!!data?.isFallbackSeason}
          currentSeasonStarted={!!currentRawData?.hasStarted}
        />
      )}

      {/* Sub-tabs — same borderless pill pattern as HomePage's All/Upcoming/Live/Results */}
      <div className="flex gap-1.5">
        {([
          { id: 'leagues' as ArenaTab, label: t('arenaTabLeagues') },
          { id: 'arena' as ArenaTab, label: t('arenaTabMyArena') },
        ]).map(sub => (
          <button
            key={sub.id}
            onClick={() => setTab(sub.id)}
            className={cn(
              'relative flex-1 py-1.5 text-[13px] font-semibold rounded-full transition-all duration-200 active:scale-[0.97]',
              tab === sub.id
                ? 'bg-accent-green text-bg-base shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                : 'text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10'
            )}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {tab === 'arena' ? (
        <BentoArena />
      ) : leagueId === WORLD_CUP_ID ? (
        <WorldCupBracket />
      ) : (
        <>
          {/* V5 Sprint 55 — Standings / Player Leaders / Team Metrics.
              Same shared-layoutId pill-morph technique already proven
              elsewhere in this app, a new literal id so it never
              cross-matches LeagueLeaders' own internal sub-nav or
              HomePage's Segmented Snapper. */}
          <LayoutGroup id="league-stats-subtab">
            <div className="flex gap-1.5 rounded-xl border border-border-subtle bg-bg-card/60 p-1">
              {([
                { id: 'standings' as LeagueSubTab, label: t('statsStandings') },
                { id: 'leaders' as LeagueSubTab, label: t('statsLeaders') },
                { id: 'teamMetrics' as LeagueSubTab, label: t('statsTabTeamMetrics') },
                // V7 Sprint 57 — no longer hidden while viewing an archived
                // season; KnockoutBracketView now reads real, season-
                // filtered matches for any season, not just the live one.
                ...(isKnockoutCapableLeague(leagueId)
                  ? [{ id: 'knockout' as LeagueSubTab, label: t('statsTabKnockout' as TranslationKey) }]
                  : []),
              ]).map(sub => {
                const isActive = leagueSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setLeagueSubTab(sub.id)}
                    className={cn(
                      'relative flex-1 rounded-lg px-2 py-2 font-barlow text-xs font-bold uppercase tracking-wider transition-colors',
                      isActive ? 'text-white' : 'text-text-muted hover:text-white/80',
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="leagueStatsSubTabPill"
                        className="absolute inset-0 rounded-lg bg-accent-green/15 ring-1 ring-accent-green/30"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          {leagueSubTab === 'knockout' && isKnockoutCapableLeague(leagueId) ? (
            // Independent of useLeagueStats — KnockoutBracketView fetches
            // its own data via useKnockoutMatches, so it's never gated
            // behind the standings/leaders loading/error state below.
            // Season-filtered so it always matches whichever season the
            // Season Selector currently has active — the true current one
            // (default/raw) or a genuinely archived one.
            <KnockoutBracketView leagueId={leagueId!} season={knockoutSeason} isCurrentSeason={!viewingArchive} />
          ) : effectiveLoading ? (
            <PageLoader />
          ) : (!viewingArchive && !viewingCurrentRaw && error) || (effectiveStandings.length === 0 && !effectiveLeaders) ? (
            <EmptyState icon="📊" title={t('statsNoData')} description="" />
          ) : (
            <>
              {leagueSubTab === 'standings' && (
                <StandingsTable
                  rows={effectiveStandings}
                  leagueId={leagueId!}
                  homeAwaySplits={viewingArchive || viewingCurrentRaw ? null : data?.homeAwaySplits}
                  rankChanges={viewingArchive || viewingCurrentRaw ? null : data?.rankChanges}
                  season={effectiveSeason}
                  isFallbackSeason={!viewingArchive && !viewingCurrentRaw && data?.isFallbackSeason}
                  viewingArchivedSeason={viewingArchive}
                  viewingUnstartedCurrentSeason={viewingCurrentRaw && !currentRawData?.hasStarted}
                />
              )}

              {leagueSubTab === 'leaders' && (
                effectiveLeaders && (
                  (effectiveLeaders.scorers?.length > 0) ||
                  (effectiveLeaders.assists?.length > 0) ||
                  (effectiveLeaders.discipline?.length > 0) ||
                  (effectiveLeaders.goalkeepers?.length > 0)
                ) ? (
                  <LeagueLeaders
                    scorers={effectiveLeaders.scorers ?? []}
                    assists={effectiveLeaders.assists ?? []}
                    discipline={effectiveLeaders.discipline ?? []}
                    goalkeepers={effectiveLeaders.goalkeepers ?? []}
                  />
                ) : (
                  <EmptyState icon="🏅" title={t('statsNoLeadersInCategory' as TranslationKey)} description="" />
                )
              )}

              {leagueSubTab === 'teamMetrics' && (
                <TeamMetricsView standings={effectiveStandings} goalkeepers={effectiveLeaders?.goalkeepers ?? []} />
              )}
            </>
          )}

          <PulseFeed leagueId={leagueId} active={tab === 'leagues' && !isCustomView} />
        </>
      )}
    </div>
  );
}
