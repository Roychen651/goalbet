import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  init: () => () => void; // returns cleanup fn
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  init: () => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, loading: false, initialized: true });
      if (session?.user) get().fetchProfile();
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          get().fetchProfile();
        } else {
          set({ profile: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  },

  updateAvatar: async (avatarUrl: string) => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data) set({ profile: data });
  },


  updateUsername: async (username: string) => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data) set({ profile: data });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      set({ profile: data });
      return;
    }

    // PGRST116 = no rows — trigger may have failed; create profile manually
    if (error?.code === 'PGRST116') {
      const username =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'player';
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, username, avatar_url: user.user_metadata?.avatar_url ?? null })
        .select()
        .single();
      if (created) set({ profile: created });
    }
  },
}));
