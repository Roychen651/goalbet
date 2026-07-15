/**
 * PredictionModal — native-feel bottom sheet for the PredictionForm, powered by
 * Vaul (iOS-grade drag physics, velocity dismiss, inner-scroll aware).
 *
 * Reads `activePredictionMatchId` from uiStore.
 * Match/prediction data passed in from HomePage (where the hooks live).
 *
 * Vaul handles the drag-to-close + inner scroll natively, so the old
 * CLAUDE.md 4.13 Framer drag hack (onPointerDown stopPropagation) is no longer
 * needed — Vaul detects scroll position and only drags from the top / handle.
 */

import { Drawer } from 'vaul';
import { AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PredictionForm, PredictionData } from './PredictionForm';
import { PredictionCardDesktop } from './PredictionCardDesktop';
import { haptic } from '../../lib/haptics';
import type { Match, Prediction } from '../../lib/supabase';

interface PredictionModalProps {
  matches: Match[];
  predictions: Map<string, Prediction>;
  onSave: (data: PredictionData) => Promise<void>;
  /** Match ID currently being saved, or null */
  savingMatchId: string | null;
  /** ESPN odds keyed by match ID */
  espnOdds?: Map<string, { homeWin: number; draw: number; awayWin: number }>;
  /** First-timer → lock advanced tiers behind the frosted overlay */
  isNewUser?: boolean;
}

export function PredictionModal({ matches, predictions, onSave, savingMatchId, espnOdds, isNewUser }: PredictionModalProps) {
  const matchId = useUIStore(s => s.activePredictionMatchId);
  const close = useUIStore(s => s.closePredictionModal);
  const { t } = useLangStore();
  // Matches Tailwind's own `sm:` breakpoint so this never becomes a second,
  // drifting definition of "desktop" alongside the CSS.
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const match = matchId ? matches.find(m => m.id === matchId) : null;
  const prediction = matchId ? predictions.get(matchId) : undefined;

  // Vaul is a drawer-only library — it has no centered-dialog mode, so
  // desktop gets a separate small Framer Motion dialog instead. Mobile's
  // Drawer.Root below is untouched by this branch.
  if (isDesktop) {
    return (
      <AnimatePresence>
        {match && (
          <PredictionCardDesktop
            match={match}
            prediction={prediction}
            onSave={onSave}
            saving={savingMatchId === match.id}
            odds={espnOdds?.get(match.id) ?? undefined}
            isNewUser={isNewUser}
            onClose={close}
          />
        )}
      </AnimatePresence>
    );
  }

  return (
    <Drawer.Root
      open={!!match}
      onOpenChange={(open) => { if (!open) close(); }}
    >
      <Drawer.Portal>
        {/* Light blur only — heavy blur re-composites every frame during the slide
            and caused the lower rows to flicker on open. Deliberately left alone
            (Sprint 20): this is a full-viewport overlay, not the small sheet
            surface below, and the flicker was already diagnosed here once. */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        {/* max-h-[85dvh] (was 88vh) — dvh tracks the actual visible viewport as
            iOS/Android browser chrome collapses or expands; vh is pinned to the
            largest possible viewport and can clip under a still-visible address
            bar. card-elevated brings the same deeper blur/saturate + border
            tokens GlassCard's 'elevated' variant already uses elsewhere — reused,
            not reinvented. The upward box-shadow stays a hand-tuned inline
            override (card-elevated's own shadow is downward-facing, wrong
            direction for a sheet anchored to the bottom of the screen). No
            gradient-edge ring here on purpose — that technique draws a full
            4-side border and this sheet has no bottom edge (it's flush with /
            extends below the viewport), so a ring would look wrong on the one
            side that shouldn't have one. */}
        <Drawer.Content
          className="card-elevated fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] flex-col rounded-t-2xl outline-none sm:max-w-[460px] relative overflow-hidden"
          style={{
            borderBottom: 'none',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div className="glass-grain" />
          <div className="relative z-10 flex flex-col min-h-0 flex-1">
            {/* Grabber handle */}
            <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-text-muted/40" />

            {/* Header */}
            {match && (
              <div
                className="flex items-center justify-between px-4 pt-3 pb-2.5"
                style={{ borderBottom: '1px solid var(--card-border)' }}
              >
                <div className="flex min-w-0 flex-col">
                  <Drawer.Title className="truncate text-sm font-bold text-text-primary">
                    {match.home_team} vs {match.away_team}
                  </Drawer.Title>
                  <span className="truncate text-[10px] text-text-muted opacity-60">
                    {match.league_name}
                    {match.round ? ` · R${match.round}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => { haptic('light'); close(); }}
                  aria-label={t('close')}
                  className="ms-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/8 hover:text-text-primary"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Scrollable prediction form — Vaul is scroll-aware, no drag hack needed.
                Generous bottom padding (+ iOS safe area) lifts the CTA off the screen
                edge so it's comfortably tappable, not jammed against the home bar. */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]"
              data-vaul-no-drag
            >
              {match && (
                <PredictionForm
                  match={match}
                  existingPrediction={prediction}
                  onSave={async (data) => {
                    await onSave(data);
                    close();
                  }}
                  saving={savingMatchId === match.id}
                  odds={espnOdds?.get(match.id) ?? undefined}
                  isNewUser={isNewUser}
                />
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
