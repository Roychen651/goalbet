import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLeaderboard, LeaderboardType } from '../hooks/useLeaderboard';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { supabase } from '../lib/supabase';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { LeaderboardInsights } from '../components/leaderboard/LeaderboardInsights';
import { UserMatchHistoryModal } from '../components/leaderboard/UserMatchHistoryModal';
import { H2HModal, H2HUser } from '../components/leaderboard/H2HModal';
import { GlassCard } from '../components/ui/GlassCard';
import { InfoTip } from '../components/ui/InfoTip';
import { cn } from '../lib/utils';
import { LeaderboardEntryWithProfile } from '../lib/supabase';

interface SelectedUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

// Sun-start ISO week boundaries. Must match `getWeekBoundsISO` in useLeaderboard.ts
// so the KPI card, insights, and table rows all pull from the SAME window.
function getWeekBoundsISO(type: 'weekly' | 'lastWeek'): { start: string; end: string } {
  const now = new Date();
  const thisSunday = new Date(now);
  thisSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  thisSunday.setUTCHours(0, 0, 0, 0);
  const lastSunday = new Date(thisSunday);
  lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);
  const nextSunday = new Date(thisSunday);
  nextSunday.setUTCDate(thisSunday.getUTCDate() + 7);
  return type === 'weekly'
    ? { start: thisSunday.toISOString(), end: nextSunday.toISOString() }
    : { start: lastSunday.toISOString(), end: thisSunday.toISOString() };
}

export type PeriodStat = { pts: number; made: number; correct: number };
export type PeriodStatsMap = Map<string, PeriodStat>;

