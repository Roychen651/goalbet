import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, HelpCircle, ChevronDown, Moon, Sun, Sparkles } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { useThemeStore } from '../../stores/themeStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { CoinIcon } from '../ui/CoinIcon';
import NumberFlow from '@number-flow/react';
import { cn } from '../../lib/utils';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { useCoinRollFeedback } from '../../hooks/useCoinRollFeedback';

export function TopBar() {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showNotif, setShowNotif]         = useState(false);

  const { groups, activeGroupId, setActiveGroup } = useGroupStore();
  const { openModal }                             = useUIStore();
  const { profile }                               = useAuthStore();
  const { t, lang, setLang }                      = useLangStore();
  const { theme, toggle: toggleTheme }            = useThemeStore();
  const coins                                     = useCoinsStore(s => s.coins);
  const { unreadCount, notifications, loading, markAllRead, markRead, dismiss } = useNotifications();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  // Wired here only, not Sidebar.tsx — both are mounted simultaneously
  // (CSS-toggled by breakpoint, not conditionally rendered), so wiring it
  // into both would fire the cascading roll twice per coin increase. Haptics
  // are meaningless on the desktop viewport Sidebar occupies anyway.
  useCoinRollFeedback(coins);

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
            <button
              onClick={() => openModal('coinHistory')}
              className="flex items-center gap-1.5 px-3 border-e border-white/10 hover:bg-white/8 active:bg-white/15 transition-colors"
            >
              <CoinIcon size={13} />
              <NumberFlow
                value={coins}
                className="text-amber-400 text-[11px] font-bold tabular-nums leading-none"
                transformTiming={{ duration: 600, easing: 'cubic-bezier(0.16,1,0.3,1)' }}
              />
            </button>

            {/* Bell */}
            <button
              onClick={() => setShowNotif(p => !p)}
              // data-notif-bell tells NotificationCenter's outside-click handler
              // to ignore taps on this button so it doesn't close-then-reopen.
              data-notif-bell
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
            {/* Sprint 25 — whileTap only, no whileHover: this row is inside a
                sm:hidden (touch-primary) header, so a hover state that can
                never fire on the device it ships to is dead code, not
                coverage. */}
            <motion.button
              onClick={() => openModal('helpGuide')}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10"
              aria-label={t('helpGuideAria')}
            >
              <HelpCircle size={14} className="text-text-muted" />
            </motion.button>
            {/* Sprint 38 — same shell as Help immediately above, one more
                segment in the same utility cluster row. */}
            <motion.button
              onClick={() => openModal('whatsNew')}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10"
              aria-label={t('whatsNewAria')}
            >
              <Sparkles size={14} className="text-text-muted" />
            </motion.button>
            {/* Flag emoji (previous impl) and font-rendered emoji both have
                inconsistent glyph metrics across platforms — flexbox centers
                the line box, not the glyph's own ink, so different emoji
                visibly sit at different heights in the same fixed-size
                button (reported live, real phone). Lucide icons (already
                this row's language for Help/Bell) have exact, predictable
                geometry; a plain text label sidesteps flag-emoji rendering
                entirely (some platforms render flag sequences as bare
                two-letter codes instead of an actual flag glyph). */}
            <button
              onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors border-e border-white/10 text-[11px] font-bold leading-none tabular-nums"
              title={lang === 'en' ? 'Switch to Hebrew' : 'Switch to English'}
            >
              {lang === 'en' ? 'עב' : 'EN'}
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 hover:bg-white/8 active:bg-white/15 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={14} className="text-text-muted" /> : <Sun size={14} className="text-text-muted" />}
            </button>
          </div>

        </div>

        {/* V4 Sprint 23 — full-height slide-over drawer, not the dropdown
            Sidebar (desktop) still uses. TopBar itself is already sm:hidden,
            so this placement is implicitly mobile-only. */}
        <NotificationCenter
          open={showNotif}
          onClose={() => setShowNotif(false)}
          placement="drawer"
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          markAllRead={markAllRead}
          markRead={markRead}
          dismiss={dismiss}
        />

      </div>
    </header>
  );
}
