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
import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { PredictionForm, PredictionData } from './PredictionForm';
import type { Match, Prediction } from '../../lib/supabase';

interface PredictionModalProps {
  matches: Match[];
  predictions: Map<string, Prediction>;
  onSave: (data: PredictionData) => Promise<void>;
  /** Match ID currently being saved, or null */
  savingMatchId: string | null;
  /** ESPN odds keyed by match ID */
  espnOdds?: Map<string, { homeWin: number; draw: number; awayWin: number }>;
}

export function PredictionModal({ matches, predictions, onSave, savingMatchId, espnOdds }: PredictionModalProps) {
  const matchId = useUIStore(s => s.activePredictionMatchId);
  const close = useUIStore(s => s.closePredictionModal);
  const { t } = useLangStore();

  const match = matchId ? matches.find(m => m.id === matchId) : null;
  const prediction = matchId ? predictions.get(matchId) : undefined;

  return (
    <Drawer.Root
      open={!!match}
      onOpenChange={(open) => { if (!open) close(); }}
    >
      <Drawer.Portal>
        {/* Light blur only — heavy blur re-composites every frame during the slide
            and caused the lower rows to flicker on open. */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88vh] flex-col rounded-t-2xl outline-none sm:max-w-[460px]"
          style={{
            background: 'var(--color-tooltip-bg)',
            border: '1px solid var(--card-border)',
            borderBottom: 'none',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.5)',
          }}
        >
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
                onClick={close}
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
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
