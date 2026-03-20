import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useGroupStore } from '../../stores/groupStore';
import { useLangStore } from '../../stores/langStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { LangToggle } from '../ui/LangToggle';
import { PolicyModal } from '../ui/PolicyModal';
import { CoinIcon } from '../ui/CoinIcon';

export function Sidebar() {
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const coins = useCoinsStore(s => s.coins);
  const [showPolicy, setShowPolicy] = useState(false);
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
          <span className="text-accent-green logo-bet-glow">
            Bet
          </span>
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

      {/* Coin balance */}
      <div className="mx-2 mb-3 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <CoinIcon size={22} />
          <div>
            <div className="text-amber-400 font-bold text-base tabular-nums leading-none">{coins}</div>
            <div className="text-amber-500/50 text-[10px] mt-0.5 uppercase tracking-widest">Coins</div>
          </div>
        </div>
      </div>

      {/* Language toggle + version */}
      <div className="flex flex-col gap-3 px-2">
        <LangToggle />
        <div className="text-text-muted text-xs opacity-50 leading-relaxed">
          GoalBet v1.0<br/>
          <span className="opacity-70">© Roy Chen 2026</span>
        </div>
        <button
          onClick={() => setShowPolicy(true)}
          className="text-text-muted text-[11px] opacity-40 hover:opacity-70 transition-opacity text-start"
        >
          {t('policyTerms')}
        </button>
      </div>
      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </aside>
  );
}
