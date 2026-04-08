/**
 * NotificationCenter — Bell icon + glassmorphism dropdown.
 *
 * Placement:
 *   - TopBar (mobile):  fixed below TopBar, spans full width minus margins.
 *   - Sidebar (desktop): absolute to the right of the bell item.
 *
 * Theming: uses CSS token classes (text-text-primary, text-text-muted,
 * var(--color-tooltip-bg), var(--card-border)) so it adapts to dark/light mode.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { AppNotification } from '../../hooks/useNotifications';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';

// ─── Time formatting ──────────────────────────────────────────────────────────

function relativeTime(createdAt: string, lang: 'en' | 'he'): string {
  const diffMs  = Date.now() - new Date(createdAt).getTime();
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
    const {
      home_team = '', away_team = '',
      home_score, away_score,
      points_earned = 0, coins_earned = 0,
    } = notif.metadata;

    const scoreStr = (home_score != null && away_score != null)
      ? ` ${home_score}–${away_score} ` : ' ';

    return {
      title:    lang === 'he' ? 'ניבוי נפתר' : 'Prediction Resolved',
      body:     `${home_team}${scoreStr}${away_team}`,
      badge:    lang === 'he'
        ? `+${points_earned} נק׳  ·  +${coins_earned} 🪙`
        : `+${points_earned} pts  ·  +${coins_earned} coins`,
      positive: points_earned > 0,
    };
  }
  return { title: notif.title_key, body: notif.body_key, badge: null, positive: false };
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif, lang, onRead }: {
  notif: AppNotification;
  lang: 'en' | 'he';
  onRead: (id: string) => void;
}) {
  const { title, body, badge, positive } = buildContent(notif, lang);
  const timeLabel = relativeTime(notif.created_at, lang);

  return (
    <motion.button
      layout
      onClick={() => !notif.is_read && onRead(notif.id)}
      className={cn(
        'w-full text-start px-4 py-3.5 border-b border-[var(--card-border)] last:border-0',
        'transition-colors duration-150 hover:bg-white/[0.04]',
        notif.is_read ? 'opacity-50' : 'opacity-100',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0 w-2">
          {!notif.is_read && (
            <span className="block w-2 h-2 rounded-full bg-accent-green shadow-[0_0_6px_rgba(0,255,135,0.7)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {title}
            </span>
            <span className="text-[10px] text-text-muted opacity-60 shrink-0">{timeLabel}</span>
          </div>

          {/* Match line */}
          <p className={cn(
            'text-sm leading-snug truncate text-text-primary',
            notif.is_read && 'opacity-60',
          )}>
            {body}
          </p>

          {/* Points + coins badge */}
          {badge && (
            <span className={cn(
              'inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full',
              positive
                ? 'bg-accent-green/15 text-accent-green'
                : 'bg-white/8 text-text-muted',
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
      <p className="text-text-primary text-sm font-medium text-center opacity-70">
        {lang === 'he' ? 'אתה מעודכן!' : "You're all caught up!"}
      </p>
      <p className="text-text-muted text-xs text-center opacity-70">
        {lang === 'he' ? 'נקודות שתרוויח יופיעו כאן' : 'Earned points will appear here'}
      </p>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  /** 'bottom' (default) = dropdown below button (TopBar). 'right' = panel to the right (Sidebar). */
  placement?: 'bottom' | 'right';
  /** Pass from the parent's useNotifications() instance to avoid duplicate state */
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

export function NotificationCenter({ open, onClose, placement = 'bottom', notifications, unreadCount, loading, markAllRead, markRead }: NotificationCenterProps) {
  const { lang } = useLangStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Positioning strategy:
  //   bottom / mobile : fixed, inset-x-2 (8 px from edges), 58 px from top (below TopBar)
  //   bottom / sm+    : absolute dropdown, end-aligned, standard width
  //   right           : absolute to the right of the sidebar bell button
  const positionClasses = placement === 'right'
    ? 'absolute start-full ms-3 bottom-0 w-[340px]'
    // Mobile: fixed full-width; sm+: sm:absolute overrides fixed via higher specificity media query
    : 'fixed inset-x-2 top-[58px] sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[340px]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key="notif-panel"
          initial={{ opacity: 0, y: placement === 'right' ? 0 : -8, x: placement === 'right' ? -8 : 0, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement === 'right' ? 0 : -8, x: placement === 'right' ? -8 : 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.75 }}
          className={cn(
            'z-50 rounded-2xl overflow-hidden',
            'shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
            positionClasses,
          )}
          style={{
            background: 'var(--color-tooltip-bg)',
            border: '1px solid var(--card-border)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--card-border)' }}
          >
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                {lang === 'he' ? 'התראות' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-accent-green text-bg-base rounded-full px-1.5 py-0.5 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-accent-green transition-colors"
              >
                <CheckCheck size={12} />
                {lang === 'he' ? 'סמן הכל כנקרא' : 'Mark all as read'}
              </button>
            )}
          </div>

          {/* List */}
          <div
            className="max-h-[380px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--card-border)] border-t-accent-green animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState lang={lang} />
            ) : (
              <motion.div layout>
                {notifications.map(n => (
                  <NotifRow key={n.id} notif={n} lang={lang} onRead={markRead} />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Bell button ──────────────────────────────────────────────────────────────

export function NotificationBell({
  unreadCount,
  onClick,
  className,
}: {
  unreadCount: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="Open notifications"
      className={cn(
        'relative p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/8 transition-all',
        className,
      )}
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
                       text-[9px] font-black leading-none px-0.5"
          >
            <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-50" />
            <span className="relative z-10">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
