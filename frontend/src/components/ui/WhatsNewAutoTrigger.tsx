import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { hasSeenCurrentShowcase, markShowcaseSeen } from '../../lib/whatsNewContent';

// V5 Sprint 38 — self-contained auto-trigger for the Epoch Showcase,
// mirroring WelcomeAnimation.tsx's own shape exactly: a component mounted
// unconditionally in AppShell that owns its own useAuthStore() gate and
// decides internally whether to act, rather than growing AppShell's already
// large body with more inline auth-gated effects (rule 4.3 scopes AppShell
// to auto-SYNC specifically — this mirrors an existing sibling pattern,
// not a new one).
//
// Delayed ~3.2s past mount, deliberately after WelcomeAnimation's own
// ~2.8s auto-dismiss window — two full-screen overlays racing to appear at
// the same instant would look broken, not premium. This is a one-shot,
// versioned reveal (localStorage, persists across sessions), unlike
// WelcomeAnimation's per-session sessionStorage splash — different
// mechanisms for a genuinely different cadence (every login vs. once per
// showcase version).
export function WhatsNewAutoTrigger() {
  const { profile } = useAuthStore();
  const openModal = useUIStore(s => s.openModal);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!profile || firedRef.current) return;
    if (hasSeenCurrentShowcase()) return;

    firedRef.current = true;
    const t = setTimeout(() => {
      openModal('whatsNew');
      markShowcaseSeen();
    }, 3200);
    return () => clearTimeout(t);
  }, [profile, openModal]);

  return null;
}
