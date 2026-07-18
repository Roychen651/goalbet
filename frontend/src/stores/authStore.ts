import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { withAuthTimeout, rejectOnTimeout } from '../lib/asyncTimeout';

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
  updateGender: (gender: 'male' | 'female' | 'unspecified') => Promise<void>;
  init: () => () => void; // returns cleanup fn
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  init: () => {
    // Production incident fix — supabase.auth.getSession() had NO timeout
    // and NO .catch() at all. If that call ever just hangs (a Supabase
    // network hiccup, not even a full outage) instead of erroring, this
    // Promise never settles — `loading` stays true and `initialized` stays
    // false FOREVER, leaving every user stuck on PageLoader indefinitely.
    // This is exactly the "never let a fetch hang unbounded" violation
    // this codebase enforces everywhere else (AppShell's AbortController
    // timeouts, §9/§21/§36) — this one call had slipped through with none.
    // Fixed by racing the real call against a timeout that forces the app
    // past the loading gate (treated as "no session yet," same as an
    // anonymous visitor) instead of hanging forever. If the real session
    // data arrives later, `onAuthStateChange` below (already subscribed in
    // parallel, independent of this race) self-heals the state once
    // Supabase's own SDK resolves it — the timeout is only an escape
    // hatch, never a permanent wrong answer.
    const SESSION_TIMEOUT_MS = 8000;
    const timeout = new Promise<{ data: { session: null } }>((resolve) => {
      setTimeout(() => resolve({ data: { session: null } }), SESSION_TIMEOUT_MS);
    });

    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data: { session } }) => {
        set({ session, user: session?.user ?? null, loading: false, initialized: true });
        if (session?.user) get().fetchProfile();
      })
      .catch(() => {
        // A genuine rejection (not just a hang) must never leave the app
        // stuck on the loading gate either — fail toward "logged out,"
        // always safely recoverable (retry sign-in), never toward an
        // infinite spinner.
        set({ session: null, user: null, loading: false, initialized: true });
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
    // rejectOnTimeout, not withAuthTimeout — this method already uses
    // throw-on-error semantics (useAuthV2.handleGoogleSignIn already has
    // a real try/catch around this exact call), so a rejection after 10s
    // is caught there the same way any other failure already is, instead
    // of leaving the button spinning forever with no recovery path.
    const { error } = await rejectOnTimeout(
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      }),
    );
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

  updateGender: async (gender: 'male' | 'female' | 'unspecified') => {
    const { user } = get();
    if (!user) return;
    // Direct client write, same shape as updateUsername — profiles is
    // already owner-writable under existing RLS (auth.uid() = id), no new
    // RPC needed for a plain profile-field update.
    const { data, error } = await supabase
      .from('profiles')
      .update({ gender })
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

    // A logged-in user with a stuck fetchProfile() is stuck in a
    // different but equally real way (session exists, profile stays null
    // forever — every page that gates on `profile` hangs). Same timeout
    // discipline as getSession()/signInWithGoogle() above; a genuine
    // failure/timeout here just means the profile stays null and the
    // (already-idempotent, safe-to-retry) fetch can be attempted again
    // later — never an infinite await.
    const { data, error } = await withAuthTimeout(
      Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()),
    );

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
      const { data: created } = await withAuthTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .insert({ id: user.id, username, avatar_url: user.user_metadata?.avatar_url ?? null })
            .select()
            .single(),
        ),
      );
      if (created) set({ profile: created });
    }
  },
}));
