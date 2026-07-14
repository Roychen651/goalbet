import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TiltState {
  gyroscopeEnabled: boolean;
  setGyroscopeEnabled: (enabled: boolean) => void;
}

/**
 * Sprint 16 Commit 3 — the user's own opt-in for gyroscope-driven card tilt,
 * separate from the browser's permission grant (requestTiltPermission in
 * lib/tiltPermission.ts). A user can grant the OS-level permission once and
 * still want this off later; this is that independent preference, persisted
 * the same way theme/lang already are.
 */
export const useTiltStore = create<TiltState>()(
  persist(
    (set) => ({
      gyroscopeEnabled: false,
      setGyroscopeEnabled: (gyroscopeEnabled) => set({ gyroscopeEnabled }),
    }),
    { name: 'goalbet-tilt' },
  ),
);
