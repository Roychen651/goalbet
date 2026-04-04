import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { DangerModal } from './DangerModal';

interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  group_count: number;
  total_coins: number;
}

interface UserCoinRow {
  group_id: string;
  group_name: string;
  coins: number;
}

type ActiveModal =
  | { type: 'editName'; user: AdminUser }
  | { type: 'coins';    user: AdminUser }
  | { type: 'delete';   user: AdminUser };

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function TimeAgo({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-white/25">Never</span>;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const label = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;
  return <span className="text-white/50">{label}</span>;
}

export function UserManagement() {
  const { session } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Edit name state
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Coins state
  const [userCoins, setUserCoins] = useState<UserCoinRow[]>([]);
  const [coinDelta, setCoinDelta] = useState<Record<string, string>>({});
  const [coinsLoading, setCoinsLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_users');
    if (!error && Array.isArray(data)) setUsers(data as AdminUser[]);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      u.email.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── Handlers ────────────────────────────────────────────────
  const handleEditName = async () => {
    if (!modal || modal.type !== 'editName') return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_username', {
      p_user_id: modal.user.id,
      p_username: editName.trim(),
    });
    setSaving(false);
    if (error) { showToast(`❌ ${error.message}`); return; }
    showToast('✅ Username updated');
    setModal(null);
    loadUsers();
  };

  const openCoins = async (user: AdminUser) => {
    setModal({ type: 'coins', user });
    setCoinsLoading(true);
    const { data } = await supabase.rpc('admin_get_user_coins', { p_user_id: user.id });
    setUserCoins(Array.isArray(data) ? (data as UserCoinRow[]) : []);
    setCoinDelta({});
    setCoinsLoading(false);
  };

  const handleAdjustCoins = async (groupId: string) => {
    const delta = parseInt(coinDelta[groupId] ?? '0', 10);
    if (isNaN(delta) || delta === 0) return;
    const { error } = await supabase.rpc('admin_adjust_coins', {
      p_user_id:  modal!.type === 'coins' ? modal!.user.id : '',
      p_group_id: groupId,
      p_delta:    delta,
    });
    if (error) { showToast(`❌ ${error.message}`); return; }
    showToast(`✅ Coins adjusted by ${delta > 0 ? '+' : ''}${delta}`);
    setCoinDelta(prev => ({ ...prev, [groupId]: '' }));
    openCoins(modal!.type === 'coins' ? modal!.user : modal!.user);
    loadUsers();
  };

  const handleResetPassword = async (user: AdminUser) => {
    const url = import.meta.env.VITE_BACKEND_URL;
    const token = session?.access_token;
    if (!token || !url) { showToast('❌ Session error'); return; }
    const res = await fetch(`${url}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userEmail: user.email }),
    });
    const json = await res.json();
    showToast(res.ok ? `✅ Reset email sent to ${user.email}` : `❌ ${json.error}`);
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    const url = import.meta.env.VITE_BACKEND_URL;
    const token = session?.access_token;
    if (!token || !url) { showToast('❌ Session error'); return; }

    // 1. Wipe public-schema data first
    const { error: dataErr } = await supabase.rpc('admin_delete_user_data', { p_user_id: modal.user.id });
    if (dataErr) { showToast(`❌ Data wipe failed: ${dataErr.message}`); return; }

    // 2. Hard-delete from auth.users via backend service role
    const res = await fetch(`${url}/api/admin/users/${modal.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) { showToast(`❌ Auth delete failed: ${json.error}`); return; }

    showToast(`✅ User ${modal.user.email} permanently deleted`);
    setModal(null);
    loadUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bebas text-3xl tracking-widest text-white">Users</h1>
          <p className="text-xs text-white/30">{users.length} total users</p>
        </div>
        <input
          type="search"
          placeholder="Search email or username…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5
                     text-sm text-white placeholder-white/25 outline-none
                     focus:border-accent-green/40 focus:ring-1 focus:ring-accent-green/20 transition-all sm:w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.025] text-xs uppercase tracking-wider text-white/30">
                <th className="sticky top-0 px-5 py-3 text-start font-medium">User</th>
                <th className="sticky top-0 px-4 py-3 text-start font-medium">Joined</th>
                <th className="sticky top-0 px-4 py-3 text-start font-medium">Last Sign-in</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Groups</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Coins</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3.5 animate-pulse rounded bg-white/5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-white/25">No users found</td></tr>
              ) : (
                filtered.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{user.username ?? <span className="text-white/30 italic">no username</span>}</div>
                      <div className="text-xs text-white/35">{user.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-white/40">{fmt(user.created_at)}</td>
                    <td className="px-4 py-3.5 text-xs"><TimeAgo iso={user.last_sign_in_at} /></td>
                    <td className="px-4 py-3.5 text-center text-sm tabular-nums text-white/60">{user.group_count}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-xs font-mono font-medium text-yellow-400">
                        {user.total_coins.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <ActionBtn onClick={() => { setModal({ type: 'editName', user }); setEditName(user.username ?? ''); }} label="✏️" title="Edit name" />
                        <ActionBtn onClick={() => openCoins(user)} label="🪙" title="Manage coins" />
                        <ActionBtn onClick={() => handleResetPassword(user)} label="🔑" title="Reset password" />
                        <ActionBtn onClick={() => setModal({ type: 'delete', user })} label="🗑" title="Delete user" danger />
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit name modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'editName' && (
          <InlineModal title={`Edit Username — ${modal.user.email}`} onClose={() => setModal(null)}>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEditName()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm
                         text-white outline-none focus:border-accent-green/40 transition-all"
              placeholder="Username"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 hover:text-white transition-all">Cancel</button>
              <button onClick={handleEditName} disabled={saving || !editName.trim()}
                className="flex-1 rounded-xl bg-accent-green/90 py-2.5 text-sm font-semibold text-black
                           disabled:opacity-30 hover:bg-accent-green transition-all">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </InlineModal>
        )}
      </AnimatePresence>

      {/* ── Coin management modal ────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'coins' && (
          <InlineModal title={`Coins — ${modal.user.username ?? modal.user.email}`} onClose={() => setModal(null)}>
            {coinsLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />)}
              </div>
            ) : userCoins.length === 0 ? (
              <p className="text-sm text-white/30">This user is not in any groups.</p>
            ) : (
              <div className="space-y-3">
                {userCoins.map(row => (
                  <div key={row.group_id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{row.group_name}</div>
                      <div className="text-xs text-yellow-400 font-mono">{row.coins.toLocaleString()} coins</div>
                    </div>
                    <input
                      type="number"
                      placeholder="±delta"
                      value={coinDelta[row.group_id] ?? ''}
                      onChange={e => setCoinDelta(prev => ({ ...prev, [row.group_id]: e.target.value }))}
                      className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center
                                 text-sm text-white outline-none focus:border-accent-green/40 transition-all"
                    />
                    <button
                      onClick={() => handleAdjustCoins(row.group_id)}
                      disabled={!coinDelta[row.group_id] || coinDelta[row.group_id] === '0'}
                      className="rounded-lg bg-accent-green/15 px-3 py-1.5 text-xs font-semibold
                                 text-accent-green disabled:opacity-30 hover:bg-accent-green/25 transition-all"
                    >Apply</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setModal(null)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 hover:text-white transition-all">
              Done
            </button>
          </InlineModal>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation modal ─────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'delete' && (
          <DangerModal
            title={`Permanently delete ${modal.user.username ?? modal.user.email}?`}
            description={`This will remove all data for ${modal.user.email} — predictions, leaderboard, coins, and their auth account. This cannot be undone.`}
            onConfirm={handleDelete}
            onCancel={() => setModal(null)}
            confirmLabel="Delete User"
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-white/10 backdrop-blur-xl
                       border border-white/15 px-5 py-3 text-sm text-white shadow-xl z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ onClick, label, title, danger = false }: { onClick: () => void; label: string; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg p-1.5 text-sm transition-all
        ${danger ? 'text-white/25 hover:bg-red-500/15 hover:text-red-400' : 'text-white/30 hover:bg-white/8 hover:text-white'}`}
    >
      {label}
    </button>
  );
}

function InlineModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c120f] p-6 shadow-2xl"
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <h3 className="mb-4 text-base font-semibold text-white">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}
