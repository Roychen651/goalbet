import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface Stats {
  total_users: number;
  total_groups: number;
  total_matches: number;
  total_predictions: number;
  total_coins_circulating: number;
}

// V4 Sprint 31 — sync_run_log row shape, mirrors migration 052's table exactly.
interface SyncRunLogRow {
  id: string;
  run_type: 'live_poll' | 'daily_sync' | 'startup_catchup';
  tier: 'tier1' | 'tier2' | null;
  started_at: string;
  completed_at: string | null;
  leagues_checked: number | null;
  matches_checked: number | null;
  matches_resolved: number | null;
  errors: { scope: string; message: string }[];
  duration_ms: number | null;
}

function fmtSyncTime(iso: string) {
  return new Intl.DateTimeFormat('en-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));
}

interface BentoCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  delay?: number;
  span?: string;
}

function BentoCard({ icon, label, value, sub, accent = 'border-white/8', delay = 0, span = '' }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className={`rounded-2xl border ${accent} bg-white/[0.035] p-5 backdrop-blur-sm ${span}`}
    >
      <div className="mb-3 text-2xl">{icon}</div>
      <div className="text-2xl font-bold tabular-nums text-white">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs font-medium text-white/40 uppercase tracking-wider">{label}</div>
      {sub && <div className="mt-2 text-xs text-white/25">{sub}</div>}
    </motion.div>
  );
}

