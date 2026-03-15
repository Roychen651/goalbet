import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { MatchCard } from './MatchCard';
import { EmptyState } from '../ui/EmptyState';
import { PageLoader } from '../ui/LoadingSpinner';
import { PredictionData } from './PredictionForm';
import { LIVE_STATUSES, FINISHED_STATUSES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';

interface MatchFeedProps {
  matches: Match[];
  predictions: Map<string, Prediction>;
  predictorsByMatch?: Map<string, { user_id: string; username: string; avatar_url: string | null }[]>;
  loading: boolean;
  savingMatchId: string | null;
  onSavePrediction: (data: PredictionData) => Promise<void>;
  activeTab: 'all' | 'upcoming' | 'live' | 'completed';
}

export function MatchFeed({
  matches, predictions, predictorsByMatch, loading, savingMatchId, onSavePrediction, activeTab,
}: MatchFeedProps) {
  const { t } = useLangStore();

  const filteredMatches = useMemo(() => {
    let filtered = [...matches];
    const now = Date.now();
    // NS match past kickoff — backend hasn't polled status yet but game is in progress
    const isStalledNS = (m: Match) => m.status === 'NS' && new Date(m.kickoff_time).getTime() < now;

    if (activeTab === 'upcoming') {
      // Upcoming = NS with future kickoff only (stalled NS go to live)
      filtered = filtered.filter(m => m.status === 'NS' && !isStalledNS(m));
    } else if (activeTab === 'live') {
      // Live = actual live statuses + NS matches that have passed kickoff
      filtered = filtered.filter(m => LIVE_STATUSES.includes(m.status) || isStalledNS(m));
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(m => FINISHED_STATUSES.includes(m.status));
    }
    return filtered;
  }, [matches, activeTab]);

  // Group by date, then within each date sort by (kickoff asc, league asc)
  // so same-competition games are always adjacent
  const groupedByDate = useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, Match[]>();
    for (const match of filteredMatches) {
      const date = new Date(match.kickoff_time).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      });
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(match);
    }
    // Sort each day's matches: live first → predicted first → kickoff time → league
    for (const [, dayMatches] of groups) {
      dayMatches.sort((a, b) => {
        const isStalledNS = (m: Match) => m.status === 'NS' && new Date(m.kickoff_time).getTime() < now;
        const aLive = LIVE_STATUSES.includes(a.status) || isStalledNS(a);
        const bLive = LIVE_STATUSES.includes(b.status) || isStalledNS(b);
        if (aLive !== bLive) return aLive ? -1 : 1;
        // Among same live/not-live bucket: predicted matches first
        const aPred = predictions.has(a.id) ? 0 : 1;
        const bPred = predictions.has(b.id) ? 0 : 1;
        if (aPred !== bPred) return aPred - bPred;
        const tA = new Date(a.kickoff_time).getTime();
        const tB = new Date(b.kickoff_time).getTime();
        if (tA !== tB) return tA - tB;
        return a.league_id - b.league_id;
      });
    }
    return groups;
  }, [filteredMatches, predictions]);

  if (loading) return <PageLoader />;

  if (filteredMatches.length === 0) {
    const getEmptyState = () => {
      if (activeTab === 'live') return { icon: '📡', title: t('noLiveMatches'), desc: t('noLiveDesc') };
      if (activeTab === 'upcoming') return { icon: '📅', title: t('noMatches'), desc: t('noUpcomingDesc') };
      return { icon: '📅', title: t('noMatches'), desc: t('noMatchesDesc') };
    };
    const { icon, title, desc } = getEmptyState();
    return <EmptyState icon={icon} title={title} description={desc} />;
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedByDate.entries()).map(([date, dayMatches]) => (
        <motion.section
          key={date}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
        >
          <h2 className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-3 px-1">{date}</h2>
          <div className="space-y-3">
            {dayMatches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ type: 'spring', stiffness: 85, damping: 18, delay: i * 0.06 }}
                whileHover={{ scale: 1.005, y: -3, rotateX: 0.6, rotateY: 0.4 }}
                style={{ transformStyle: 'preserve-3d', perspective: 1400 }}
              >
                <MatchCard
                  match={match}
                  prediction={predictions.get(match.id)}
                  predictors={predictorsByMatch?.get(match.id)}
                  onSavePrediction={onSavePrediction}
                  savingMatchId={savingMatchId}
                />
              </motion.div>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
