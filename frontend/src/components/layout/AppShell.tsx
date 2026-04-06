import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '../ui/Toast';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CreateGroupModal } from '../groups/CreateGroupModal';
import { JoinGroupModal } from '../groups/JoinGroupModal';
import { HelpGuideModal } from '../ui/HelpGuideModal';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { useNewPointsAlert } from '../../hooks/useNewPointsAlert';
import { WelcomeAnimation } from '../ui/WelcomeAnimation';

// ─── Sync helpers ─────────────────────────────────────────────────────────────

function postWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { method: 'POST', signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const dispatch = () => window.dispatchEvent(new Event('goalbet:synced'));

// ─── Component ────────────────────────────────────────────────────────────────

export function AppShell() {
  const location = useLocation();
  const { activeModal, closeModal, addToast } = useUIStore();
  const { lang } = useLangStore();
  const { hasNew, newPoints } = useNewPointsAlert();
  const prevHasNew = useRef(false);

  // Keep document direction in sync
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // ─── Background sync ────────────────────────────────────────────────────────
  // Single, authoritative sync system:
  //
  //   • On mount: POST /api/sync/matches  (90 s timeout — handles cold start + ESPN calls)
  //               POST /api/sync/scores   (75 s timeout — resolves in-progress predictions)
  //   • At 25 s:  POST /api/sync/scores   (backend is warm by now → fast)
  //   • Every 30 s: POST /api/sync/scores (live-score polling)
  //   • Tab restore after >90 s: force score sync
  //
  // Each successful response dispatches 'goalbet:synced' → useMatches.backgroundFetch().
  // backgroundFetch() never sets loading=true — PredictionForm state is never destroyed.
  // All fetches are AbortController-gated so no spinner ever hangs indefinitely.
  // ────────────────────────────────────────────────────────────────────────────

  const lastSyncRef = useRef(0);
  const lastHiddenRef = useRef(0);
  const POLL_THROTTLE_MS = 30_000;

  // Score sync with a 75s timeout so it survives Render's cold start (45-60s).
  // The initial call on mount will likely time out while Render wakes, but the
  // 25s retry runs once the backend is warm and resolves in seconds.
  const pingScores = useCallback((force = false) => {
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current < POLL_THROTTLE_MS) return;
    lastSyncRef.current = now;
    postWithTimeout(`${url}/api/sync/scores`, 75_000).then(dispatch).catch(() => {});
  }, []);

  useEffect(() => {
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;

    // 1. Full fixture sync on every mount (wakes Render + pulls fresh fixtures)
    //    90s timeout: cold start (~45s) + ESPN calls for N leagues (~30s)
    const matchCtrl = new AbortController();
    const matchTimeout = setTimeout(() => matchCtrl.abort(), 90_000);
    postWithTimeout(`${url}/api/sync/matches`, 90_000)
      .then(dispatch)
      .catch(() => {})
      .finally(() => clearTimeout(matchTimeout));

    // 2. Immediate score sync — might time out on first cold start, that's OK.
    //    With the 75s timeout it will likely succeed even on cold start.
    pingScores(true);

    // 3. Score retry at 25 s — backend is definitely warm by now
    const retryTimer = setTimeout(() => pingScores(true), 25_000);

    // 4. Live-score poll every 30 s (tighter interval for live match responsiveness)
    const pollInterval = setInterval(() => pingScores(), 30_000);

    // 5. Tab restore: force sync whenever hidden >90s (not 5 min — live games need fast updates)
    const onVisible = () => {
      if (document.hidden) {
        lastHiddenRef.current = Date.now();
      } else {
        const hiddenMs = Date.now() - lastHiddenRef.current;
        pingScores(hiddenMs > 90_000); // force after just 90 seconds away
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      matchCtrl.abort();
      clearTimeout(matchTimeout);
      clearTimeout(retryTimer);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pingScores]);

  // ─── Points toast ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasNew && !prevHasNew.current && newPoints > 0) {
      addToast(`🎉 You earned +${newPoints} pts!`, 'success');
    }
    prevHasNew.current = hasNew;
  }, [hasNew, newPoints, addToast]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-4 py-4 pb-24 sm:pb-6 sm:px-6 sm:py-6 max-w-2xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
      <ThemeToggle />
      <ToastContainer />
      {activeModal === 'createGroup' && <CreateGroupModal onClose={closeModal} />}
      {activeModal === 'joinGroup' && <JoinGroupModal onClose={closeModal} />}
      <AnimatePresence>
        {activeModal === 'helpGuide' && <HelpGuideModal onClose={closeModal} />}
      </AnimatePresence>
      <WelcomeAnimation />
    </div>
  );
}
