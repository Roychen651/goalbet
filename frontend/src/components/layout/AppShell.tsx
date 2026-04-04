import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Outlet } from 'react-router-dom';
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
  //               POST /api/sync/scores   (30 s timeout — resolves in-progress predictions)
  //   • At 20 s:  POST /api/sync/scores   (backend is awake by now → fast)
  //   • Every 45 s: POST /api/sync/scores (live-score polling)
  //   • Tab restore after >5 min: force score sync
  //
  // Each successful response dispatches 'goalbet:synced' → useMatches refetches.
  // All fetches are AbortController-gated so no spinner ever hangs indefinitely.
  // ────────────────────────────────────────────────────────────────────────────

  const lastSyncRef = useRef(0);
  const lastHiddenRef = useRef(0);
  const POLL_THROTTLE_MS = 40_000;

  const pingScores = useCallback((force = false) => {
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current < POLL_THROTTLE_MS) return;
    lastSyncRef.current = now;
    postWithTimeout(`${url}/api/sync/scores`, 30_000).then(dispatch).catch(() => {});
  }, []);

  useEffect(() => {
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;

    // 1. Full fixture sync on every mount (handles cold starts + stale fixtures)
    //    90 s timeout: Render cold start (~45 s) + ESPN calls for N leagues (~30 s)
    const matchCtrl = new AbortController();
    const matchTimeout = setTimeout(() => matchCtrl.abort(), 90_000);
    postWithTimeout(`${url}/api/sync/matches`, 90_000)
      .then(dispatch)
      .catch(() => {})
      .finally(() => clearTimeout(matchTimeout));

    // 2. Immediate score update (resolves any overnight/weekend predictions)
    pingScores(true);

    // 3. Score retry at 20 s — backend is awake by now after the match sync woke it
    const retryTimer = setTimeout(() => pingScores(true), 20_000);

    // 4. Live-score poll every 45 s
    const pollInterval = setInterval(() => pingScores(), 45_000);

    // 5. Tab restore: force sync if hidden >5 min
    const onVisible = () => {
      if (document.hidden) {
        lastHiddenRef.current = Date.now();
      } else {
        const hiddenMs = Date.now() - lastHiddenRef.current;
        pingScores(hiddenMs > 5 * 60_000);
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
          <Outlet />
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
