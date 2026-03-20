import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { LangToggle } from '../ui/LangToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { cn } from '../../lib/utils';

export function TopBar() {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const { groups, activeGroupId, setActiveGroup } = useGroupStore();
  const { openModal } = useUIStore();
  const { profile } = useAuthStore();
  const { t } = useLangStore();
  const coins = useCoinsStore(s => s.coins);
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white w-full max-w-[160px] mx-auto"
          >
            <span className="flex-1 truncate text-start">{activeGroup?.name ?? t('noGroupYet').slice(0, 10)}</span>
            <span className="text-text-muted shrink-0">▾</span>
          </button>

          {showGroupMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowGroupMenu(false)} />
              <div className="absolute top-full mt-2 start-0 w-52 glass rounded-xl border border-white/10 shadow-card overflow-hidden z-50">
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
                <div className="border-t border-white/8">
                  <button onClick={() => { openModal('createGroup'); setShowGroupMenu(false); }} className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/5 transition-colors">{t('newGroup')}</button>
                  <button onClick={() => { openModal('joinGroup'); setShowGroupMenu(false); }} className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/5 transition-colors">{t('joinGroupShort')}</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right side: coins + lang + theme + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Coin balance pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-sm leading-none">🪙</span>
            <span className="text-amber-400 text-xs font-bold tabular-nums">{coins}</span>
          </div>
          <LangToggle />
          <ThemeToggle inline />
          {profile && <Avatar src={profile.avatar_url} name={profile.username} size="sm" />}
        </div>
      </div>
    </header>
  );
}
