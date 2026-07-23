import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { useGroupMatchPredictions } from '../hooks/useGroupMatchPredictions';
import { useGroupStore } from '../stores/groupStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import { MatchFeed } from '../components/matches/MatchFeed';
import { HeroMatchCard } from '../components/matches/HeroMatchCard';
import { PredictionModal } from '../components/matches/PredictionModal';
import { LiveDuelDrawer } from '../components/groups/LiveDuelDrawer';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { NeonButton } from '../components/ui/NeonButton';
import { ScoringGuide } from '../components/ui/ScoringGuide';
import { CoinGuide } from '../components/ui/CoinGuide';
import { CoinIcon } from '../components/ui/CoinIcon';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';
import { useNeverPredicted } from '../hooks/useIsNewUser';
import type { PredictionData } from '../components/matches/PredictionForm';

type Tab = 'all' | 'upcoming' | 'live' | 'completed';

export function HomePage() {
  const [searchParams] = useSearchParams();
  // V4 Sprint 23 — notification "View Match" deep link (?focus=<match_id>).
  // Captured once via a lazy initializer, NOT re-derived from `searchParams`
  // on every render: `matches` loads asynchronously, and the MatchCard that
  // needs this id to fire its own autoFocus effect may not mount until
  // several renders after this one. If the param were live-read instead,
  // clearing it from the URL (or any unrelated searchParams change) before
  // that later render would silently drop the value the deferred mount
  // still needs. A prediction_result notification only ever fires after a
  // match resolves (is_resolved=true → in practice FT), so the target card
  // only exists in the 'completed' tab's filtered set, never 'all' (which
  // deliberately excludes finished matches).
  const [focusMatchId] = useState(() => searchParams.get('focus'));
  // V7 Sprint 56 — the Knockout Path bracket view (StatsPage) can deep-link
  // into a match that's still upcoming or live, not just resolved (unlike
  // the notification "View Match" CTA above, which only ever targets an
  // already-FT match). An optional `?tab=` override lets that caller pick
  // the correct tab explicitly instead of falling into the 'completed'
  // default, which would show "no matches found" for anything not yet FT.
  // Validated against the real Tab union — an unrecognized/missing value
  // falls through to the existing focus-vs-no-focus default untouched.
  const [initialTabOverride] = useState<Tab | null>(() => {
    const raw = searchParams.get('tab');
    return raw === 'all' || raw === 'upcoming' || raw === 'live' || raw === 'completed' ? raw : null;
  });
  const [activeTab, setActiveTab] = useState<Tab>(initialTabOverride ?? (focusMatchId ? 'completed' : 'all'));
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [showCoinGuide, setShowCoinGuide] = useState(false);
  const { matches, loading, loadingMore, error, loadMore, upcomingDays, hasMore } = useMatches(activeTab);
  const { predictions, saving, savePrediction } = usePredictions(matches.map(m => m.id));
  // Progressive disclosure: lock advanced tiers only for a genuine first-timer.
  // Combine the authoritative leaderboard signal with the in-session predictions
  // Map so tiers unlock the instant the very first pick is placed (optimistic).
  const neverPredicted = useNeverPredicted();
  const isNewUser = neverPredicted && predictions.size === 0;
  const { groups, activeGroupId, loading: groupsLoading, setActiveGroup } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const predictorsByMatch = useGroupMatchPredictions(matches.map(m => m.id), activeGroupId);
  const { openModal, addToast, activeDuelMatchId, closeDuelDrawer } = useUIStore();
  // V6 Sprint 47 Commit 3 — same "render once at the page level, driven
  // by a global store id" pattern as PredictionModal above, not nested
  // per-MatchCard-instance — see uiStore.ts's own comment for why.
  const duelMatch = matches.find(m => m.id === activeDuelMatchId);
  const { t } = useLangStore();

  const now = Date.now();
  const liveCount = matches.filter(m =>
    ['1H', 'HT', '2H'].includes(m.status) ||
    (m.status === 'NS' && new Date(m.kickoff_time).getTime() < now)
  ).length;

  // V6 Sprint 50 — Hero Matchday Spotlight selection. Highest priority is
  // any live match the user has already predicted (the moment they'd most
  // want front-and-center); falls back to the single earliest upcoming NS
  // fixture within the next 2 hours; renders nothing if neither exists —
  // never fabricate a "featured" match from an arbitrary finished game,
  // matching this app's established "hidden until real data exists"
  // convention. Only shown on the 'all' tab; the featured match still
  // appears in the normal list below it too (the expected pattern for a
  // spotlight, not a duplicate to suppress).
  const heroMatch = (() => {
    const liveWithPrediction = matches.find(m =>
      ['1H', 'HT', '2H'].includes(m.status) && predictions.has(m.id)
    );
    if (liveWithPrediction) return liveWithPrediction;
    const anyLive = matches.find(m => ['1H', 'HT', '2H'].includes(m.status));
    if (anyLive) return anyLive;
    const upcoming = matches
      .filter(m => m.status === 'NS' && new Date(m.kickoff_time).getTime() > now)
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())[0];
    if (upcoming && new Date(upcoming.kickoff_time).getTime() - now < 2 * 60 * 60 * 1000) return upcoming;
    return null;
  })();

  const TABS = [
    { id: 'all' as Tab, label: t('all'), badge: null },
    { id: 'upcoming' as Tab, label: t('upcoming'), badge: null },
    { id: 'live' as Tab, label: t('live'), badge: liveCount > 0 ? liveCount : null },
    { id: 'completed' as Tab, label: t('results'), badge: null },
  ];

  const handleSavePrediction = async (data: PredictionData) => {
    try {
      await savePrediction(data);
      haptic('success');
      // V6 Sprint 50 — the confetti burst moved to PredictionForm.tsx's own
      // handleSubmit, anchored to the real submit button via celebrateAt()
      // instead of this fixed screen-edge celebratePrediction() call —
      // removed here so the same save doesn't fire two overlapping bursts.
      addToast(t('predictionSavedToast'), 'success');
    } catch (err) {
      haptic('error');
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
          <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-white">{t('matchDay')}</h1>
          <div className="flex items-center gap-2">
            {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
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

      {/* V6 Sprint 50 — Hero Matchday Spotlight. Only on the 'all' tab —
          'live'/'upcoming'/'completed' are already filtered views where a
          duplicate hero above the list would be redundant, not additive. */}
      {activeTab === 'all' && heroMatch && (
        <HeroMatchCard match={heroMatch} prediction={predictions.get(heroMatch.id)} />
      )}

      {/* Tabs — segmented snapper. Horizontally scroll-snappable (min-w guard
          keeps pills readable if 4 no longer fit; on any normal viewport
          today they still evenly fill via flex-1, identical to before) with
          a single layoutId-tagged highlight that morphs between whichever
          pill is active instead of each pill owning its own background —
          the standard Framer Motion "sliding tab indicator" shared-layout
          recipe, same LayoutGroup pattern Sprint 16 proved out for the H2H
          panel morph. */}
      <div className="match-tabs-sticky sticky top-[56px] sm:top-0 z-20 -mx-4 px-4 pt-2 pb-3">
        <LayoutGroup id="home-tabs">
          <div
            className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
            data-lenis-prevent
          >
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => { haptic('light'); setActiveTab(tab.id); }}
                  whileTap={{ scale: 0.95, rotate: -0.5, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
                  className={cn(
                    'relative flex-1 min-w-[76px] shrink-0 snap-center py-1.5 text-[13px] font-semibold rounded-full transition-colors duration-200',
                    active
                      ? 'text-bg-base'
                      : 'text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeTabPill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded-full bg-accent-green shadow-[0_0_12px_rgba(0,255,135,0.35)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  {tab.badge && (
                    <span className={cn(
                      'absolute -top-1 -end-0.5 z-10 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                      active ? 'bg-bg-base text-accent-green' : 'bg-accent-green text-bg-base'
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>

      {/* Match feed */}
      <MatchFeed
        matches={matches}
        predictions={predictions}
        predictorsByMatch={predictorsByMatch}
        loading={loading}
        activeTab={activeTab}
        focusMatchId={focusMatchId}
      />

      {/* Load More Fixtures — only shown on upcoming-facing tabs, not results */}
      {!loading && activeTab !== 'completed' && activeTab !== 'live' && matches.length > 0 && (
        <div className="flex flex-col items-center gap-2 pb-6">
          {hasMore ? (
            <motion.button
              onClick={loadMore}
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
              <span>{loadingMore ? t('loadingMore') : t('loadMore')}</span>
              {!loadingMore && <span className="text-white/30 text-xs">+14 {t('daysShort')}</span>}
            </motion.button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/5 text-text-muted/70 text-xs">
              <span className="text-accent-green">✓</span>
              <span>{t('noMoreFixtures')}</span>
            </div>
          )}
          <p className="text-white/20 text-[11px]">
            {t('showingUpToDays').replace('{0}', String(upcomingDays))}
          </p>
        </div>
      )}

      <AnimatePresence>
        {showScoringGuide && <ScoringGuide onClose={() => setShowScoringGuide(false)} />}
        {showCoinGuide && <CoinGuide onClose={() => setShowCoinGuide(false)} />}
      </AnimatePresence>

      <PredictionModal
        matches={matches}
        predictions={predictions}
        onSave={handleSavePrediction}
        savingMatchId={saving}
        isNewUser={isNewUser}
      />

      <AnimatePresence>
        {duelMatch && (
          <LiveDuelDrawer
            matchId={duelMatch.id}
            homeTeam={duelMatch.home_team}
            awayTeam={duelMatch.away_team}
            onClose={closeDuelDrawer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
