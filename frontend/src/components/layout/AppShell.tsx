import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '../ui/Toast';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CreateGroupModal } from '../groups/CreateGroupModal';
import { JoinGroupModal } from '../groups/JoinGroupModal';
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
      <WelcomeAnimation />
    </div>
  );
}
