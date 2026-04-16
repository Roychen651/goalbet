import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swords, Trophy, BarChart3, MessageCircle, User, Settings } from 'lucide-react';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useGroupStore } from '../../stores/groupStore';
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { LangToggle } from '../ui/LangToggle';
import { PolicyModal } from '../ui/PolicyModal';
import { CoinIcon } from '../ui/CoinIcon';
import { NotificationBell, NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { useUIStore } from '../../stores/uiStore';

export function Sidebar() {
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const coins = useCoinsStore(s => s.coins);
  const { openModal } = useUIStore();
  const [showPolicy, setShowPolicy] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const { unreadCount, notifications, loading, markAllRead, markRead } = useNotifications();
  const activeGroup = groups.find(g => g.id === activeGroupId);

  const NAV_ITEMS = [
    { to: ROUTES.HOME, Icon: Swords, label: t('matches') },
    { to: ROUTES.LEADERBOARD, Icon: Trophy, label: t('leaderboard') },
    { to: ROUTES.STATS, Icon: BarChart3, label: t('statsHub') },
    { to: ROUTES.LOCKER_ROOM, Icon: MessageCircle, label: t('lockerRoom') },
    { to: ROUTES.PROFILE, Icon: User, label: t('myProfile') },
    { to: ROUTES.SETTINGS, Icon: Settings, label: t('settings') },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-60 shrink-0 h-screen sticky top-0 z-30 border-e border-white/8 py-6 px-4 glass">
      {/* Logo */}
      <div className="mb-8 px-2">
        <motion.div
          className="font-barlow font-extrabold text-4xl tracking-wide uppercase cursor-default"
          whileHover={{ scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <span className="text-white">Goal</span>
          <span className="text-accent-green drop-shadow-[0_0_12px_rgba(232,160,32,0.4)]">
            Bet
          </span>
        </motion.div>
        {activeGroup && (
          <div className="text-text-muted text-xs mt-1 truncate">{activeGroup.name}</div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === ROUTES.HOME}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]',
              isActive
                ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className="shrink-0" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Notification bell */}
      <div className="relative mx-2 mb-2">
        <button
          onClick={() => setShowNotif(p => !p)}
          // data-notif-bell tells NotificationCenter's outside-click handler
          // to ignore taps on this button so it doesn't close-then-reopen.
          data-notif-bell
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-text-muted hover:bg-white/5 hover:text-white',
          )}
          aria-label="Open notifications"
        >
          <span className="relative text-base">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-accent-green
                               shadow-[0_0_6px_rgba(0,255,135,0.7)] animate-pulse" />
            )}
          </span>
          <span>{t('notifications')}</span>
          {unreadCount > 0 && (
            <span className="ms-auto text-[10px] font-bold bg-accent-green text-bg-base rounded-full px-1.5 py-0.5 leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <NotificationCenter
          open={showNotif}
          onClose={() => setShowNotif(false)}
          placement="right"
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          markAllRead={markAllRead}
          markRead={markRead}
        />
      </div>

      {/* Coin balance */}
      <div className="mx-2 mb-3">
        <button
          onClick={() => openModal('coinHistory')}
          className="w-full px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 hover:bg-amber-500/15 hover:border-amber-500/35 active:scale-[0.98] transition-all text-start cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <CoinIcon size={22} />
            <div>
              <div className="text-amber-400 font-bold text-base tabular-nums leading-none">{coins}</div>
              <div className="text-amber-500/50 text-[10px] mt-0.5 uppercase tracking-widest">{t('coinsLabel2')}</div>
            </div>
          </div>
        </button>
      </div>

      {/* Language toggle + version */}
      <div className="flex flex-col gap-3 px-2">
        <LangToggle />
        <div className="text-text-muted text-xs opacity-50 leading-relaxed">
          GoalBet v2.0<br/>
          <span className="opacity-70">© Roy Chen 2026</span>
        </div>
        <button
          onClick={() => setShowPolicy(true)}
          className="text-text-muted text-[11px] opacity-40 hover:opacity-70 transition-opacity text-start"
        >
          {t('policyTerms')}
        </button>
      </div>
      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </aside>
  );
}
