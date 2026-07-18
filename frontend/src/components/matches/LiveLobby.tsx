import { useLiveReactions } from '../../hooks/useLiveReactions';
import { ReactionEngine } from '../effects/ReactionEngine';
import { LiveActivityTicker } from '../ui/LiveActivityTicker';

interface LiveLobbyProps {
  matchId: string;
}

/**
 * V5 Sprint 39 — "The Live Lobby". Composite root for a single live
 * match's ephemeral reaction stream: one useLiveReactions() instance
 * owns the particle queue + ticker state for this MatchCard, mounted/
 * unmounted with the card itself — reset for free the moment the match
 * center closes, since there's nothing to explicitly clear. Rendered
 * `isLive`-gated in MatchCard.tsx, directly below MatchMomentumFlow (the
 * Match Pressure Graph, §32) and MatchMomentumPulse. Nothing here is ever
 * written to Postgres — see RealtimeProvider.tsx's broadcast-transport
 * comment and CLAUDE.md §53.
 *
 * The ReactionChipRow (Commit 3) is the sole caller of `fireReaction` —
 * this component stays a pure display root plus the queue/ticker plumbing
 * until then.
 */
export function LiveLobby({ matchId }: LiveLobbyProps) {
  const { queueRef, tickerEvents } = useLiveReactions(matchId);

  return (
    <div className="relative mt-2" data-live-lobby-root>
      {/* Canvas overlay — absolutely positioned over this wrapper,
          anchored to its bottom edge but taller than it (240px), so
          particles genuinely rise "up the side of the Match Center"
          (visually overlapping the stats/pressure-graph content above)
          rather than being confined to this small ticker strip's own
          box. Clips at the card's own rounded-corner boundary, which
          reads as correct/expected — the effect is scoped to this card,
          not the viewport (unlike CoinsRainCanvas's deliberate full-
          viewport scope for a rarer, app-wide celebration). */}
      <ReactionEngine matchId={matchId} queueRef={queueRef} />
      <LiveActivityTicker events={tickerEvents} />
    </div>
  );
}