export function AdminDashboardPage() {
  const { session } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  // V4 Sprint 31 — pure additive read, zero changes to the 3 existing sync
  // buttons above. undefined = still loading, null = failed to load (RPC
  // error or migration 052 not applied yet), [] = loaded, genuinely empty.
  const [syncLog, setSyncLog] = useState<SyncRunLogRow[] | null | undefined>(undefined);

  useEffect(() => {
    supabase.rpc('admin_get_stats').then(({ data, error }) => {
      if (!error && data && Array.isArray(data) && data.length > 0) {
        setStats(data[0] as Stats);
      }
      setLoading(false);
    });

    supabase.rpc('admin_get_sync_log', { p_limit: 20 }).then(({ data, error }) => {
      setSyncLog(!error && Array.isArray(data) ? (data as SyncRunLogRow[]) : null);
    });
  }, []);

  const handleSync = async (endpoint: 'matches' | 'scores') => {
    setSyncing(true);
    setSyncResult(null);
    const url = import.meta.env.VITE_BACKEND_URL;
    try {
      const res = await fetch(`${url}/api/sync/${endpoint}`, { method: 'POST' });
      const json = await res.json();
      setSyncResult(res.ok ? `✅ ${endpoint} sync: ${JSON.stringify(json)}` : `❌ Error: ${json.error ?? res.status}`);
    } catch (e) {
      setSyncResult(`❌ ${e instanceof Error ? e.message : 'Network error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-3xl tracking-widest text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-white/30">Platform overview · roychen651@gmail.com</p>
      </div>

      {/* Bento KPI grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <BentoCard icon="👥" label="Total Users"       value={stats.total_users}            accent="border-accent-green/20" delay={0}    />
          <BentoCard icon="🏆" label="Total Groups"      value={stats.total_groups}           accent="border-blue-500/20"     delay={0.05} />
          <BentoCard icon="⚽" label="Total Matches"     value={stats.total_matches}          accent="border-white/8"         delay={0.1}  />
          <BentoCard icon="🎯" label="Predictions Made"  value={stats.total_predictions}      accent="border-white/8"         delay={0.15} />
          <BentoCard icon="🪙" label="Coins Circulating" value={stats.total_coins_circulating}
            sub="Across all groups and members" accent="border-yellow-500/20" delay={0.2} span="col-span-2" />
        </div>
      ) : (
        <p className="text-sm text-white/30">Failed to load stats — check Supabase RPC.</p>
      )}

      {/* System Health */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-white/50">System Health</h2>
        <p className="mb-5 text-xs text-white/30">Manually trigger backend sync operations.</p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleSync('scores')}
            disabled={syncing}
            className="rounded-xl bg-accent-green/10 border border-accent-green/30 px-4 py-2.5 text-sm
                       font-medium text-accent-green transition-all hover:bg-accent-green/20
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing ? '⏳ Syncing…' : '⚡ Force Score Sync'}
          </button>
          <button
            onClick={() => handleSync('matches')}
            disabled={syncing}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium
                       text-white/60 transition-all hover:bg-white/10 hover:text-white
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            📅 Sync Fixtures
          </button>
          <a
            href={`${BACKEND_URL}/api/health`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium
                       text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            🩺 Health Check ↗
          </a>
        </div>

        {syncResult && (
          <motion.pre
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs text-white/70 font-mono"
          >
            {syncResult}
          </motion.pre>
        )}

        {/* V4 Sprint 31 — sync_run_log telemetry, read-only, admin-only via
            admin_get_sync_log RPC. Pure additive UI read — the 3 buttons
            above are completely untouched. */}
        <div className="mt-6">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">Recent Sync Runs</h3>
          <p className="mb-3 text-xs text-white/25">Last 20 automated sync/score-check runs (Sprint 31 telemetry).</p>

          {syncLog === undefined ? (
            <div className="overflow-hidden rounded-2xl border border-white/8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse border-b border-white/[0.04] bg-white/5 last:border-0" />
              ))}
            </div>
          ) : syncLog === null ? (
            <p className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-6 text-center text-xs text-white/25">
              Couldn't load sync log — the migration may not be applied yet, or you're not signed in as the super admin.
            </p>
          ) : syncLog.length === 0 ? (
            <p className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-6 text-center text-xs text-white/25">
              No sync runs recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/8">
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.025] uppercase tracking-wider text-white/30">
                      <th className="sticky top-0 px-4 py-2.5 text-start font-medium">Type</th>
                      <th className="sticky top-0 px-4 py-2.5 text-start font-medium">Started</th>
                      <th className="sticky top-0 px-4 py-2.5 text-center font-medium">Duration</th>
                      <th className="sticky top-0 px-4 py-2.5 text-center font-medium">Checked</th>
                      <th className="sticky top-0 px-4 py-2.5 text-center font-medium">Resolved</th>
                      <th className="sticky top-0 px-4 py-2.5 text-center font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLog.map((row) => {
                      const checked = row.matches_checked ?? row.leagues_checked;
                      const hasErrors = row.errors.length > 0;
                      const crashed = row.completed_at === null;
                      return (
                        <tr key={row.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]">
                          <td className="px-4 py-2.5 text-white/70">
                            {row.run_type}{row.tier ? `/${row.tier}` : ''}
                          </td>
                          <td className="px-4 py-2.5 text-white/40">{fmtSyncTime(row.started_at)}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-white/50">
                            {row.duration_ms !== null ? `${row.duration_ms}ms` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-white/50">{checked ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-white/50">{row.matches_resolved ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            {crashed ? (
                              <span className="rounded-md bg-red-500/15 px-2 py-0.5 font-medium text-red-400" title="Run crashed before completing">crashed</span>
                            ) : hasErrors ? (
                              <span
                                className="rounded-md bg-red-500/10 px-2 py-0.5 font-medium text-red-400"
                                title={row.errors.map(e => `${e.scope}: ${e.message}`).join('\n')}
                              >
                                {row.errors.length}
                              </span>
                            ) : (
                              <span className="text-white/20">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        {[
          { to: '/admin/users',  icon: '👥', label: 'Manage Users',  sub: 'Edit, coins, delete' },
          { to: '/admin/groups', icon: '🏆', label: 'Manage Groups', sub: 'Rename, members, delete' },
        ].map(({ to, icon, label, sub }, i) => (
          <motion.a
            key={to}
            href={to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.035]
                       p-5 transition-all hover:border-accent-green/30 hover:bg-accent-green/[0.04]"
          >
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="font-semibold text-white">{label}</div>
              <div className="text-xs text-white/35">{sub}</div>
            </div>
            <span className="ms-auto text-white/20">→</span>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
