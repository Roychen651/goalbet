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

export function AppShell() {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { lang } = useLangStore();
  const { hasNew, newPoints, markAsSeen } = useNewPointsAlert();
  const prevHasNew = useRef(false);

  // Keep document direction in sync
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Background sync: wakes the Render backend and triggers a score update.
  // - Fires immediately on mount
  // - Retries at 20s (catches Render cold-start: first request wakes the server,
  //   second runs the actual sync while awake)
  // - Polls every 45s to keep live match scores fresh during active sessions
  // - On tab visibility restore after >5 min absence, bypasses throttle immediately
  // Dispatches 'goalbet:synced' after each successful response so data hooks refetch.
  const lastSyncRef = useRef(0);
  const lastHiddenRef = useRef(0);
  const SYNC_THROTTLE_MS = 40_000;

  const pingSync = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastSyncRef.current < SYNC_THROTTLE_MS) return;
    lastSyncRef.current = now;
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;
    fetch(`${url}/api/sync/scores`, { method: 'POST' })
      .then(() => window.dispatchEvent(new Event('goalbet:synced')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    pingSync(true);
    // Retry at 20s: Render cold-start takes ~15s
    const retryTimer = setTimeout(() => pingSync(true), 20_000);
    // Poll every 45s to keep live scores current during active viewing
    const pollInterval = setInterval(() => pingSync(), 45_000);

    const onVisible = () => {
      if (document.hidden) {
        lastHiddenRef.current = Date.now();
      } else {
        // If tab was hidden for more than 5 minutes, force an immediate sync
        const hiddenMs = Date.now() - lastHiddenRef.current;
        pingSync(hiddenMs > 5 * 60_000);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(retryTimer);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pingSync]);

  // Points notification toast
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
