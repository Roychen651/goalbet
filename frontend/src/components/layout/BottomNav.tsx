import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { Swords, Trophy, BarChart3, MessageCircle, User, Settings, type LucideIcon } from 'lucide-react';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { useNewPointsAlert } from '../../hooks/useNewPointsAlert';

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

  return (
    // Reported live: on a real iOS Safari device, this bar drifts into the
    // middle of scrolled content instead of staying pinned to the viewport
    // bottom. `position: fixed` is already correct here and Lenis (App.tsx)
    // never applies a CSS transform to any ancestor of this element (it
    // drives native `window.scrollTo`, confirmed by reading Lenis's own
    // source) — so this isn't a broken containing-block chain. It's the
    // well-documented WebKit behavior where a `fixed` element's repaint can
    // lag behind a JS-driven scroll loop (Lenis calls `scrollTo` every RAF
    // frame during momentum scroll) until Safari promotes it to its own
    // compositing layer. `translateZ(0)` + `will-change: transform` forces
    // that promotion up front. UNCHANGED from before Sprint 49 — this fix
    // is already correct and must never move onto the capsule div below,
    // which carries the actual `backdrop-filter` (§21/§34's WebKit trap is
    // specifically transform+backdrop-filter on the SAME element).
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden will-change-transform [transform:translateZ(0)] px-4">
      {/* V6 Sprint 49 — Floating Glass Dock. `.glass-dock` (index.css) is a
          dedicated blur/saturate tier, deliberately not a bump to the
          shared `.glass` class (TopBar/Sidebar also use it). `gradient-edge`
          + `border-transparent` is GlassCard.tsx's own established 1px
          holographic-rim technique (mask-composite: exclude) — reused
          verbatim, not reimplemented; `border-radius: inherit` on that
          pseudo-element means it automatically becomes a pill under
          `rounded-full` with zero extra CSS. Bottom margin folds in the
          safe-area inset directly (env(), same pattern already established
          in NotificationCenter.tsx's drawer) so the dock floats clear of the
          home-indicator instead of sitting flush against it. */}
      <div
        className="glass-dock gradient-edge border border-transparent rounded-full overflow-hidden"
        style={{ marginBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      >
        <LayoutGroup id="bottom-nav">
          <div className="flex relative">
            {NAV_ITEMS.map(item => {
              const active = item.onClick ? pathname === item.to : undefined;
              return item.onClick ? (
                <button
                  key={item.to}
                  onClick={item.onClick}
                  className={cn(
                    'relative flex-1 flex flex-col items-center justify-center py-2.5 transition-colors duration-200 active:scale-95',
                    active ? 'text-accent-green' : 'text-text-muted'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavPill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-1 rounded-full bg-accent-green/12 border border-accent-green/20"
                    />
                  )}
                  <div className="relative">
                    <item.Icon
                      size={22}
                      strokeWidth={active ? 2.5 : 1.5}
                      className={cn(
                        'mb-0.5 transition-all duration-200',
                        active ? 'text-accent-green drop-shadow-[0_0_8px_rgba(232,160,32,0.3)]' : 'text-text-muted'
                      )}
                    />
                    {item.badge ? (
                      <span className="absolute -top-1 -end-2 min-w-[16px] h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                        +{item.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-medium relative">{item.label}</span>
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative flex-1 flex flex-col items-center justify-center py-2.5 transition-colors duration-200 active:scale-95"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="activeNavPill"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-1 rounded-full bg-accent-green/12 border border-accent-green/20"
                        />
                      )}
                      <item.Icon
                        size={22}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        className={cn(
                          'mb-0.5 transition-all duration-200 relative',
                          isActive ? 'text-accent-green drop-shadow-[0_0_8px_rgba(232,160,32,0.3)]' : 'text-text-muted'
                        )}
                      />
                      <span className={cn('text-[10px] font-medium relative', isActive ? 'text-accent-green' : 'text-text-muted')}>
                        {item.label}
                      </span>
                    </>
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
