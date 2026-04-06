import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import { useMatchSync } from '../hooks/useMatchSync';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { InviteCodeDisplay } from '../components/groups/InviteCodeDisplay';
import { GroupMembersList } from '../components/groups/GroupMembersList';
import { PolicyModal } from '../components/ui/PolicyModal';
import { PasswordStrength } from '../components/auth-v2/PasswordStrength';
import { isPasswordValid } from '../lib/authSchema';
import { FOOTBALL_LEAGUES } from '../lib/constants';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function SettingsPage() {
  const { groups, activeGroupId, setActiveGroup, updateGroupLeagues, updateGroupName, leaveGroup, deleteGroup, removeMember } = useGroupStore();
  const { user, signOut } = useAuthStore();
  const { addToast, openModal } = useUIStore();
  const { t, lang } = useLangStore();
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

  return (
    <div className="space-y-5">
      <h1 className="font-barlow font-bold text-3xl tracking-wide uppercase text-white">{t('settings')}</h1>

      {!activeGroup ? (
        <GlassCard className="p-5 text-center space-y-4">
          <p className="text-text-muted text-sm">{t('noGroupYet')}</p>
          <div className="flex gap-3 justify-center">
            <NeonButton variant="green" onClick={() => openModal('createGroup')}>{t('createGroup')}</NeonButton>
            <NeonButton variant="ghost" onClick={() => openModal('joinGroup')}>{t('joinGroup')}</NeonButton>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Invite code + group rename */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-text-muted text-xs uppercase tracking-wider">{t('inviteFriends')}</h2>
              {isAdmin && !editingName && (
                <button
                  onClick={() => { setGroupNameInput(activeGroup.name); setEditingName(true); }}
                  className="text-xs text-text-muted hover:text-white transition-colors"
                >
                  ✏️ {t('renameGroup')}
                </button>
              )}
            </div>

            <AnimatePresence>
              {isAdmin && editingName && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-3"
                >
                  <div className="flex gap-2">
                    <input
                      value={groupNameInput}
                      onChange={e => setGroupNameInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/15 text-white text-sm focus:outline-none focus:border-accent-green/50"
                      placeholder="Group name"
                      maxLength={40}
                    />
                    <NeonButton variant="green" size="sm" loading={savingName} onClick={handleSaveName}>Save</NeonButton>
                    <button onClick={() => setEditingName(false)} className="text-text-muted hover:text-white text-xs px-2">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <InviteCodeDisplay code={activeGroup.invite_code} groupName={activeGroup.name} />
          </section>

          {/* Group members */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('groupMembers')}</h2>
            <GroupMembersList
              groupId={activeGroup.id}
              createdBy={activeGroup.created_by}
              isAdmin={isAdmin}
              onRemoveMember={isAdmin ? handleRemoveMember : undefined}
            />
          </section>

          {/* Group switcher + leave */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('switchGroup')}</h2>
            <div className="space-y-2">
              {groups.map(group => (
                <div key={group.id}>
                  <div className={cn(
                    'flex items-center gap-2 w-full px-4 py-3 rounded-xl border transition-all',
                    group.id === activeGroupId ? 'bg-accent-green/10 border-accent-green/30' : 'bg-white/5 border-white/10'
                  )}>
                    <button onClick={() => { setActiveGroup(group.id); setSelectedLeagues(group.active_leagues); }} className="flex-1 text-start">
                      <div className={cn('font-medium text-sm', group.id === activeGroupId ? 'text-accent-green' : 'text-white')}>{group.name}</div>
                      <div className="text-xs opacity-60 text-white">{group.active_leagues.length} {t('leagues')}</div>
                    </button>
                    <button onClick={() => setConfirmLeaveId(group.id)} className="text-text-muted hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-red-400/10 transition-all">
                      {t('leaveGroup')}
                    </button>
                  </div>
                  <AnimatePresence>
                    {confirmLeaveId === group.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-1 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                          <span className="text-white/80 text-xs">{t('leaveGroupConfirm')}</span>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => setConfirmLeaveId(null)} className="text-text-muted text-xs hover:text-white px-2 py-1 rounded">{t('cancel')}</button>
                            <NeonButton variant="danger" size="sm" loading={leavingGroupId === group.id} onClick={() => handleLeaveGroup(group.id)}>{t('confirmLeave')}</NeonButton>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

          {/* Match data sync */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">Match Data</h2>
            <GlassCard className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">{t('syncMatchesTitle')}</p>
                <p className="text-text-muted text-xs mt-0.5">{lastSynced ? `Last synced: ${lastSynced.toLocaleTimeString()}` : 'Pull latest fixtures from ESPN'}</p>
              </div>
              <NeonButton variant="ghost" size="sm" loading={syncing} onClick={triggerSync}>{syncing ? 'Syncing…' : '⟳ Sync Now'}</NeonButton>
            </GlassCard>
          </section>

          {/* League selection */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-text-muted text-xs uppercase tracking-wider">
                {t('activeLeagues')} ({selectedLeagues.length})
                {!isAdmin && <span className="ml-2 text-white/30 normal-case font-normal">· {t('adminOnly')}</span>}
              </h2>
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
                          ? 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:text-white'
                          : 'bg-white/3 border-white/6 text-white/25 cursor-default'
                    )}
                  >
                    {league.badge} {league.name}
                  </button>
                ))}
              </div>
              {!isAdmin && (
                <p className="text-white/25 text-xs mt-3 text-center">{t('onlyAdminLeagues')}</p>
              )}
            </GlassCard>
          </section>

          {/* Admin: Danger Zone */}
          {isAdmin && (
            <section>
              <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('dangerZone')}</h2>
              <GlassCard className="p-4 border border-red-500/15 space-y-4">
                {/* Reset All Scores */}
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white text-sm font-medium">{t('resetAllScores')}</p>
                      <p className="text-text-muted text-xs mt-0.5">{t('resetScoresDesc')}</p>
                    </div>
                    {!confirmReset && (
                      <NeonButton variant="danger" size="sm" onClick={() => setConfirmReset(true)} className="shrink-0">
                        {t('resetBtn')}
                      </NeonButton>
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
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-red-400 text-xs font-semibold mb-3">
                            {t('resetScoresWarning')}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmReset(false)}
                              className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-white border border-white/10 hover:bg-white/5 transition-all"
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
                    <div>
                      <p className="text-white text-sm font-medium">Delete Group</p>
                      <p className="text-text-muted text-xs mt-0.5">Permanently remove this group and all its data.</p>
                    </div>
                    {!confirmDeleteGroup && (
                      <NeonButton variant="danger" size="sm" onClick={() => setConfirmDeleteGroup(true)} className="shrink-0">
                        Delete
                      </NeonButton>
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
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-red-400 text-xs font-semibold mb-3">
                            This will permanently delete "{activeGroup.name}" for all members. This cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDeleteGroup(false)}
                              className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                            >
                              {t('cancel')}
                            </button>
                            <NeonButton variant="danger" size="sm" loading={deletingGroup} onClick={handleDeleteGroup} className="flex-1">
                              Yes, Delete Group
                            </NeonButton>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </GlassCard>
            </section>
          )}

          {/* More groups */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('moreGroups')}</h2>
            <div className="flex gap-3">
              <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('createGroup')}>{t('newGroup')}</NeonButton>
              <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('joinGroup')}>{t('joinGroupShort')}</NeonButton>
            </div>
          </section>
        </>
      )}

      {/* User Guide */}
      <GlassCard className="p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-white text-sm font-medium">{t('userGuide')}</p>
          <p className="text-text-muted text-xs mt-0.5">{lang === 'he' ? 'ניקוד, מטבעות ואיך לשחק' : 'Scoring, coins, and how to play'}</p>
        </div>
        <button
          onClick={() => openModal('helpGuide')}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-white/6 border border-white/12 text-white/70 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
        >
          {lang === 'he' ? 'פתח' : 'Open'}
        </button>
      </GlassCard>

      {/* Account */}
      <section>
        <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">Account</h2>
        <GlassCard className="p-4 space-y-4">

          {/* Email */}
          <div>
            <p className="text-white/40 text-xs mb-0.5">Signed in as</p>
            <p className="text-white text-sm font-medium truncate">{user?.email}</p>
          </div>

          <div className="border-t border-white/8" />

          {/* Change password */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Change password</p>
                <p className="text-text-muted text-xs mt-0.5">Set a new sign-in password</p>
              </div>
              {!showChangePassword && (
                <button
                  onClick={() => { setShowChangePassword(true); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-white/6 border border-white/12 text-white/70 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
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
                        className="w-full px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white text-sm placeholder-white/25 focus:outline-none focus:border-accent-green/50 transition-colors"
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
                          className="w-full px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white text-sm placeholder-white/25 focus:outline-none focus:border-accent-green/50 transition-colors"
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
                        className="flex-1 py-2 rounded-xl text-xs text-text-muted hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                      <NeonButton
                        variant="green"
                        size="sm"
                        loading={changingPassword}
                        onClick={handleChangePassword}
                        disabled={!isPasswordValid(newPassword) || confirmPassword.length === 0}
                        className="flex-1"
                      >
                        Save password
                      </NeonButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-white/8" />

          {/* Sign out */}
          <NeonButton variant="danger" loading={signingOut} onClick={handleSignOut} className="w-full">
            Sign out
          </NeonButton>

        </GlassCard>
      </section>

      <div className="sm:hidden pt-2 text-center">
        <button onClick={() => setShowPolicy(true)} className="text-text-muted text-xs opacity-40 hover:opacity-70 transition-opacity">
          {t('policyTerms')}
        </button>
      </div>

      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </div>
  );
}
