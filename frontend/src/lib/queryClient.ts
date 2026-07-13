import { QueryClient } from '@tanstack/react-query';

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
