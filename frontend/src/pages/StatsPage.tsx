import { useMemo, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../lib/constants';
import { useLangStore } from '../stores/langStore';
import { useGroupStore } from '../stores/groupStore';
import { useLeagueStats } from '../hooks/useLeagueStats';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LeagueLeaders } from '../components/stats/LeagueLeaders';
import { LeagueDropdown } from '../components/stats/LeagueDropdown';
import { WorldCupBracket } from '../components/stats/WorldCupBracket';
import { BentoArena } from '../components/stats/BentoArena';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

// Leagues handled by a custom view instead of the ESPN standings/leaders feed.
const WORLD_CUP_ID = 4480;
const CUSTOM_VIEW_LEAGUES = new Set<number>([WORLD_CUP_ID]);

type ArenaTab = 'leagues' | 'arena';

export function StatsPage() {
  const { t, lang } = useLangStore();
  const { groups, activeGroupId } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const [tab, setTab] = useState<ArenaTab>('leagues');

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

          {data?.leaders && (
            (data.leaders.scorers?.length > 0) ||
            (data.leaders.assists?.length > 0) ||
            (data.leaders.discipline?.length > 0)
          ) && (
            <section className="space-y-2">
              <h2 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
                {t('statsLeaders')}
              </h2>
              <LeagueLeaders
                scorers={data.leaders.scorers ?? []}
                assists={data.leaders.assists ?? []}
                discipline={data.leaders.discipline ?? []}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
