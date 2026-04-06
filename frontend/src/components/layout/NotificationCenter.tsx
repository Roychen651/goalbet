/**
 * NotificationCenter — Bell icon + glassmorphism dropdown.
 *
 * Architecture:
 *   - Bell button lives in TopBar (mobile) and Sidebar (desktop future).
 *   - Unread badge: animated pulse ring, shows count up to 9+.
 *   - Dropdown: spring-animated glass panel, max-height scroll.
 *   - Notification rows: unread vs read via opacity; tap → markRead.
 *   - "Mark all as read" CTA at the top.
 *   - Empty state: animated trophy + copy.
 *
 * i18n: all static labels via useLangStore().t(). Dynamic content (team
 * names, scores, pts, coins) is constructed inline from notification.metadata
 * so language switches are reflected immediately without DB round-trips.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, AppNotification } from '../../hooks/useNotifications';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';

// ─── Time formatting ──────────────────────────────────────────────────────────

function useRelativeTime(createdAt: string, lang: 'en' | 'he'): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (lang === 'he') {
    if (diffMin < 1)  return 'עכשיו';
    if (diffMin < 60) return `${diffMin} ד׳`;
    if (diffHr  < 24) return `${diffHr} ש׳`;
    return `${diffDay} י׳`;
  }
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr  < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

// ─── Content builder — language-aware, metadata-driven ───────────────────────

function buildContent(notif: AppNotification, lang: 'en' | 'he') {
  if (notif.type === 'prediction_result') {
    const { home_team = '', away_team = '', home_score, away_score, points_earned = 0, coins_earned = 0 } = notif.metadata;
    const scoreStr = (home_score != null && away_score != null)
      ? ` ${home_score}–${away_score} `
      : ' ';

    const matchLine = `${home_team}${scoreStr}${away_team}`;

    if (lang === 'he') {
      return {
        title: 'ניבוי נפתר',
        body:  matchLine,
        badge: `+${points_earned} נק׳  ·  +${coins_earned} 🪙`,
        positive: points_earned > 0,
      };
    }
    return {
      title: 'Prediction Resolved',
      body:  matchLine,
      badge: `+${points_earned} pts  ·  +${coins_earned} coins`,
      positive: points_earned > 0,
    };
  }

  // Generic fallback
  return {
    title: notif.title_key,
    body:  notif.body_key,
    badge: null,
    positive: false,
  };
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif,
  lang,
  onRead,
}: {
  notif: AppNotification;
  lang: 'en' | 'he';
  onRead: (id: string) => void;
}) {
  const { title, body, badge, positive } = buildContent(notif, lang);
  const timeLabel = useRelativeTime(notif.created_at, lang);

  return (
    <motion.button
      layout
      onClick={() => !notif.is_read && onRead(notif.id)}
      className={cn(
        'w-full text-start px-4 py-3.5 border-b border-white/[0.06] last:border-0',
        'transition-colors duration-200 hover:bg-white/[0.04] active:bg-white/[0.07]',
        notif.is_read ? 'opacity-50' : 'opacity-100',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!notif.is_read ? (
            <span className="block w-2 h-2 rounded-full bg-accent-green shadow-[0_0_6px_rgba(0,255,135,0.7)]" />
          ) : (
            <span className="block w-2 h-2" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              notif.is_read ? 'text-white/40' : 'text-white/70',
            )}>
              {title}
            </span>
            <span className="text-[10px] text-white/25 shrink-0">{timeLabel}</span>
          </div>

          {/* Match line */}
          <p className={cn(
            'text-sm leading-snug truncate',
            notif.is_read ? 'text-white/35' : 'text-white/85',
          )}>
            {body}
          </p>

          {/* Points + coins badge */}
          {badge && (
            <span className={cn(
              'inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full',
              positive
                ? 'bg-accent-green/15 text-accent-green'
                : 'bg-white/8 text-white/40',
            )}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ lang }: { lang: 'en' | 'he' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center justify-center py-12 px-6 gap-3"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        className="text-4xl select-none"
      >
        ⚽
      </motion.div>
      <p className="text-white/60 text-sm font-medium text-center">
        {lang === 'he' ? 'אתה מעודכן!' : "You're all caught up!"}
      </p>
      <p className="text-white/25 text-xs text-center">
        {lang === 'he' ? 'נקודות שתרוויח יופיעו כאן' : 'Earned points will appear here'}
      </p>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications();
  const { lang, t } = useLangStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleMarkAll = async () => {
    await markAllRead();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key="notif-panel"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.75 }}
          className="absolute end-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] z-50
                     rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          style={{
            background: 'rgba(10,16,12,0.92)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-white/50" />
              <span className="text-sm font-semibold text-white/80">{t('notifications')}</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-accent-green text-bg-base rounded-full px-1.5 py-0.5 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-accent-green transition-colors"
              >
                <CheckCheck size={12} />
                {t('notifMarkAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-accent-green animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState lang={lang} />
            ) : (
              <motion.div layout>
                {notifications.map((n) => (
                  <NotifRow
                    key={n.id}
                    notif={n}
                    lang={lang}
                    onRead={markRead}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Bell button (exported separately for TopBar) ─────────────────────────────

export function NotificationBell({
  unreadCount,
  onClick,
}: {
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="Open notifications"
      className="relative p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/8 transition-all"
    >
      <Bell size={17} />

      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute -top-0.5 -end-0.5 flex items-center justify-center
                       min-w-[14px] h-[14px] rounded-full bg-accent-green text-bg-base
                       text-[9px] font-black leading-none px-0.5
                       shadow-[0_0_8px_rgba(0,255,135,0.6)]"
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-60" />
            <span className="relative z-10">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
