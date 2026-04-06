import { useState } from 'react';
import { motion } from 'framer-motion';
import { MatchCard } from './MatchCard';
import { Match, Prediction } from '../../lib/supabase';
import { PredictionData } from './PredictionForm';

interface MatchCardV2Props {
  match: Match;
  prediction?: Prediction;
  predictors?: { user_id: string; avatar_url: string | null; username: string }[];
  onSavePrediction: (data: PredictionData) => Promise<void>;
  savingMatchId: string | null;
}

// ─── MatchCardV2 ─────────────────────────────────────────────────────────────
// Diagonal shimmer sweep on hover — a streak of light passes across the card
// once per hover entry. Card never moves; forms stay fully comfortable.
// ─────────────────────────────────────────────────────────────────────────────
export function MatchCardV2({
  match,
  prediction,
  predictors = [],
  onSavePrediction,
  savingMatchId,
}: MatchCardV2Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MatchCard
        match={match}
        prediction={prediction}
        predictors={predictors}
        onSavePrediction={onSavePrediction}
        savingMatchId={savingMatchId}
      />

      {/* Shimmer streak — sweeps diagonally once on hover entry */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={false}
        animate={hovered ? { x: '220%' } : { x: '-80%' }}
        transition={
          hovered
            ? { duration: 0.55, ease: 'easeOut' as const }
            : { duration: 0 }
        }
        style={{
          width: '45%',
          background:
            'linear-gradient(105deg, transparent 20%, rgba(189,232,245,0.09) 50%, transparent 80%)',
          skewX: '-15deg',
        }}
      />
    </div>
  );
}
