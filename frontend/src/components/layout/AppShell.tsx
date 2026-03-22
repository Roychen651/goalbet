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

  // Fire-and-forget background sync ping — wakes the Render backend and triggers
  // a score update so stale match data clears quickly after page load or tab focus.
  const lastSyncRef = useRef(0);
  const pingSync = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncRef.current < 60_000) return; // at most once per minute
    lastSyncRef.current = now;
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;
    fetch(`${url}/api/sync/scores`, { method: 'POST' }).catch(() => {/* silent */});
  }, []);

  useEffect(() => {
    // Ping on mount (delayed slightly so UI renders first)
    const timer = setTimeout(pingSync, 3_000);
    // Also ping when tab comes back to foreground
    const onVisible = () => { if (!document.hidden) pingSync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
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
