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
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { AppNotification } from '../../hooks/useNotifications';
import { useLangStore } from '../../stores/langStore';
import { useGroupStore } from '../../stores/groupStore';
import { tg, type TranslationKey } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

// Swipe-to-dismiss threshold — identical shape to Toast.tsx's ToastItem drag
// config (rule: physical swipe gestures should feel the same everywhere in
// this app). Toasts dismiss on either axis direction; a notification row
// dismisses the same way regardless of RTL/LTR — a swipe is a physical
// gesture, not a logical-property concern (same reasoning as the drawer's
// slide-direction isRTL branch above).
const DISMISS_OFFSET = 80;
const DISMISS_VELOCITY = 400;

// ─── Time formatting ──────────────────────────────────────────────────────────

function relativeTime(createdAt: string, t: (key: TranslationKey) => string): string {
  const diffMs  = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1)  return t('notifJustNow');
  if (diffMin < 60) return `${diffMin} ${t('notifMinAgo')}`;
  if (diffHr  < 24) return `${diffHr} ${t('notifHrAgo')}`;
  return `${diffDay} ${t('notifDayAgo')}`;
}

// ─── Content builder — language-aware, metadata-driven ───────────────────────

// V4 Sprint 23 — 'view_match' routes to HomePage's ?focus deep link,
// 'view_standings' to LeaderboardPage's ?highlight deep link. Only rendered
// when the notification actually carries the id the target page needs
// (match_id for prediction_result) — a CTA with nowhere real to go is worse
// than no CTA.
type NotifCta = 'view_match' | 'view_standings' | null;

function buildContent(notif: AppNotification, t: (key: TranslationKey) => string): {
  title: string; body: string; badge: string | null; positive: boolean; cta: NotifCta;
} {
  if (notif.type === 'prediction_result') {
    const {
      home_team = '', away_team = '',
      home_score, away_score,
      points_earned = 0, coins_earned = 0,
    } = notif.metadata;

    const scoreStr = (home_score != null && away_score != null)
      ? ` ${home_score}–${away_score} ` : ' ';

    return {
      title:    t('notifPredictionResult'),
      body:     `${home_team}${scoreStr}${away_team}`,
      badge:    `+${points_earned} ${t('notifPts')}  ·  +${coins_earned} ${t('notifCoins')}`,
      positive: points_earned > 0,
      cta:      notif.metadata.match_id ? 'view_match' : null,
    };
  }
  if (notif.type === 'rank_drop') {
    const { old_rank, new_rank, overtaker_username, overtaker_gender } = notif.metadata;
    return {
      title: t('notifRankDropTitle'),
      body: overtaker_username
        ? tg(t, 'notifRankDropBody', overtaker_gender).replace('{0}', overtaker_username).replace('{1}', String(new_rank ?? '?'))
        : t('notifRankDropBodyGeneric').replace('{0}', String(new_rank ?? '?')),
      badge: old_rank != null && new_rank != null ? `#${old_rank} → #${new_rank}` : null,
      positive: false,
      cta: 'view_standings',
    };
  }

  return { title: notif.title_key, body: notif.body_key, badge: null, positive: false, cta: null };
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif, t, onRead, onDismiss, onCta }: {
  notif: AppNotification;
  t: (key: TranslationKey) => string;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onCta: (notif: AppNotification, cta: 'view_match' | 'view_standings') => void;
}) {
  const { title, body, badge, positive, cta } = buildContent(notif, t);
  const timeLabel = relativeTime(notif.created_at, t);
  // Fires the threshold-cross feedback exactly once per drag gesture, not on
  // every pixel of movement past the line.
  const crossedRef = useRef(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDrag={(_, info: PanInfo) => {
        const past = Math.abs(info.offset.x) > DISMISS_OFFSET;
        if (past && !crossedRef.current) {
          crossedRef.current = true;
          haptic('light');
          playSound('toggle_click');
        } else if (!past && crossedRef.current) {
          crossedRef.current = false;
        }
      }}
      onDragEnd={(_, info: PanInfo) => {
        if (Math.abs(info.offset.x) > DISMISS_OFFSET || Math.abs(info.velocity.x) > DISMISS_VELOCITY) {
          onDismiss(notif.id);
        }
        crossedRef.current = false;
      }}
      className="border-b border-[var(--card-border)] last:border-0 cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={() => !notif.is_read && onRead(notif.id)}
        className={cn(
          'w-full text-start px-4 py-3.5',
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
      </button>

      {/* Inline quick-action CTA — a sibling of the mark-read button, not
          nested inside it (two interactive elements can't nest validly).
          Its own onClick, so tapping it never also fires markRead's toggle. */}
      {cta && (
        <button
          onClick={() => onCta(notif, cta)}
          className="flex items-center gap-1 ms-[26px] mb-3 -mt-1 text-[11px] font-bold text-accent-green hover:opacity-80 transition-opacity"
        >
          {cta === 'view_match' ? t('notifViewMatch') : t('notifViewStandings')}
          <ChevronRight size={12} className="rtl:rotate-180" />
        </button>
      )}
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: (key: TranslationKey) => string }) {
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
        {t('notifEmpty')}
      </p>
      <p className="text-text-muted text-xs text-center opacity-70">
        {t('notifEmptyDesc')}
      </p>
    </motion.div>
  );
}

// ─── Shared header (unread count + mark-all-read) ─────────────────────────────

function NotifHeader({ t, unreadCount, markAllRead }: {
  t: (key: TranslationKey) => string;
  unreadCount: number;
  markAllRead: () => Promise<void>;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 shrink-0"
      style={{ borderBottom: '1px solid var(--card-border)' }}
    >
      <div className="flex items-center gap-2">
        <Bell size={14} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">
          {t('notifications')}
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
          {t('notifMarkAllRead')}
        </button>
      )}
    </div>
  );
}

