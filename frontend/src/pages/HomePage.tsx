import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMatches } from '../hooks/useMatches';
import { useMatchSync } from '../hooks/useMatchSync';
import { usePredictions } from '../hooks/usePredictions';
import { useGroupMatchPredictions } from '../hooks/useGroupMatchPredictions';
import { useGroupStore } from '../stores/groupStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import { MatchFeed } from '../components/matches/MatchFeed';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { NeonButton } from '../components/ui/NeonButton';
import { ScoringGuide } from '../components/ui/ScoringGuide';
import { cn } from '../lib/utils';
import { PredictionData } from '../components/matches/PredictionForm';

type Tab = 'all' | 'upcoming' | 'live' | 'completed';

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const { matches, loading, error, refetch } = useMatches(activeTab);
  const { predictions, saving, savePrediction } = usePredictions(matches.map(m => m.id));
  const { groups, activeGroupId, loading: groupsLoading, setActiveGroup } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  const { syncing } = useMatchSync(activeLeagues, matches.length, refetch);
  const predictorsByMatch = useGroupMatchPredictions(matches.map(m => m.id), activeGroupId);
  const { openModal, addToast } = useUIStore();
  const { t } = useLangStore();

  const TABS = [
    { id: 'all' as Tab, label: t('all') },
    { id: 'upcoming' as Tab, label: t('upcoming') },
    { id: 'live' as Tab, label: t('live') },
    { id: 'completed' as Tab, label: t('results') },
  ];

  const handleSavePrediction = async (data: PredictionData) => {
    try {
      await savePrediction(data);
      addToast(t('predictionSavedToast'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('failedLoadMatches'), 'error');
    }
  };

  // Groups are still being fetched — show a spinner, not the welcome screen
  if (groupsLoading) return <PageLoader />;

  // Groups fully loaded and user has none
  if (!activeGroupId || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">👋</div>
        <h2 className="font-bebas text-3xl tracking-wider text-white mb-2">{t('noGroupTitle')}</h2>
        <p className="text-text-muted text-sm mb-8 max-w-xs">{t('noGroupDesc')}</p>
        <div className="flex gap-3">
          <NeonButton variant="green" onClick={() => openModal('createGroup')}>
            {t('createGroup')}
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => openModal('joinGroup')}>
            {t('joinGroup')}
          </NeonButton>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="text-red-400 text-sm mb-4">{t('failedLoadMatches')}</p>
        <NeonButton variant="ghost" size="sm" onClick={() => window.location.reload()}>
          {t('retry')}
        </NeonButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bebas text-2xl tracking-wider text-white">{t('matchDay')}</h1>
          <div className="flex items-center gap-2">
            {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
            {syncing && (
              <span className="text-accent-green text-xs animate-pulse">⟳ syncing...</span>
            )}
          </div>
        </div>
        <motion.button
          onClick={() => setShowScoringGuide(true)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-green/10 border border-accent-green/25 text-accent-green text-xs font-semibold hover:bg-accent-green/20 hover:border-accent-green/50 hover:shadow-[0_0_16px_rgba(0,255,135,0.25)] transition-colors duration-200"
          title="How scoring works"
        >
          <span className="text-sm leading-none">🏆</span>
          <span className="hidden sm:inline tracking-wide">Scoring</span>
          {/* Pulsing indicator dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green">
            <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-75" />
          </span>
        </motion.button>
        {groups.length > 1 && (
          <select
            value={activeGroupId ?? ''}
            onChange={e => setActiveGroup(e.target.value)}
            className="hidden sm:block text-sm bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-accent-green"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id} className="bg-bg-base">{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150',
              activeTab === tab.id
                ? 'bg-accent-green text-bg-base shadow-glow-green-sm'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Match feed */}
      <MatchFeed
        matches={matches}
        predictions={predictions}
        predictorsByMatch={predictorsByMatch}
        loading={loading}
        savingMatchId={saving}
        onSavePrediction={handleSavePrediction}
        activeTab={activeTab}
      />

      <AnimatePresence>
        {showScoringGuide && <ScoringGuide onClose={() => setShowScoringGuide(false)} />}
      </AnimatePresence>
    </div>
  );
}
