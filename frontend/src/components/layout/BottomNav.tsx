import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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

  const NAV_ITEMS = [
    {
      to: ROUTES.HOME,
      icon: '⚽',
      label: t('matches'),
      badge: hasNew ? newPoints : null,
      onClick: handleHomeClick,
    },
    { to: ROUTES.LEADERBOARD, icon: '🏆', label: t('standings') },
    { to: ROUTES.PROFILE, icon: '👤', label: t('profile') },
    { to: ROUTES.SETTINGS, icon: '⚙️', label: t('settings') },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden">
      <div className="glass border-t border-white/8">
        <div className="flex">
          {NAV_ITEMS.map(item => (
            item.onClick ? (
              <button
                key={item.to}
                onClick={item.onClick}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors relative',
                  pathname === item.to ? 'text-accent-green' : 'text-text-muted'
                )}
              >
                <span className="text-xl leading-none relative">
                  {item.icon}
                  {item.badge ? (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                      +{item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.HOME}
                className={({ isActive }) => cn(
                  'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors',
                  isActive ? 'text-accent-green' : 'text-text-muted'
                )}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            )
          ))}
        </div>
      </div>
    </nav>
  );
}