// ─── Shared list body ──────────────────────────────────────────────────────────

function NotifList({ notifications, loading, t, markRead, dismiss, onCta, className }: {
  notifications: AppNotification[];
  loading: boolean;
  t: (key: TranslationKey) => string;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  onCta: (notif: AppNotification, cta: 'view_match' | 'view_standings') => void;
  className?: string;
}) {
  return (
    <div className={cn('overflow-y-auto overscroll-contain', className)} onWheel={(e) => e.stopPropagation()}>
      {loading && notifications.length === 0 ? (
        <div className="flex justify-center items-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--card-border)] border-t-accent-green animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          {notifications.map(n => (
            <NotifRow key={n.id} notif={n} t={t} onRead={markRead} onDismiss={dismiss} onCta={onCta} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  /** 'bottom' (default) = dropdown below button (TopBar). 'right' = panel to the right (Sidebar). 'drawer' = full-height mobile slide-over (V4 Sprint 23). */
  placement?: 'bottom' | 'right' | 'drawer';
  /** Pass from the parent's useNotifications() instance to avoid duplicate state */
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function NotificationCenter({ open, onClose, placement = 'bottom', notifications, unreadCount, loading, markAllRead, markRead, dismiss }: NotificationCenterProps) {
  const { t, lang } = useLangStore();
  const navigate = useNavigate();
  const { activeGroupId, setActiveGroup } = useGroupStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // V4 Sprint 23 — inline quick-action CTA routing. A notification's match
  // (or standings) may belong to a group other than the one the user is
  // currently viewing — switching active group first is what makes the
  // deep link actually resolve to something real, not just an empty feed.
  const handleCta = (notif: AppNotification, cta: 'view_match' | 'view_standings') => {
    if (notif.group_id && notif.group_id !== activeGroupId) {
      setActiveGroup(notif.group_id);
    }
    onClose();
    if (cta === 'view_match' && notif.metadata.match_id) {
      navigate(`/?focus=${notif.metadata.match_id}`);
    } else if (cta === 'view_standings') {
      navigate(`/leaderboard?highlight=${notif.user_id}`);
    }
  };

  // Close on outside click. Skip clicks on the bell button itself — otherwise
  // tapping the bell while the panel is open fires this handler first (closing
  // the panel) and then the bell's onClick fires (re-opening it). The bell is
  // marked with data-notif-bell so we can detect and ignore it here.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('[data-notif-bell]')) return; // let the bell's own onClick handle the toggle
      if (panelRef.current && !panelRef.current.contains(target as Node)) onClose();
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

  // V4 Sprint 23 — mobile drawer. Rendered as two SIBLING motion.div elements
  // (backdrop + panel), never nested, and deliberately NOT the same element:
  // the panel is what Framer Motion slides via an `x` transform, and stacking
  // backdrop-filter (or mix-blend-mode) on an element that is itself being
  // transformed is the exact documented WebKit paint-failure that made
  // PredictionModal.tsx's sheet invisible on a real phone once already
  // (CLAUDE.md §21/§34) — there's no real WebKit engine in this environment
  // to re-verify a fix if that lesson gets ignored again. The blur lives on
  // the backdrop (fixed, full-screen, animates opacity only — never
  // transformed); the panel gets a solid themed background instead.
  //
  // Slide direction is the one place this component branches on language
  // rather than staying purely logical-property-driven: a Framer `x` value
  // is an unavoidably physical transform (CSS logical properties can't
  // express it), so unlike the RTL-pinned SVG charts elsewhere in this
  // codebase, here an explicit isRTL check is correct, not a regression.
  if (placement === 'drawer') {
    const isRTL = lang === 'he';
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="notif-drawer-backdrop"
              className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-xl [backdrop-filter:blur(24px)_saturate(160%)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
            <motion.div
              ref={panelRef}
              key="notif-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label={t('notifications')}
              className="fixed inset-y-0 end-0 z-[60] w-[86vw] max-w-[380px] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
              style={{
                background: 'var(--color-tooltip-bg)',
                borderInlineStart: '1px solid var(--card-border)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.8 }}
            >
              <NotifHeader t={t} unreadCount={unreadCount} markAllRead={markAllRead} />
              <NotifList notifications={notifications} loading={loading} t={t} markRead={markRead} dismiss={dismiss} onCta={handleCta} className="flex-1" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

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
          <NotifHeader t={t} unreadCount={unreadCount} markAllRead={markAllRead} />
          <NotifList notifications={notifications} loading={loading} t={t} markRead={markRead} dismiss={dismiss} onCta={handleCta} className="max-h-[380px]" />
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
