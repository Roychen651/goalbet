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
import { FOOTBALL_LEAGUES } from '../lib/constants';
import { cn } from '../lib/utils';

export function SettingsPage() {
  const { groups, activeGroupId, setActiveGroup, updateGroupLeagues, leaveGroup } = useGroupStore();
  const { user } = useAuthStore();
  const { addToast, openModal } = useUIStore();
  const { t } = useLangStore();
  const [savingLeagues, setSavingLeagues] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const { syncing, lastSynced, triggerSync } = useMatchSync(
    activeGroup?.active_leagues ?? [],
    999, // don't auto-trigger in settings — manual only
  );
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>(
    activeGroup?.active_leagues ?? []
  );

  const toggleLeague = (id: number) => {
    setSelectedLeagues(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleSaveLeagues = async () => {
    if (!activeGroupId) return;
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
      <h1 className="font-bebas text-2xl tracking-wider text-white">{t('settings')}</h1>

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
          {/* Invite code */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('inviteFriends')}</h2>
            <InviteCodeDisplay code={activeGroup.invite_code} groupName={activeGroup.name} />
          </section>

          {/* Group members */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">
              {t('groupMembers')}
            </h2>
            <GroupMembersList groupId={activeGroup.id} />
          </section>

          {/* Group switcher + leave */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('switchGroup')}</h2>
            <div className="space-y-2">
              {groups.map(group => (
                <div key={group.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 w-full px-4 py-3 rounded-xl border transition-all',
                      group.id === activeGroupId
                        ? 'bg-accent-green/10 border-accent-green/30'
                        : 'bg-white/5 border-white/10'
                    )}
                  >
                    <button
                      onClick={() => {
                        setActiveGroup(group.id);
                        setSelectedLeagues(group.active_leagues);
                      }}
                      className="flex-1 text-start"
                    >
                      <div className={cn('font-medium text-sm', group.id === activeGroupId ? 'text-accent-green' : 'text-white')}>
                        {group.name}
                      </div>
                      <div className="text-xs opacity-60 text-white">{group.active_leagues.length} {t('leagues')}</div>
                    </button>

                    {/* Leave button */}
                    <button
                      onClick={() => setConfirmLeaveId(group.id)}
                      className="text-text-muted hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-red-400/10 transition-all"
                    >
                      {t('leaveGroup')}
                    </button>
                  </div>

                  {/* Confirm leave */}
                  <AnimatePresence>
                    {confirmLeaveId === group.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                          <span className="text-white/80 text-xs">{t('leaveGroupConfirm')}</span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setConfirmLeaveId(null)}
                              className="text-text-muted text-xs hover:text-white px-2 py-1 rounded"
                            >
                              {t('cancel')}
                            </button>
                            <NeonButton
                              variant="danger"
                              size="sm"
                              loading={leavingGroupId === group.id}
                              onClick={() => handleLeaveGroup(group.id)}
                            >
                              {t('confirmLeave')}
                            </NeonButton>
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
                <p className="text-white text-sm font-medium">Sync Matches</p>
                <p className="text-text-muted text-xs mt-0.5">
                  {lastSynced
                    ? `Last synced: ${lastSynced.toLocaleTimeString()}`
                    : 'Pull latest fixtures from TheSportsDB'}
                </p>
              </div>
              <NeonButton
                variant="ghost"
                size="sm"
                loading={syncing}
                onClick={triggerSync}
              >
                {syncing ? 'Syncing…' : '⟳ Sync Now'}
              </NeonButton>
            </GlassCard>
          </section>

          {/* League selection */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-text-muted text-xs uppercase tracking-wider">
                {t('activeLeagues')} ({selectedLeagues.length})
              </h2>
              <NeonButton
                variant="green"
                size="sm"
                loading={savingLeagues}
                onClick={handleSaveLeagues}
                disabled={JSON.stringify([...selectedLeagues].sort()) === JSON.stringify([...activeGroup.active_leagues].sort())}
              >
                {t('save')}
              </NeonButton>
            </div>
            <GlassCard className="p-4">
              <div className="flex flex-wrap gap-2">
                {FOOTBALL_LEAGUES.map(league => (
                  <button
                    key={league.id}
                    onClick={() => toggleLeague(league.id)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-sm font-medium transition-all border',
                      selectedLeagues.includes(league.id)
                        ? 'bg-accent-green/15 border-accent-green text-accent-green'
                        : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {league.badge} {league.name}
                  </button>
                ))}
              </div>
            </GlassCard>
          </section>

          {/* More groups */}
          <section>
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('moreGroups')}</h2>
            <div className="flex gap-3">
              <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('createGroup')}>
                {t('newGroup')}
              </NeonButton>
              <NeonButton variant="ghost" size="sm" className="flex-1" onClick={() => openModal('joinGroup')}>
                {t('joinGroupShort')}
              </NeonButton>
            </div>
          </section>
        </>
      )}

      {/* Policy — visible on mobile (sidebar not shown) */}
      <div className="sm:hidden pt-2 text-center">
        <button
          onClick={() => setShowPolicy(true)}
          className="text-text-muted text-xs opacity-40 hover:opacity-70 transition-opacity"
        >
          {t('policyTerms')}
        </button>
      </div>

      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}
    </div>
  );
}
