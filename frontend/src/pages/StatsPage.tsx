import { useMemo, useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '../lib/utils';
import { FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../lib/constants';
import { useLangStore } from '../stores/langStore';
import { useGroupStore } from '../stores/groupStore';
import { useLeagueStats } from '../hooks/useLeagueStats';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LeagueLeaders } from '../components/stats/LeagueLeaders';
import { TeamMetricsView } from '../components/stats/TeamMetricsView';
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
type LeagueSubTab = 'standings' | 'leaders' | 'teamMetrics';

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

  const isCustomView = leagueId != null && CUSTOM_VIEW_LEAGUES.has(leagueId);
  const { data, loading, error } = useLeagueStats(isCustomView ? null : leagueId);

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

          {loading && !data ? (
            <PageLoader />
          ) : error || (!data?.standings?.length && !data?.leaders) ? (
            <EmptyState icon="📊" title={t('statsNoData')} description="" />
          ) : (
            <>
              {leagueSubTab === 'standings' && (
                <StandingsTable
                  rows={data?.standings ?? []}
                  leagueId={leagueId!}
                  homeAwaySplits={data?.homeAwaySplits}
                  rankChanges={data?.rankChanges}
                />
              )}

              {leagueSubTab === 'leaders' && (
                data?.leaders && (
                  (data.leaders.scorers?.length > 0) ||
                  (data.leaders.assists?.length > 0) ||
                  (data.leaders.discipline?.length > 0) ||
                  (data.leaders.goalkeepers?.length > 0)
                ) ? (
                  <LeagueLeaders
                    scorers={data.leaders.scorers ?? []}
                    assists={data.leaders.assists ?? []}
                    discipline={data.leaders.discipline ?? []}
                    goalkeepers={data.leaders.goalkeepers ?? []}
                  />
                ) : (
                  <EmptyState icon="🏅" title={t('statsNoLeadersInCategory' as TranslationKey)} description="" />
                )
              )}

              {leagueSubTab === 'teamMetrics' && (
                <TeamMetricsView standings={data?.standings ?? []} goalkeepers={data?.leaders?.goalkeepers ?? []} />
              )}
            </>
          )}

          <PulseFeed leagueId={leagueId} active={tab === 'leagues' && !isCustomView} />
        </>
      )}
    </div>
  );
}
