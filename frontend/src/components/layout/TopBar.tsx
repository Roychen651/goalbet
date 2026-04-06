import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, HelpCircle, ChevronDown } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { useThemeStore } from '../../stores/themeStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { CoinIcon } from '../ui/CoinIcon';
import { cn } from '../../lib/utils';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

export function TopBar() {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showNotif, setShowNotif]         = useState(false);

  const { groups, activeGroupId, setActiveGroup } = useGroupStore();
  const { openModal }                             = useUIStore();
  const { profile }                               = useAuthStore();
  const { t, lang, setLang }                      = useLangStore();
  const { theme, toggle: toggleTheme }            = useThemeStore();
  const coins                                     = useCoinsStore(s => s.coins);
  const { unreadCount, notifications, loading, markAllRead, markRead } = useNotifications();
  const activeGroup = groups.find(g => g.id === activeGroupId);

  return (
    <header className="sticky top-0 z-30 sm:hidden">
      <div className="glass border-b border-white/8 px-4 pt-3 pb-2.5 space-y-2">

        {/* ── Row 1 · Logo — Status cluster ── */}
        <div className="flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="font-barlow font-extrabold text-[22px] uppercase text-white shrink-0 leading-none tracking-wide">
            Goal<span className="text-accent-green drop-shadow-[0_0_10px_rgba(232,160,32,0.5)]">Bet</span>
          </div>

          {/* ── Status pill: Coins · Bell · Avatar ── */}
          <div className="flex items-stretch h-9 rounded-full bg-white/8 border border-white/12 overflow-hidden shrink-0">

            {/* Coins */}
            <div className="flex items-center gap-1.5 px-3 border-e border-white/10">
              <CoinIcon size={13} />
              <span className="text-amber-400 text-[11px] font-bold tabular-nums leading-none">
                {coins}
              </span>
            </div>

            {/* Bell */}
            <button
              onClick={() => setShowNotif(p => !p)}
              className="relative flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10"
              aria-label="Notifications"
            >
              <Bell
                size={15}
                strokeWidth={unreadCount > 0 ? 2.5 : 1.8}
                className={unreadCount > 0 ? 'text-white' : 'text-text-muted'}
              />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-accent-green shadow-[0_0_6px_rgba(232,160,32,0.8)]"
                />
              )}
            </button>

            {/* Avatar */}
            {profile && (
              <div className="flex items-center justify-center w-9">
                <Avatar src={profile.avatar_url} name={profile.username} size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2 · Group selector — Utility cluster ── */}
        <div className="flex items-center gap-2">

          {/* Group selector */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setShowGroupMenu(p => !p)}
              className="flex items-center gap-2 h-9 w-full px-3 rounded-xl bg-white/6 border border-white/10 active:bg-white/10 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
              <span className="flex-1 truncate text-start text-[11px] font-semibold text-white/85 min-w-0 leading-none">
                {activeGroup?.name ?? '—'}
              </span>
              <motion.div
                animate={{ rotate: showGroupMenu ? 180 : 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' as const }}
                className="shrink-0"
              >
                <ChevronDown size={13} className="text-text-muted" />
              </motion.div>
            </button>

            {showGroupMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowGroupMenu(false)} />
                <div
                  className="absolute top-full mt-2 start-0 w-52 rounded-xl border border-white/15 overflow-hidden z-50 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                  style={{ background: 'var(--color-tooltip-bg)' }}
                >
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => { setActiveGroup(group.id); setShowGroupMenu(false); }}
                      className={cn(
                        'w-full text-start px-4 py-3 text-sm transition-colors',
                        group.id === activeGroupId
                          ? 'text-accent-green bg-accent-green/10'
                          : 'text-white hover:bg-white/5'
                      )}
                    >
                      {group.name}
                    </button>
                  ))}
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => { openModal('createGroup'); setShowGroupMenu(false); }}
                      className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/8 transition-colors"
                    >
                      {t('newGroup')}
                    </button>
                    <button
                      onClick={() => { openModal('joinGroup'); setShowGroupMenu(false); }}
                      className="w-full text-start px-4 py-3 text-sm text-text-muted hover:text-white hover:bg-white/8 transition-colors"
                    >
                      {t('joinGroupShort')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Utility cluster: Help · Lang · Theme ── */}
          <div className="flex items-stretch h-9 rounded-xl bg-white/6 border border-white/10 overflow-hidden shrink-0">
            <button
              onClick={() => openModal('helpGuide')}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10"
              aria-label="Help"
            >
              <HelpCircle size={14} className="text-text-muted" />
            </button>
            <button
              onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10 text-[15px] leading-none"
              title={lang === 'en' ? 'Switch to Hebrew' : 'Switch to English'}
            >
              {lang === 'en' ? '🇮🇱' : '🇬🇧'}
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors text-[15px] leading-none"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
          </div>

        </div>

        {/* Notification panel anchors here */}
        <NotificationCenter
          open={showNotif}
          onClose={() => setShowNotif(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          markAllRead={markAllRead}
          markRead={markRead}
        />

      </div>
    </header>
  );
}
