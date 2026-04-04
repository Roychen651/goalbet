import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const NAV = [
  { to: '/admin',        label: 'Dashboard', icon: '⬡', exact: true },
  { to: '/admin/users',  label: 'Users',     icon: '👥', exact: false },
  { to: '/admin/groups', label: 'Groups',    icon: '🏆', exact: false },
];

export function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-[#070b09] text-white">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#060a07]/80 backdrop-blur-xl sm:flex">
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bebas text-2xl tracking-widest text-white">GOAL</span>
            <span className="font-bebas text-2xl tracking-widest text-accent-green" style={{ textShadow: '0 0 20px rgba(0,255,135,0.4)' }}>BET</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'text-white/50 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Back to app */}
        <div className="border-t border-white/[0.06] px-3 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30
                       transition-all hover:bg-white/5 hover:text-white/60"
          >
            <span>←</span> Back to App
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center gap-3 border-b border-white/[0.06]
                      bg-[#060a07]/90 px-4 py-3 backdrop-blur-xl sm:hidden">
        <button onClick={() => navigate('/')} className="text-white/40 hover:text-white transition-colors">←</button>
        <span className="font-bebas text-lg tracking-widest text-white">GOALBET</span>
        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-400">Admin</span>
        <div className="ms-auto flex items-center gap-1">
          {NAV.map(({ to, label, exact }) => (
            <NavLink key={to} to={to} end={exact} className={({ isActive }) =>
              cn('rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                isActive ? 'bg-accent-green/15 text-accent-green' : 'text-white/40 hover:text-white')
            }>{label}</NavLink>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pt-[52px] sm:pt-0">
        <motion.div
          key="admin-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-auto max-w-6xl px-4 py-8 sm:px-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
