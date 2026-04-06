import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Swords, Trophy, User, Settings, type LucideIcon } from 'lucide-react';
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
    { to: ROUTES.PROFILE, Icon: User, label: t('profile') },
    { to: ROUTES.SETTINGS, Icon: Settings, label: t('settings') },
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
                  'flex-1 flex flex-col items-center justify-center py-3 transition-all duration-200 active:scale-95 relative',
                  pathname === item.to ? 'text-accent-green' : 'text-text-muted'
                )}
              >
                <div className="relative">
                  <item.Icon
                    size={22}
                    strokeWidth={pathname === item.to ? 2.5 : 1.5}
                    className={cn(
                      'mb-0.5 transition-all duration-200',
                      pathname === item.to
                        ? 'text-accent-green drop-shadow-[0_0_8px_rgba(232,160,32,0.3)]'
                        : 'text-text-muted'
                    )}
                  />
                  {item.badge ? (
                    <span className="absolute -top-1 -end-2 min-w-[16px] h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                      +{item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {pathname === item.to && (
                  <span className="w-1 h-1 rounded-full bg-accent-green mt-0.5" />
                )}
              </button>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex-1 flex flex-col items-center justify-center py-3 transition-all duration-200 active:scale-95"
              >
                {({ isActive }) => (
                  <>
                    <item.Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={cn(
                        'mb-0.5 transition-all duration-200',
                        isActive
                          ? 'text-accent-green drop-shadow-[0_0_8px_rgba(232,160,32,0.3)]'
                          : 'text-text-muted'
                      )}
                    />
                    <span className={cn('text-[10px] font-medium', isActive ? 'text-accent-green' : 'text-text-muted')}>
                      {item.label}
                    </span>
                    {isActive && <span className="w-1 h-1 rounded-full bg-accent-green mt-0.5" />}
                  </>
                )}
              </NavLink>
            )
          ))}
        </div>
      </div>
    </nav>
  );
}
