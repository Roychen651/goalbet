import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, Group } from '../lib/supabase';

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  loading: boolean;
  setActiveGroup: (id: string) => void;
  fetchGroups: (userId: string) => Promise<void>;
  createGroup: (name: string, activeLeagues: number[]) => Promise<Group>;
  joinGroup: (inviteCode: string, userId: string) => Promise<Group>;
  leaveGroup: (groupId: string, userId: string) => Promise<void>;
  updateGroupLeagues: (groupId: string, leagueIds: number[]) => Promise<void>;
  updateGroupName: (groupId: string, name: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      activeGroupId: null,
      loading: false,

      setActiveGroup: (id) => set({ activeGroupId: id }),

      fetchGroups: async (userId) => {
        set({ loading: true });
        try {
          // Get group IDs where user is a member
          const { data: memberData, error: memberError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId);

          if (memberError || !memberData) {
            set({ loading: false });
            return;
          }

          const groupIds = memberData.map(m => m.group_id);
          if (groupIds.length === 0) {
            set({ groups: [], activeGroupId: null, loading: false });
            return;
          }

          const { data: groups, error: groupError } = await supabase
            .from('groups')
            .select('*')
            .in('id', groupIds);

          if (groupError) {
            set({ loading: false });
            return;
          }

          const loadedGroups = groups ?? [];
          const currentId = get().activeGroupId;
          // Fix stale activeGroupId: if persisted ID no longer exists in DB, switch to first group
          const isValidId = !!currentId && loadedGroups.some(g => g.id === currentId);

          set({
            groups: loadedGroups,
            loading: false,
            activeGroupId: isValidId ? currentId : (loadedGroups[0]?.id ?? null),
          });
        } catch {
          set({ loading: false });
        }
      },

      createGroup: async (name, activeLeagues) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Ensure profile row exists before inserting group (FK constraint: groups.created_by → profiles.id)
        const { error: profileCheckErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (profileCheckErr?.code === 'PGRST116') {
          // Profile missing — create it now (trigger may have failed)
          const username =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'player';
          const { error: createProfileErr } = await supabase
            .from('profiles')
            .upsert({ id: user.id, username, avatar_url: user.user_metadata?.avatar_url ?? null });
          if (createProfileErr) throw new Error(createProfileErr.message);
        }

        // Generate ID client-side so we can insert member before re-reading
        // (avoids RLS issue: groups_read_member blocks SELECT until we're a member)
        const groupId = crypto.randomUUID();

        const { error: groupError } = await supabase
          .from('groups')
          .insert({ id: groupId, name, active_leagues: activeLeagues, created_by: user.id });

        if (groupError) throw new Error(groupError.message);

        // Add creator as member first, then we can read the group
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({ group_id: groupId, user_id: user.id });

        if (memberError) throw new Error(memberError.message);

        // Now fetch the group (RLS allows it since we're a member)
        const { data: group, error: fetchError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single();

        if (fetchError || !group) throw new Error(fetchError?.message ?? 'Failed to fetch created group');

        set(state => ({
          groups: [...state.groups, group],
          activeGroupId: group.id,
        }));

        return group;
      },

      joinGroup: async (inviteCode, userId) => {
        // Ensure profile exists for new users (trigger may have failed on first login)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: profileCheckErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();
          if (profileCheckErr?.code === 'PGRST116') {
            const username =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'player';
            await supabase
              .from('profiles')
              .upsert({ id: user.id, username, avatar_url: user.user_metadata?.avatar_url ?? null });
          }
        }

        // Find group by invite code — uses SECURITY DEFINER RPC to bypass RLS
        // (direct table SELECT is blocked because user isn't a member yet)
        const { data: groupData, error: groupError } = await supabase
          .rpc('find_group_by_invite_code', { p_code: inviteCode });

        const group = (groupData as Group[] | null)?.[0] ?? null;
        if (groupError) throw new Error(`Group lookup failed: ${groupError.message}`);
        if (!group) throw new Error('Group not found. Check the invite code.');

        // Check if already a member
        const { data: existing } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', group.id)
          .eq('user_id', userId)
          .single();

        if (existing) {
          // Already a member — just switch to this group
          set(state => ({
            activeGroupId: group.id,
            groups: state.groups.some(g => g.id === group.id)
              ? state.groups
              : [...state.groups, group],
          }));
          return group;
        }

        // Join the group
        const { error: joinError } = await supabase
          .from('group_members')
          .insert({ group_id: group.id, user_id: userId });

        if (joinError) throw new Error(joinError.message);

        set(state => ({
          groups: [...state.groups, group],
          activeGroupId: group.id,
        }));

        return group;
      },

      leaveGroup: async (groupId, userId) => {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);

        if (error) throw error;

        set(state => {
          const newGroups = state.groups.filter(g => g.id !== groupId);
          return {
            groups: newGroups,
            activeGroupId: state.activeGroupId === groupId
              ? (newGroups[0]?.id ?? null)
              : state.activeGroupId,
          };
        });
      },

      updateGroupLeagues: async (groupId, leagueIds) => {
        const { data, error } = await supabase
          .from('groups')
          .update({ active_leagues: leagueIds })
          .eq('id', groupId)
          .select()
          .single();

        if (error) throw error;

        set(state => ({
          groups: state.groups.map(g => g.id === groupId ? data : g),
        }));
      },

      updateGroupName: async (groupId, name) => {
        const { data, error } = await supabase
          .from('groups')
          .update({ name })
          .eq('id', groupId)
          .select()
          .single();
        if (error) throw error;
        set(state => ({
          groups: state.groups.map(g => g.id === groupId ? data : g),
        }));
      },
    }),
    {
      name: 'goalbet-group',
      partialize: (state) => ({ activeGroupId: state.activeGroupId }),
    }
  )
);
