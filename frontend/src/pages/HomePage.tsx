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
import { CoinGuide } from '../components/ui/CoinGuide';
import { CoinIcon } from '../components/ui/CoinIcon';
import { cn } from '../lib/utils';
import { PredictionData } from '../components/matches/PredictionForm';

type Tab = 'all' | 'upcoming' | 'live' | 'completed';

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [showCoinGuide, setShowCoinGuide] = useState(false);
  const { matches, loading, loadingMore, error, refetch, loadMore, upcomingDays } = useMatches(activeTab);
  const { predictions, saving, savePrediction } = usePredictions(matches.map(m => m.id));
  const { groups, activeGroupId, loading: groupsLoading, setActiveGroup } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  const { syncing, triggerSync } = useMatchSync(activeLeagues, matches.length, refetch);
  const predictorsByMatch = useGroupMatchPredictions(matches.map(m => m.id), activeGroupId);
  const { openModal, addToast } = useUIStore();
  const { t } = useLangStore();

  const now = Date.now();
  const liveCount = matches.filter(m =>
    ['1H', 'HT', '2H'].includes(m.status) ||
    (m.status === 'NS' && new Date(m.kickoff_time).getTime() < now)
  ).length;

  const TABS = [
    { id: 'all' as Tab, label: t('all'), badge: null },
    { id: 'upcoming' as Tab, label: t('upcoming'), badge: null },
    { id: 'live' as Tab, label: t('live'), badge: liveCount > 0 ? liveCount : null },
    { id: 'completed' as Tab, label: t('results'), badge: null },
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
          className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-green/10 border-2 border-accent-green/40 text-accent-green text-xs font-semibold hover:bg-accent-green/20 hover:border-accent-green/70 hover:shadow-[0_0_16px_rgba(0,255,135,0.25)] transition-colors duration-200"
          title="How scoring works"
        >
          <span className="text-sm leading-none">🏆</span>
          <span className="hidden sm:inline tracking-wide">{t('scoringBtn')}</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green">
            <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-75" />
          </span>
        </motion.button>

        {/* Coin Guide button */}
        <motion.button
          onClick={() => setShowCoinGuide(true)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/50 text-amber-600 text-xs font-semibold hover:bg-amber-500/20 hover:border-amber-500/80 hover:shadow-[0_0_16px_rgba(245,197,24,0.25)] transition-colors duration-200"
          title="How coins work"
        >
          <CoinIcon size={14} />
          <span className="hidden sm:inline tracking-wide">{t('coinsBtn')}</span>
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

      {/* Tabs — sticky, borderless pill design that works in both light and dark */}
      <div className="match-tabs-sticky sticky top-[56px] sm:top-0 z-20 -mx-4 px-4 pt-2 pb-3">
        <div className="flex gap-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex-1 py-1.5 text-[13px] font-semibold rounded-full transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-accent-green text-bg-base shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                  : 'text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10'
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className={cn(
                  'absolute -top-1 -end-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                  activeTab === tab.id ? 'bg-bg-base text-accent-green' : 'bg-accent-green text-bg-base'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
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

      {/* Load More Fixtures — only shown on upcoming-facing tabs, not results */}
      {!loading && activeTab !== 'completed' && activeTab !== 'live' && (
        <div className="flex flex-col items-center gap-2 pb-6">
          <motion.button
            onClick={async () => {
              const y = window.scrollY;
              await loadMore();
              requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
              triggerSync();
            }}
            disabled={loadingMore}
            whileHover={{ scale: loadingMore ? 1 : 1.03 }}
            whileTap={{ scale: loadingMore ? 1 : 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-text-muted text-sm hover:bg-white/10 hover:border-white/20 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="animate-spin text-accent-green">⟳</span>
            ) : (
              <span>⬇</span>
            )}
            <span>{loadingMore ? 'Loading...' : 'Load more fixtures'}</span>
            {!loadingMore && <span className="text-white/30 text-xs">+14 days</span>}
          </motion.button>
          <p className="text-white/20 text-xs">Showing up to {upcomingDays} days ahead</p>
        </div>
      )}

      <AnimatePresence>
        {showScoringGuide && <ScoringGuide onClose={() => setShowScoringGuide(false)} />}
        {showCoinGuide && <CoinGuide onClose={() => setShowCoinGuide(false)} />}
      </AnimatePresence>
    </div>
  );
}
