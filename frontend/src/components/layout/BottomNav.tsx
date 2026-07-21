import type { CSSProperties } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, BarChart3, MessageCircle, User, Settings, type LucideIcon } from 'lucide-react';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { useNewPointsAlert } from '../../hooks/useNewPointsAlert';
import { haptic } from '../../lib/haptics';

// V6 Sprint 49 hotfix (live-reported, real screenshots) — the original
// "circle around the icon" active-indicator was a fixed `inset-1` overlay
// sized to each item's equal 1/6-width flex slot, completely disconnected
// from the actual rendered width of the label underneath it. Hebrew labels
// in particular ("סטטיסטיקה" is longer than English "Stats"; "חדר ההלבשה"
// is two words) made the mismatch obvious — the circle either looked too
// small for what it was meant to highlight, or floated oddly relative to
// text it had no real size relationship to.
//
// The structural fix, not a bigger circle: only the ACTIVE item shows its
// label at all, inline next to its icon, inside a pill sized to its OWN
// real content (icon + label) via Framer's `layout` prop — never a fixed
// overlay guessing a size. Every inactive item collapses to icon-only. This
// is the same "morphing segmented pill" pattern most premium mobile nav
// bars ship today, and it structurally cannot mismatch a label's width
// again in either language — the pill IS the content, not a shape drawn
// around it.
export function BottomNav() {
  const { t } = useLangStore();
  const { hasNew, newPoints, markAsSeen } = useNewPointsAlert();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleHomeClick = () => {
    if (hasNew) markAsSeen();
    navigate(ROUTES.HOME);
  };

  const NAV_ITEMS: { to: string; Icon: LucideIcon; label: string; badge?: number | null; onClick?: () => void }[] = [
    {
      to: ROUTES.HOME,
      Icon: Swords,
      label: t('matches'),
      badge: hasNew ? newPoints : null,
      onClick: handleHomeClick,
    },
    { to: ROUTES.LEADERBOARD, Icon: Trophy, label: t('standings') },
    { to: ROUTES.STATS, Icon: BarChart3, label: t('statsHub') },
    { to: ROUTES.LOCKER_ROOM, Icon: MessageCircle, label: t('lockerRoom') },
    { to: ROUTES.PROFILE, Icon: User, label: t('profile') },
    { to: ROUTES.SETTINGS, Icon: Settings, label: t('settings') },
  ];

  const tapSpring = { type: 'spring' as const, stiffness: 500, damping: 15 };
  const morphSpring = { type: 'spring' as const, stiffness: 420, damping: 34 };

  // Premium active-pill treatment — reuses the exact color-mix(in oklch, …)
  // technique already established by Toast.tsx / the leaderboard rank-delta
  // badge (§32/§36), never a new hardcoded rgba. No backdrop-filter here —
  // this element gets a real `transform` from `layout`/`whileTap`, and the
  // WebKit backdrop-filter+transform trap (already fixed twice in this
  // exact file's history, §21/§34) means blur must stay only on the outer,
  // never-transformed .glass-dock wrapper.
  const activeStyle: CSSProperties = {
    background:
      'linear-gradient(135deg, color-mix(in oklch, var(--color-accent-green) 22%, transparent), color-mix(in oklch, var(--color-accent-green) 7%, transparent))',
    border: '1px solid color-mix(in oklch, var(--color-accent-green) 38%, transparent)',
    boxShadow: '0 0 16px color-mix(in oklch, var(--color-accent-green) 22%, transparent)',
  };

  function ItemContent({ Icon, label, active, badge }: { Icon: LucideIcon; label: string; active: boolean; badge?: number | null }) {
    return (
      <>
        <div className="relative shrink-0">
          <Icon
            size={active ? 20 : 22}
            strokeWidth={active ? 2.5 : 1.75}
            className={cn(
              'transition-all duration-200',
              active ? 'text-accent-green drop-shadow-[0_0_6px_rgba(189,232,245,0.55)]' : 'text-text-muted'
            )}
          />
          {badge ? (
            <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white px-0.5 shadow-[0_0_0_2px_var(--color-bg-card)]">
              +{badge}
            </span>
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {active && (
            <motion.span
              key="label"
              initial={{ opacity: 0, width: 0, marginInlineStart: 0 }}
              animate={{ opacity: 1, width: 'auto', marginInlineStart: 6 }}
              exit={{ opacity: 0, width: 0, marginInlineStart: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden whitespace-nowrap text-[12px] font-bold text-accent-green"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    // Reported live: on a real iOS Safari device, this bar drifts into the
    // middle of scrolled content instead of staying pinned to the viewport
    // bottom. `position: fixed` is already correct here and Lenis (App.tsx)
    // never applies a CSS transform to any ancestor of this element (it
    // drives native `window.scrollTo`, confirmed by reading Lenis's own
    // source) — so this isn't a broken containing-block chain. It's the
    // well-documented WebKit behavior where a `fixed` element's repaint can
    // lag behind a JS-driven scroll loop until Safari promotes it to its own
    // compositing layer. `translateZ(0)` + `will-change: transform` forces
    // that promotion up front. This fix must never move onto the capsule
    // div below, which carries the actual `backdrop-filter` (§21/§34's
    // WebKit trap is specifically transform+backdrop-filter on ONE element).
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden will-change-transform [transform:translateZ(0)] px-3">
      {/* .glass-dock (index.css) is a dedicated blur/saturate tier,
          deliberately not a bump to the shared .glass class (TopBar/
          Sidebar also use it). gradient-edge + border-transparent is
          GlassCard.tsx's own 1px holographic-rim technique, reused
          verbatim; border-radius: inherit means it becomes a pill under
          rounded-full with zero extra CSS. Bottom margin folds in the
          safe-area inset directly (env()), matching NotificationCenter's
          drawer, so the dock floats clear of the home-indicator. */}
      <div
        className="glass-dock gradient-edge border border-transparent rounded-full overflow-hidden"
        style={{ marginBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      >
        <LayoutGroup id="bottom-nav">
          <div className="flex items-center justify-between px-1.5 py-1.5">
            {NAV_ITEMS.map(item => {
              const active = item.onClick ? pathname === item.to : undefined;

              return item.onClick ? (
                <motion.button
                  key={item.to}
                  layout
                  transition={morphSpring}
                  whileTap={{ scale: 0.95, rotate: -0.5, transition: tapSpring }}
                  onClick={() => {
                    haptic('selection');
                    item.onClick!();
                  }}
                  style={active ? activeStyle : undefined}
                  className={cn(
                    'relative flex items-center justify-center rounded-full transition-colors duration-200',
                    active ? 'px-3.5 py-2.5' : 'p-2.5'
                  )}
                >
                  <ItemContent Icon={item.Icon} label={item.label} active={!!active} badge={item.badge} />
                </motion.button>
              ) : (
                // display:contents removes the <a> itself from the flex box
                // tree so the inner motion.div is the real, direct flex
                // sibling — required for layout/FLIP measurement to see it
                // (and its neighbors) correctly as the row reflows.
                <NavLink key={item.to} to={item.to} className="contents">
                  {({ isActive }) => (
                    <motion.div
                      layout
                      transition={morphSpring}
                      whileTap={{ scale: 0.95, rotate: -0.5, transition: tapSpring }}
                      onClick={() => haptic('selection')}
                      style={isActive ? activeStyle : undefined}
                      className={cn(
                        'relative flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer',
                        isActive ? 'px-3.5 py-2.5' : 'p-2.5'
                      )}
                    >
                      <ItemContent Icon={item.Icon} label={item.label} active={isActive} />
                    </motion.div>
                  )}
                </NavLink>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