export function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>('total');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [h2hFriend, setH2hFriend] = useState<H2HUser | null>(null);
  // Period-aware stats map keyed by user_id. null on 'total' tab (use cached leaderboard
  // row values); populated on weekly/lastWeek tabs so KPI, Insights, and Row all share
  // the SAME period-filtered numbers.
  const [periodStatsMap, setPeriodStatsMap] = useState<PeriodStatsMap | null>(null);
  const { entries, loading } = useLeaderboard(type);
  const { user } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const currentUserEntry = entries.find(e => e.user_id === user?.id);

  // Fetch period-specific predictions for ALL group members. This is the single source
  // of truth for the weekly/lastWeek tabs — consumed by the KPI summary card, the Sniper
  // and Grinder insights, and the picks/accuracy line in each leaderboard row.
  useEffect(() => {
    if (!activeGroupId) { setPeriodStatsMap(null); return; }
    if (type === 'total') { setPeriodStatsMap(null); return; }

    let cancelled = false;
    (async () => {
      const { start, end } = getWeekBoundsISO(type);

      // Step 1 — matches in the week window (same filter as useLeaderboard)
      const { data: weekMatches } = await supabase
        .from('matches')
        .select('id, home_score, away_score, status')
        .gte('kickoff_time', start)
        .lt('kickoff_time', end);
      if (cancelled) return;

      const matchMap = new Map(
        (weekMatches ?? []).map(m => [
          m.id as string,
          m as { id: string; home_score: number | null; away_score: number | null; status: string },
        ]),
      );

      if (matchMap.size === 0) {
        setPeriodStatsMap(new Map());
        return;
      }

      // Step 2 — all group predictions for those matches
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, match_id, points_earned, predicted_outcome')
        .eq('group_id', activeGroupId)
        .eq('is_resolved', true)
        .in('match_id', Array.from(matchMap.keys()));
      if (cancelled) return;

      // Step 3 — aggregate per user
      const map: PeriodStatsMap = new Map();
      for (const p of (preds ?? []) as {
        user_id: string;
        match_id: string;
        points_earned: number | null;
        predicted_outcome: string | null;
      }[]) {
        const cur = map.get(p.user_id) ?? { pts: 0, made: 0, correct: 0 };
        cur.pts += p.points_earned ?? 0;
        cur.made += 1;
        const match = matchMap.get(p.match_id);
        if (
          match &&
          match.status === 'FT' &&
          p.predicted_outcome &&
          match.home_score !== null &&
          match.away_score !== null
        ) {
          const actual = match.home_score > match.away_score
            ? 'H'
            : match.home_score < match.away_score
              ? 'A'
              : 'D';
          if (p.predicted_outcome === actual) cur.correct += 1;
        }
        map.set(p.user_id, cur);
      }
      setPeriodStatsMap(map);
    })();

    return () => { cancelled = true; };
  }, [activeGroupId, type]);

  const TABS: { key: LeaderboardType; label: string }[] = [
    { key: 'total', label: t('allTime') },
    { key: 'weekly', label: t('thisWeek') },
    { key: 'lastWeek', label: t('lastWeek') },
  ];

  // For the POINTS KPI: prefer the period map (the canonical period-filtered sum for
  // weekly/lastWeek). Fall back to the entry value while the map is being populated on
  // the first tab switch — useLeaderboard has already computed the correct period value
  // there, so this avoids a 0 flash.
  const currentPeriodStat = periodStatsMap && user?.id ? periodStatsMap.get(user.id) ?? null : null;
  const getPoints = (entry: LeaderboardEntryWithProfile) => {
    if (type === 'weekly') return entry.weekly_points;
    if (type === 'lastWeek') return entry.last_week_points ?? 0;
    return entry.total_points;
  };

  const pointsSub = type === 'weekly' ? t('thisWeek').toLowerCase()
    : type === 'lastWeek' ? t('lastWeek').toLowerCase()
    : t('allTime').toLowerCase();

  // Hit rate: period-specific when on weekly/lastWeek, all-time on total.
  // Reads from the same map that feeds Insights and Row so the three displays agree.
  const periodActive = type !== 'total';
  const hitMade = periodActive
    ? (currentPeriodStat?.made ?? 0)
    : (currentUserEntry?.predictions_made ?? 0);
  const hitCorrect = periodActive
    ? (currentPeriodStat?.correct ?? 0)
    : (currentUserEntry?.correct_predictions ?? 0);
  const hitDisplay = hitMade > 0 ? `${hitCorrect}/${hitMade}` : '—';
  const hitPct = hitMade > 0 ? `${Math.round(hitCorrect / hitMade * 100)}%` : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-white">{t('leaderboard')}</h1>
        {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
      </div>

      {/* Toggle */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150',
              type === tab.key
                ? 'bg-accent-green text-bg-base shadow-glow-green-sm'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Insights bento — On Fire, Sniper, Grinder */}
      {!loading && entries.length > 0 && (
        <LeaderboardInsights entries={entries} type={type} periodStatsMap={periodStatsMap} />
      )}

      {/* Your rank summary — fully period-aware */}
      {currentUserEntry && (
        <GlassCard variant="elevated" className="p-4 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('yourRank')}
              <InfoTip text={t('infoRank')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-accent-green text-glow-green">
              #{currentUserEntry.rank}
            </div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">{pointsSub}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('points')}
              <InfoTip text={t('infoPoints')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-white">
              {getPoints(currentUserEntry)}
            </div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">{pointsSub}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('hitRate')}
              <InfoTip text={t('infoHitRate')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-white">{hitDisplay}</div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">
              {hitPct ?? (periodActive ? pointsSub : t('allTimeLabel'))}
            </div>
          </div>
        </GlassCard>
      )}

      <LeaderboardTable
        entries={entries}
        loading={loading}
        currentUserId={user?.id}
        type={type}
        periodStatsMap={periodStatsMap}
        onUserClick={(entry) => {
          if (entry.user_id === user?.id) {
            // Own row → show personal match history
            setSelectedUser({ user_id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url ?? null });
          } else {
            // Another user → H2H comparison
            setH2hFriend({ user_id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url ?? null, weekly_points: entry.weekly_points ?? 0, total_points: entry.total_points, last_week_points: entry.last_week_points ?? 0 });
          }
        }}
      />

      <AnimatePresence>
        {selectedUser && activeGroupId && (
          <UserMatchHistoryModal
            user={selectedUser}
            groupId={activeGroupId}
            type={type}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {h2hFriend && activeGroupId && currentUserEntry && (
          <H2HModal
            me={{
              user_id: currentUserEntry.user_id,
              username: currentUserEntry.username,
              avatar_url: currentUserEntry.avatar_url ?? null,
              weekly_points: currentUserEntry.weekly_points ?? 0,
              total_points: currentUserEntry.total_points,
              last_week_points: currentUserEntry.last_week_points ?? 0,
            }}
            friend={h2hFriend}
            groupId={activeGroupId}
            onClose={() => setH2hFriend(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
