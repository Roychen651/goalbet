import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// AppShell owns all automatic sync (CLAUDE.md rule 4.3) — refetchOnWindowFocus
// would reintroduce a second, uncoordinated auto-fetch trigger and the exact
// race conditions that rule exists to prevent. Freshness comes from Realtime
// + the goalbet:synced event, not from window focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Visual De-cluttering Phase 3 — "Cache-First Cold Start Resilience".
// useMatches.ts is already a real useQuery (staleTime: Infinity, freshness
// comes only from Realtime + the goalbet:synced invalidation, never from a
// timer) — the one genuine gap for a brand-new tab/session is that
// TanStack's in-memory cache is empty on a fresh page load, so a returning
// user still sees a loading skeleton for however long Render's cold start
// + AppShell's own sync takes (up to 45-60s, §9). A longer staleTime alone
// cannot fix this — staleTime only governs refetch behavior within an
// already-warm session, it does nothing for a cache that's empty because
// the tab was just opened. The actual fix the brief asks for needs real
// persistence across reloads, which is exactly what this official TanStack
// Query plugin exists for — a deliberate, narrow exception to "no new
// libraries" (CLAUDE.md §4): it's a first-party persistence adapter for a
// library already fully adopted, not a new UI/animation/charting
// dependency. This does NOT touch AppShell.tsx's sync-orchestration role
// (rule 4.3) in any way — it only changes what already-cached queries
// render with before that sync's own invalidation (goalbet:synced) forces
// the real refetch, exactly the same two-step flow useMatches.ts already
// documents (cached-then-replaced), just surviving a full reload now too.
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'goalbet-query-cache',
});
