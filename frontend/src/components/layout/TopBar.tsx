import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { LangToggle } from '../ui/LangToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { CoinIcon } from '../ui/CoinIcon';
import { cn } from '../../lib/utils';
import { NotificationBell, NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

export function TopBar() {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const { groups, activeGroupId, setActiveGroup } = useGroupStore();
  const { openModal } = useUIStore();
  const { profile } = useAuthStore();
  const { t } = useLangStore();
  const coins = useCoinsStore(s => s.coins);
  const { unreadCount } = useNotifications();
  const activeGroup = groups.find(g => g.id === activeGroupId);

  return (
    <header className="sticky top-0 z-30 sm:hidden">
      <div className="glass border-b border-white/8 px-4 py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="font-bebas text-2xl tracking-widest text-white shrink-0">
          Goal<span className="text-accent-green">Bet</span>
        </div>

        {/* Group selector */}
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setShowGroupMenu(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/12 border border-white/20 text-sm font-medium text-white w-full"
          >
            <span className="flex-1 truncate text-start min-w-0">{activeGroup?.name ?? '—'}</span>
            <span className="text-text-muted shrink-0 text-xs">▾</span>
          </button>

          {showGroupMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowGroupMenu(false)} />
              <div className="absolute top-full mt-2 start-0 w-52 rounded-xl border border-white/15 overflow-hidden z-50 shadow-[0_8px_32px_rgba(0,0,0,0.6)]" style={{ background: 'var(--color-tooltip-bg)' }}>
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setActiveGroup(group.id); setShowGroupMenu(false); }}
                    className={cn(
                      'w-full text-start px-4 py-3 text-sm transition-colors',
                      group.id === activeGroupId ? 'text-accent-green bg-accent-green/10' : 'text-white hover:bg-white/5'
                    )}
                  >
                    {group.name}
                  </button>
                ))}
                <div className="border-t border-white/10">
                  <button onClick={() => { openModal('createGroup'); setShowGroupMenu(false); }} className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/8 transition-colors">{t('newGroup')}</button>
                  <button onClick={() => { openModal('joinGroup'); setShowGroupMenu(false); }} className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/8 transition-colors">{t('joinGroupShort')}</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right side: help + bell + coins + lang + theme + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Help button */}
          <button
            onClick={() => openModal('helpGuide')}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/8 transition-all"
            aria-label="User Guide"
          >
            <HelpCircle size={17} />
          </button>

          {/* Notification bell */}
          <div className="relative">
            <NotificationBell
              unreadCount={unreadCount}
              onClick={() => setShowNotif(prev => !prev)}
            />
            <NotificationCenter
              open={showNotif}
              onClose={() => setShowNotif(false)}
            />
          </div>

          {/* Coin balance pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <CoinIcon size={16} />
            <span className="text-amber-400 text-xs font-bold tabular-nums">{coins}</span>
          </div>
          <LangToggle compact />
          <ThemeToggle inline />
          {profile && <Avatar src={profile.avatar_url} name={profile.username} size="sm" />}
        </div>
      </div>
    </header>
  );
}
