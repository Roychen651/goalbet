import { useMemo, useState, useEffect } from 'react';
import { FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../lib/constants';
import { useLangStore } from '../stores/langStore';
import { useGroupStore } from '../stores/groupStore';
import { useLeagueStats } from '../hooks/useLeagueStats';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LeagueLeaders } from '../components/stats/LeagueLeaders';
import { LeagueDropdown } from '../components/stats/LeagueDropdown';
import { WorldCupBracket } from '../components/stats/WorldCupBracket';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

// Leagues handled by a custom view instead of the ESPN standings/leaders feed.
const WORLD_CUP_ID = 4480;
const CUSTOM_VIEW_LEAGUES = new Set<number>([WORLD_CUP_ID]);

export function StatsPage() {
  const { t } = useLangStore();
  const { groups, activeGroupId } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);

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
            <p className="text-text-muted text-xs mt-0.5">{selectedLeague.name}</p>
          )}
        </div>

        <LeagueDropdown
          leagues={availableLeagues}
          value={leagueId}
          onChange={setLeagueId}
        />
      </div>

      {leagueId === WORLD_CUP_ID ? (
        <WorldCupBracket />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('statsStandings')}
            </h2>
            {loading && !data ? (
              <PageLoader />
            ) : error || !data?.standings?.length ? (
              <EmptyState icon="📊" title={t('statsNoData')} description="" />
            ) : (
              <StandingsTable rows={data.standings} />
            )}
          </section>

          {data?.leaders && (data.leaders.scorers?.length > 0 || data.leaders.assists?.length > 0) && (
            <section className="space-y-2">
              <h2 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
                {t('statsLeaders')}
              </h2>
              <LeagueLeaders
                scorers={data.leaders.scorers ?? []}
                assists={data.leaders.assists ?? []}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
