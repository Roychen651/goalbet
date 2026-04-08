import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Palette, Zap, Mail, Lock, LogOut, Users, Copy, Check,
  UserPlus, Plus, RefreshCw, Trophy, Shield, Trash2, RotateCcw,
  BookOpen, ChevronRight,
} from 'lucide-react';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import { useThemeStore } from '../stores/themeStore';
import { useMatchSync } from '../hooks/useMatchSync';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { GroupMembersList } from '../components/groups/GroupMembersList';
import { PolicyModal } from '../components/ui/PolicyModal';
import { PasswordStrength } from '../components/auth-v2/PasswordStrength';
import { isPasswordValid } from '../lib/authSchema';
import { FOOTBALL_LEAGUES } from '../lib/constants';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { TranslationKey } from '../lib/i18n';

// ── Segmented Control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-white/6 border border-white/8 p-0.5 shrink-0">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
            opt.value === value
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/25 shadow-sm'
              : 'text-text-muted hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Unified Setting Row ──────────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-accent-green" />
        </div>
        <div className="min-w-0">
          <p className="text-text-primary text-sm font-medium">{title}</p>
          {subtitle && <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-accent-green/60" />
      <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold">{title}</h2>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════

export function SettingsPage() {
  const { groups, activeGroupId, setActiveGroup, updateGroupLeagues, updateGroupName, leaveGroup, deleteGroup, removeMember } = useGroupStore();
  const { user, signOut } = useAuthStore();
  const { addToast, openModal, enableLiveAnimations } = useUIStore();
  const { t, lang } = useLangStore();
  const { theme } = useThemeStore();
  const [savingLeagues, setSavingLeagues] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isAdmin = !!user && !!activeGroup && user.id === activeGroup.created_by;

  const { syncing, lastSynced, triggerSync } = useMatchSync(
    activeGroup?.active_leagues ?? [],
    999,
  );
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>(
    activeGroup?.active_leagues ?? []
  );

  const toggleLeague = (id: number) => {
    if (!isAdmin) return;
    setSelectedLeagues(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleSaveLeagues = async () => {
    if (!activeGroupId || !isAdmin) return;
    setSavingLeagues(true);
    try {
      await updateGroupLeagues(activeGroupId, selectedLeagues);
      addToast(t('leaguesSaved'), 'success');
    } catch {
      addToast('Failed to save preferences', 'error');
    } finally {
      setSavingLeagues(false);
    }
  };

  const handleSaveName = async () => {
    if (!activeGroupId || !isAdmin || !groupNameInput.trim()) return;
    setSavingName(true);
    try {
      await updateGroupName(activeGroupId, groupNameInput.trim());
      addToast('Group name updated', 'success');
      setEditingName(false);
    } catch {
      addToast('Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleResetScores = async () => {
    if (!activeGroupId || !isAdmin) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc('reset_group_scores', { p_group_id: activeGroupId });
      if (error) throw error;
      addToast('All scores have been reset', 'success');
      setConfirmReset(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to reset scores', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroupId || !isAdmin) return;
    setDeletingGroup(true);
    try {
      await deleteGroup(activeGroupId);
      addToast('Group deleted', 'success');
      setConfirmDeleteGroup(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete group', 'error');
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeGroupId || !isAdmin) return;
    await removeMember(activeGroupId, targetUserId);
    addToast('Member removed', 'success');
  };

  const handleChangePassword = async () => {
    if (!isPasswordValid(newPassword)) return;
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    setPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      addToast('Password updated successfully', 'success');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;
    setLeavingGroupId(groupId);
    try {
      await leaveGroup(groupId, user.id);
      addToast(t('leftGroup'), 'success');
      setConfirmLeaveId(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to leave group', 'error');
    } finally {
      setLeavingGroupId(null);
    }
  };

  const handleCopyInvite = async () => {
    if (!activeGroup) return;
    const shareText = `Join my GoalBet group "${activeGroup.name}"! Code: ${activeGroup.invite_code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'GoalBet Invite', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopiedInvite(true);
        addToast(t('copySuccess'), 'success');
        setTimeout(() => setCopiedInvite(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(activeGroup.invite_code).catch(() => {});
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  // ── No group state ──────────────────────────────────────────────────────────

  if (!activeGroup) {
    return (
      <div className="space-y-5">
        <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-text-primary">{t('settings')}</h1>
        <GlassCard className="p-5 text-center space-y-4">
          <p className="text-text-muted text-sm">{t('noGroupYet')}</p>
          <div className="flex gap-3 justify-center">
            <NeonButton variant="green" onClick={() => openModal('createGroup')}>{t('createGroup')}</NeonButton>
            <NeonButton variant="ghost" onClick={() => openModal('joinGroup')}>{t('joinGroup')}</NeonButton>
          </div>
        </GlassCard>

        {/* Preferences still shown without a group */}
        <PreferencesCard t={t} lang={lang} theme={theme} enableLiveAnimations={enableLiveAnimations} />

        {/* Account */}
        <AccountCard
          t={t} user={user} signingOut={signingOut} onSignOut={handleSignOut}
          showChangePassword={showChangePassword} setShowChangePassword={setShowChangePassword}
          newPassword={newPassword} setNewPassword={setNewPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          passwordError={passwordError} setPasswordError={setPasswordError}
          changingPassword={changingPassword} onChangePassword={handleChangePassword}
        />
      </div>
    );
  }

  // ── Main Vault layout ───────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-text-primary">{t('settings')}</h1>

      {/* ── Bento Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Preferences Hub ───────────────────────────────────────────── */}
        <PreferencesCard t={t} lang={lang} theme={theme} enableLiveAnimations={enableLiveAnimations} />

        {/* ── Account Hub ───────────────────────────────────────────────── */}
        <AccountCard
          t={t} user={user} signingOut={signingOut} onSignOut={handleSignOut}
          showChangePassword={showChangePassword} setShowChangePassword={setShowChangePassword}
          newPassword={newPassword} setNewPassword={setNewPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          passwordError={passwordError} setPasswordError={setPasswordError}
          changingPassword={changingPassword} onChangePassword={handleChangePassword}
        />
      </div>

      {/* ── Group Hub (full width) ─────────────────────────────────────── */}
      <div>
        <SectionTitle icon={Users} title={t('vaultGroupHub')} />

        {/* Invite Code — Premium Ticket */}
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-text-primary text-sm font-semibold">{activeGroup.name}</p>
              <p className="text-text-muted text-xs mt-0.5">{t('inviteCode')}</p>
            </div>
            {isAdmin && !editingName && (
              <button
                onClick={() => { setGroupNameInput(activeGroup.name); setEditingName(true); }}
                className="text-xs text-text-muted hover:text-accent-green transition-colors"
              >
                {t('renameGroup')}
              </button>
            )}
          </div>

          <AnimatePresence>
            {isAdmin && editingName && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="flex gap-2">
                  <input
                    value={groupNameInput}
                    onChange={e => setGroupNameInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/15 text-text-primary text-sm focus:outline-none focus:border-accent-green/50"
                    placeholder="Group name"
                    maxLength={40}
                  />
                  <NeonButton variant="green" size="sm" loading={savingName} onClick={handleSaveName}>{t('save')}</NeonButton>
                  <button onClick={() => setEditingName(false)} className="text-text-muted hover:text-text-primary text-xs px-2">{t('cancel')}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium invite code ticket */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-bg-surface rounded-xl border border-border-subtle px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-2xl sm:text-3xl tracking-[0.25em] text-accent-green font-bold select-all">
                {activeGroup.invite_code}
              </span>
              <button
                onClick={handleCopyInvite}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  copiedInvite
                    ? 'bg-accent-green/15 text-accent-green'
                    : 'bg-white/8 border border-white/12 text-text-muted hover:text-text-primary hover:bg-white/12',
                )}
              >
                {copiedInvite ? <Check size={13} /> : <Copy size={13} />}
                {copiedInvite ? t('copiedCode') : t('copyInviteCode')}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Group Members */}
        <div className="mb-4">
          <h3 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('groupMembers')}</h3>
          <GroupMembersList
            groupId={activeGroup.id}
            createdBy={activeGroup.created_by}
            isAdmin={isAdmin}
            onRemoveMember={isAdmin ? handleRemoveMember : undefined}
          />
        </div>

        {/* Group Switcher */}
        <div className="mb-4">
          <h3 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('switchGroup')}</h3>
          <div className="space-y-2">
            {groups.map(group => (
              <div key={group.id}>
                <div className={cn(
                  'flex items-center gap-2 w-full px-4 py-3 rounded-xl border transition-all',
                  group.id === activeGroupId ? 'bg-accent-green/10 border-accent-green/30' : 'bg-white/5 border-white/10'
                )}>
                  <button onClick={() => { setActiveGroup(group.id); setSelectedLeagues(group.active_leagues); }} className="flex-1 text-start">
                    <div className={cn('font-medium text-sm', group.id === activeGroupId ? 'text-accent-green' : 'text-text-primary')}>{group.name}</div>
                    <div className="text-xs text-text-muted">{group.active_leagues.length} {t('leagues')}</div>
                  </button>
                  <button
                    onClick={() => setConfirmLeaveId(group.id)}
                    className="text-text-muted hover:text-accent-orange text-xs px-2 py-1 rounded-lg hover:bg-accent-orange/10 transition-all"
                  >
                    {t('leaveGroup')}
                  </button>
                </div>
                <AnimatePresence>
                  {confirmLeaveId === group.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-1 px-4 py-3 rounded-xl bg-accent-orange/8 border border-accent-orange/20 flex items-center justify-between gap-3">
                        <span className="text-text-primary/80 text-xs">{t('leaveGroupConfirm')}</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setConfirmLeaveId(null)} className="text-text-muted text-xs hover:text-text-primary px-2 py-1 rounded">{t('cancel')}</button>
                          <NeonButton variant="danger" size="sm" loading={leavingGroupId === group.id} onClick={() => handleLeaveGroup(group.id)}>{t('confirmLeave')}</NeonButton>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Group Actions */}
        <div className="flex gap-3 mb-4">
          <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('createGroup')}>
            <Plus size={14} className="me-1" />{t('newGroup')}
          </NeonButton>
          <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('joinGroup')}>
            <UserPlus size={14} className="me-1" />{t('joinGroupShort')}
          </NeonButton>
        </div>

        {/* Match Data Sync */}
        <GlassCard className="p-4 flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
              <RefreshCw size={15} className="text-accent-green" />
            </div>
            <div>
              <p className="text-text-primary text-sm font-medium">{t('syncMatchesTitle')}</p>
              <p className="text-text-muted text-xs mt-0.5">{lastSynced ? `Last synced: ${lastSynced.toLocaleTimeString()}` : 'Pull latest fixtures from ESPN'}</p>
            </div>
          </div>
          <NeonButton variant="ghost" size="sm" loading={syncing} onClick={triggerSync}>{syncing ? 'Syncing…' : '⟳ Sync Now'}</NeonButton>
        </GlassCard>

        {/* League Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-text-muted text-xs uppercase tracking-wider">
              {t('activeLeagues')} ({selectedLeagues.length})
              {!isAdmin && <span className="ms-2 text-text-muted/50 normal-case font-normal">· {t('adminOnly')}</span>}
            </h3>
            {isAdmin && (
              <NeonButton variant="green" size="sm" loading={savingLeagues} onClick={handleSaveLeagues}
                disabled={JSON.stringify([...selectedLeagues].sort()) === JSON.stringify([...activeGroup.active_leagues].sort())}>
                {t('save')}
              </NeonButton>
            )}
          </div>
          <GlassCard className="p-4">
            <div className="flex flex-wrap gap-2">
              {FOOTBALL_LEAGUES.map(league => (
                <button
                  key={league.id}
                  onClick={() => toggleLeague(league.id)}
                  disabled={!isAdmin}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium transition-all border',
                    selectedLeagues.includes(league.id)
                      ? isAdmin
                        ? 'bg-accent-green/15 border-accent-green text-accent-green'
                        : 'bg-accent-green/10 border-accent-green/40 text-accent-green/60 cursor-default'
                      : isAdmin
                        ? 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:text-text-primary'
                        : 'bg-white/3 border-white/6 text-text-primary/25 cursor-default'
                  )}
                >
                  {league.badge} {league.name}
                </button>
              ))}
            </div>
            {!isAdmin && (
              <p className="text-text-muted/50 text-xs mt-3 text-center">{t('onlyAdminLeagues')}</p>
            )}
          </GlassCard>
        </div>
      </div>

      {/* ── Admin Tools (conditional) ──────────────────────────────────── */}
      {isAdmin && (
        <div>
          <SectionTitle icon={Shield} title={t('vaultAdminTools')} />
          <GlassCard className="p-4 border-accent-orange/15 space-y-4">
            {/* Reset All Scores */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center shrink-0">
                    <RotateCcw size={15} className="text-accent-orange" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">{t('resetAllScores')}</p>
                    <p className="text-text-muted text-xs mt-0.5">{t('resetScoresDesc')}</p>
                  </div>
                </div>
                {!confirmReset && (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="shrink-0 text-accent-orange text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-accent-orange/10 transition-all"
                  >
                    {t('resetBtn')}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {confirmReset && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-accent-orange/15">
                      <p className="text-accent-orange text-xs font-semibold mb-3">
                        {t('resetScoresWarning')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmReset(false)}
                          className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-text-primary border border-white/10 hover:bg-white/5 transition-all"
                        >
                          {t('cancel')}
                        </button>
                        <NeonButton variant="danger" size="sm" loading={resetting} onClick={handleResetScores} className="flex-1">
                          {t('yesResetAll')}
                        </NeonButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/8" />

            {/* Delete Group */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center shrink-0">
                    <Trash2 size={15} className="text-accent-orange" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">{t('deleteGroupTitle')}</p>
                    <p className="text-text-muted text-xs mt-0.5">{t('deleteGroupDesc')}</p>
                  </div>
                </div>
                {!confirmDeleteGroup && (
                  <button
                    onClick={() => setConfirmDeleteGroup(true)}
                    className="shrink-0 text-accent-orange text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-accent-orange/10 transition-all"
                  >
                    {t('deleteGroup')}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {confirmDeleteGroup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-accent-orange/15">
                      <p className="text-accent-orange text-xs font-semibold mb-3">
                        {t('deleteGroupWarning').replace('{0}', activeGroup.name)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteGroup(false)}
                          className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-text-primary border border-white/10 hover:bg-white/5 transition-all"
                        >
                          {t('cancel')}
                        </button>
                        <NeonButton variant="danger" size="sm" loading={deletingGroup} onClick={handleDeleteGroup} className="flex-1">
                          {t('yesDeleteGroup')}
                        </NeonButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── User Guide ─────────────────────────────────────────────────── */}
      <GlassCard className="p-4">
        <button onClick={() => openModal('helpGuide')} className="w-full flex items-center justify-between gap-3 group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
              <BookOpen size={15} className="text-accent-green" />
            </div>
            <div className="text-start">
              <p className="text-text-primary text-sm font-medium">{t('userGuide')}</p>
              <p className="text-text-muted text-xs mt-0.5">{lang === 'he' ? 'ניקוד, מטבעות ואיך לשחק' : 'Scoring, coins, and how to play'}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-text-muted group-hover:text-accent-green transition-colors" />
        </button>
      </GlassCard>

      {/* ── Policy link (mobile) ───────────────────────────────────────── */}
      <div className="sm:hidden pt-2 text-center">
        <button onClick={() => setShowPolicy(true)} className="text-text-muted text-xs opacity-40 hover:opacity-70 transition-opacity">
          {t('policyTerms')}
        </button>
      </div>

      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </div>
  );
}

// ── Preferences Card ─────────────────────────────────────────────────────────

function PreferencesCard({
  t,
  lang,
  theme,
  enableLiveAnimations,
}: {
  t: (key: TranslationKey) => string;
  lang: string;
  theme: string;
  enableLiveAnimations: boolean;
}) {
  const { setLang } = useLangStore();
  const { setTheme } = useThemeStore();

  return (
    <div>
      <SectionTitle icon={Zap} title={t('vaultPreferences')} />
      <GlassCard className="p-4 space-y-0 divide-y divide-white/6">
        <SettingRow icon={Globe} title={t('language')} subtitle={lang === 'he' ? 'English / עברית' : 'English / Hebrew'}>
          <SegmentedControl
            options={[
              { value: 'en' as const, label: 'EN' },
              { value: 'he' as const, label: 'עב' },
            ]}
            value={lang as 'en' | 'he'}
            onChange={(v) => setLang(v)}
          />
        </SettingRow>

        <SettingRow icon={Palette} title={t('theme')} subtitle={t('appearance')}>
          <SegmentedControl
            options={[
              { value: 'dark' as const, label: t('darkMode') },
              { value: 'light' as const, label: t('lightMode') },
            ]}
            value={theme as 'dark' | 'light'}
            onChange={(v) => setTheme(v)}
          />
        </SettingRow>

        <SettingRow icon={Zap} title={t('enableLiveAnimations')} subtitle={t('enableLiveAnimationsDesc')}>
          <button
            onClick={() => useUIStore.getState().toggleLiveAnimations()}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
              enableLiveAnimations ? 'bg-accent-green/30' : 'bg-white/10',
            )}
          >
            <motion.div
              className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-colors duration-200',
                enableLiveAnimations ? 'bg-accent-green' : 'bg-white/40',
              )}
              animate={{ x: enableLiveAnimations ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </SettingRow>
      </GlassCard>
    </div>
  );
}

// ── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  t,
  user,
  signingOut,
  onSignOut,
  showChangePassword,
  setShowChangePassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordError,
  setPasswordError,
  changingPassword,
  onChangePassword,
}: {
  t: (key: TranslationKey) => string;
  user: { email?: string } | null;
  signingOut: boolean;
  onSignOut: () => void;
  showChangePassword: boolean;
  setShowChangePassword: (v: boolean) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  passwordError: string;
  setPasswordError: (v: string) => void;
  changingPassword: boolean;
  onChangePassword: () => void;
}) {
  return (
    <div>
      <SectionTitle icon={Mail} title={t('vaultAccount')} />
      <GlassCard className="p-4 space-y-4">
        {/* Email */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
            <Mail size={15} className="text-accent-green" />
          </div>
          <div className="min-w-0">
            <p className="text-text-muted text-xs">{t('signedInAs')}</p>
            <p className="text-text-primary text-sm font-medium truncate">{user?.email}</p>
          </div>
        </div>

        <div className="border-t border-white/6" />

        {/* Change password */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
                <Lock size={15} className="text-accent-green" />
              </div>
              <div>
                <p className="text-text-primary text-sm font-medium">{t('changePassword')}</p>
                <p className="text-text-muted text-xs mt-0.5">{t('changePasswordDesc')}</p>
              </div>
            </div>
            {!showChangePassword && (
              <button
                onClick={() => { setShowChangePassword(true); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white/6 border border-white/12 text-text-muted hover:text-text-primary hover:bg-white/10 text-xs font-medium transition-all"
              >
                Change
              </button>
            )}
          </div>

          <AnimatePresence>
            {showChangePassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  <div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                      placeholder="New password"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-text-primary text-sm placeholder-white/25 focus:outline-none focus:border-accent-green/50 transition-colors"
                      autoComplete="new-password"
                    />
                    {newPassword.length > 0 && (
                      <div className="mt-2">
                        <PasswordStrength password={newPassword} />
                      </div>
                    )}
                  </div>
                  <AnimatePresence>
                    {isPasswordValid(newPassword) && (
                      <motion.input
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        type="password"
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-text-primary text-sm placeholder-white/25 focus:outline-none focus:border-accent-green/50 transition-colors"
                        autoComplete="new-password"
                      />
                    )}
                  </AnimatePresence>
                  {passwordError && (
                    <p className="text-red-400 text-xs">{passwordError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowChangePassword(false)}
                      className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-text-primary border border-white/10 hover:bg-white/5 transition-all"
                    >
                      {t('cancel')}
                    </button>
                    <NeonButton
                      variant="green"
                      size="sm"
                      loading={changingPassword}
                      onClick={onChangePassword}
                      disabled={!isPasswordValid(newPassword) || confirmPassword.length === 0}
                      className="flex-1"
                    >
                      {t('savePassword')}
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-white/6" />

        {/* Sign out — ghost danger styling */}
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-accent-orange hover:bg-accent-orange/8 transition-all disabled:opacity-40"
        >
          <LogOut size={15} />
          {signingOut ? '...' : t('signOut')}
        </button>
      </GlassCard>
    </div>
  );
}
