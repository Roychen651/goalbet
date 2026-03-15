import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useGroupStore } from '../../stores/groupStore';
import { useLangStore } from '../../stores/langStore';
import { LangToggle } from '../ui/LangToggle';

export function Sidebar() {
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);

  const NAV_ITEMS = [
    { to: ROUTES.HOME, icon: '⚽', label: t('matches') },
    { to: ROUTES.LEADERBOARD, icon: '🏆', label: t('leaderboard') },
    { to: ROUTES.PROFILE, icon: '👤', label: t('myProfile') },
    { to: ROUTES.SETTINGS, icon: '⚙️', label: t('settings') },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-e border-white/8 py-6 px-4 glass">
      {/* Logo */}
      <div className="mb-8 px-2">
        <motion.div
          className="font-bebas text-3xl tracking-widest cursor-default"
          whileHover={{ scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <span className="text-white">Goal</span>
          <motion.span
            className="text-accent-green"
            animate={{ textShadow: ['0 0 8px rgba(0,255,135,0.3)', '0 0 20px rgba(0,255,135,0.7)', '0 0 8px rgba(0,255,135,0.3)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            Bet
          </motion.span>
        </motion.div>
        {activeGroup && (
          <div className="text-text-muted text-xs mt-1 truncate">{activeGroup.name}</div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ROUTES.HOME}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Language toggle + version */}
      <div className="flex flex-col gap-3 px-2">
        <LangToggle />
        <div className="text-text-muted text-xs opacity-50 leading-relaxed">
          GoalBet v1.0<br/>
          <span className="opacity-70">© Roy Chen 2026</span>
        </div>
      </div>
    </aside>
  );
}
