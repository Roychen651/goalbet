import { useMemo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../lib/constants';
import { useLangStore } from '../stores/langStore';
import { useGroupStore } from '../stores/groupStore';
import { useLeagueStats } from '../hooks/useLeagueStats';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LeagueLeaders } from '../components/stats/LeagueLeaders';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

export function StatsPage() {
  const { t } = useLangStore();
  const { groups, activeGroupId } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Only offer leagues that have an ESPN slug — otherwise the backend has no data source.
  const availableLeagues = useMemo(
    () => FOOTBALL_LEAGUES.filter(l => LEAGUE_ESPN_SLUG[l.id]),
    [],
  );

  const defaultLeagueId = useMemo(() => {
    const fromGroup = activeGroup?.active_leagues?.find(id => LEAGUE_ESPN_SLUG[id]);
    return fromGroup ?? availableLeagues[0]?.id ?? null;
  }, [activeGroup, availableLeagues]);

  const [leagueId, setLeagueId] = useState<number | null>(defaultLeagueId);

  // If group's active leagues load in after initial mount, update default once.
  useEffect(() => {
    if (leagueId == null && defaultLeagueId != null) setLeagueId(defaultLeagueId);
  }, [defaultLeagueId, leagueId]);

  const { data, loading, error } = useLeagueStats(leagueId);

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

        {/* League selector */}
        <div className="relative">
          <label htmlFor="stats-league" className="sr-only">{t('statsSelectLeague')}</label>
          <select
            id="stats-league"
            value={leagueId ?? ''}
            onChange={(e) => setLeagueId(parseInt(e.target.value, 10))}
            className="appearance-none bg-bg-card border border-border-subtle rounded-lg ps-3 pe-8 py-2 text-sm text-white font-medium cursor-pointer hover:border-border-bright transition-colors min-w-[180px]"
          >
            {availableLeagues.map(l => (
              <option key={l.id} value={l.id} className="bg-bg-base">
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
        </div>
      </div>

      {/* Standings */}
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

      {/* Leaders — silently hidden when unavailable */}
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
    </div>
  );
}
