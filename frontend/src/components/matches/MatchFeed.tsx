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
    if (activeTab === 'upcoming') {
      filtered = filtered.filter(m => m.status === 'NS' && new Date(m.kickoff_time) > new Date());
    } else if (activeTab === 'live') {
      filtered = filtered.filter(m => LIVE_STATUSES.includes(m.status));
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(m => FINISHED_STATUSES.includes(m.status));
    }
    return filtered;
  }, [matches, activeTab]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const match of filteredMatches) {
      const date = new Date(match.kickoff_time).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      });
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(match);
    }
    return groups;
  }, [filteredMatches]);

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
