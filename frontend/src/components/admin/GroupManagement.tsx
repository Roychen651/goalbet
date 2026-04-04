import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { DangerModal } from './DangerModal';

interface AdminGroup {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  admin_username: string | null;
  admin_email: string | null;
  member_count: number;
  created_at: string;
  active_leagues: number[];
}

interface GroupMember {
  user_id: string;
  username: string | null;
  email: string | null;
  coins: number;
}

type ActiveModal =
  | { type: 'members'; group: AdminGroup }
  | { type: 'rename';  group: AdminGroup }
  | { type: 'delete';  group: AdminGroup };

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-IL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function GroupManagement() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Rename state
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  // Members state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const loadGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_groups');
    if (!error && Array.isArray(data)) setGroups(data as AdminGroup[]);
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.admin_email ?? '').toLowerCase().includes(q) ||
      g.invite_code.toLowerCase().includes(q)
    );
  }, [groups, search]);

  const openMembers = async (group: AdminGroup) => {
    setModal({ type: 'members', group });
    setMembersLoading(true);
    const { data } = await supabase
      .from('group_members')
      .select('user_id, coins, profiles(username), auth_users:user_id(email)')
      .eq('group_id', group.id);

    // Normalize the joined data
    const normalized: GroupMember[] = ((data ?? []) as unknown as {
      user_id: string;
      coins: number;
      profiles: { username: string | null } | null;
      auth_users: { email: string | null } | null;
    }[]).map(row => ({
      user_id: row.user_id,
      username: row.profiles?.username ?? null,
      email: row.auth_users?.email ?? null,
      coins: row.coins ?? 0,
    }));

    setMembers(normalized);
    setMembersLoading(false);
  };

  const handleRename = async () => {
    if (!modal || modal.type !== 'rename') return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_rename_group', {
      p_group_id: modal.group.id,
      p_name: newName.trim(),
    });
    setSaving(false);
    if (error) { showToast(`❌ ${error.message}`); return; }
    showToast('✅ Group renamed');
    setModal(null);
    loadGroups();
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    const { error } = await supabase.rpc('admin_delete_group', { p_group_id: modal.group.id });
    if (error) { showToast(`❌ ${error.message}`); return; }
    showToast(`✅ Group "${modal.group.name}" deleted`);
    setModal(null);
    loadGroups();
  };

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bebas text-3xl tracking-widest text-white">Groups</h1>
          <p className="text-xs text-white/30">{groups.length} total groups</p>
        </div>
        <input
          type="search"
          placeholder="Search name, admin, invite code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5
                     text-sm text-white placeholder-white/25 outline-none
                     focus:border-accent-green/40 focus:ring-1 focus:ring-accent-green/20 transition-all sm:w-72"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.025] text-xs uppercase tracking-wider text-white/30">
                <th className="sticky top-0 px-5 py-3 text-start font-medium">Group</th>
                <th className="sticky top-0 px-4 py-3 text-start font-medium">Admin</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Members</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Leagues</th>
                <th className="sticky top-0 px-4 py-3 text-start font-medium">Created</th>
                <th className="sticky top-0 px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3.5 animate-pulse rounded bg-white/5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-white/25">No groups found</td></tr>
              ) : (
                filtered.map((group, i) => (
                  <motion.tr
                    key={group.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{group.name}</div>
                      <div className="text-xs font-mono text-white/25">{group.invite_code}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-white/70">{group.admin_username ?? '—'}</div>
                      <div className="text-xs text-white/30">{group.admin_email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm tabular-nums text-white/60">{group.member_count}</td>
                    <td className="px-4 py-3.5 text-center text-sm tabular-nums text-white/60">{group.active_leagues?.length ?? 0}</td>
                    <td className="px-4 py-3.5 text-xs text-white/40">{fmt(group.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <ActionBtn onClick={() => { setModal({ type: 'rename', group }); setNewName(group.name); }} label="✏️" title="Rename group" />
                        <ActionBtn onClick={() => openMembers(group)} label="👥" title="View members" />
                        <ActionBtn onClick={() => setModal({ type: 'delete', group })} label="🗑" title="Delete group" danger />
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Rename modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'rename' && (
          <InlineModal title={`Rename: ${modal.group.name}`} onClose={() => setModal(null)}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm
                         text-white outline-none focus:border-accent-green/40 transition-all"
              placeholder="New group name"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 hover:text-white transition-all">Cancel</button>
              <button onClick={handleRename} disabled={saving || !newName.trim()}
                className="flex-1 rounded-xl bg-accent-green/90 py-2.5 text-sm font-semibold text-black
                           disabled:opacity-30 hover:bg-accent-green transition-all">
                {saving ? 'Saving…' : 'Rename'}
              </button>
            </div>
          </InlineModal>
        )}
      </AnimatePresence>

      {/* ── Members modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'members' && (
          <InlineModal title={`Members — ${modal.group.name}`} onClose={() => setModal(null)}>
            {membersLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-9 animate-pulse rounded-xl bg-white/5" />)}</div>
            ) : members.length === 0 ? (
              <p className="text-sm text-white/30">No members found.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {members.map(m => (
                  <div key={m.user_id}
                    className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-2.5">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{m.username ?? <span className="text-white/30 italic">no username</span>}</div>
                      <div className="text-xs text-white/30">{m.email ?? '—'}</div>
                    </div>
                    <span className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-xs font-mono text-yellow-400">
                      {m.coins.toLocaleString()} 🪙
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setModal(null)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 hover:text-white transition-all">
              Close
            </button>
          </InlineModal>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ───────────────────────────────────── */}
      <AnimatePresence>
        {modal?.type === 'delete' && (
          <DangerModal
            title={`Delete group "${modal.group.name}"?`}
            description={`This will permanently remove the group, all ${modal.group.member_count} members' leaderboard data, all predictions, and all coins in this group. This cannot be undone.`}
            onConfirm={handleDelete}
            onCancel={() => setModal(null)}
            confirmLabel="Delete Group"
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
