import { motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { useGlobalArena } from '../../hooks/useGlobalArena';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { CosmeticAvatar } from '../ui/CosmeticAvatar';
import { EmptyState } from '../ui/EmptyState';
import { GlassCard } from '../ui/GlassCard';
import { InfoTip } from '../ui/InfoTip';
import { arenaDivisionColor, type ArenaDivision } from '../../lib/oklch';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

// V6 Sprint 48 — "The Global Arena." Deliberately a SEPARATE component from
// LeaderboardTable/LeaderboardRow, not a 4th value squeezed into
// LeaderboardType — global_user_standings has a fundamentally different
// shape (no group_id, no weekly_points-vs-last_week_points concept, no
// Realtime subscription since the source is a 15-min-refreshed
// materialized view) from the per-group leaderboard those components are
// built around. Reuses this app's established visual language
// (GlassCard, CosmeticAvatar, font-mono tabular-nums for live-changing
// numbers) without forcing a foreign data shape into an existing
// component built for a different one.

const DIVISION_META: Record<ArenaDivision, { emoji: string; labelKey: TranslationKey }> = {
  diamond: { emoji: '💎', labelKey: 'arenaDivisionDiamond' },
  gold: { emoji: '🥇', labelKey: 'arenaDivisionGold' },
  silver: { emoji: '🥈', labelKey: 'arenaDivisionSilver' },
  bronze: { emoji: '🥉', labelKey: 'arenaDivisionBronze' },
};

export function GlobalArenaView() {
  const { entries, myRank, loading } = useGlobalArena();
  const { user } = useAuthStore();
  const { t } = useLangStore();

  if (loading) {
    // Fixed-height skeleton rows — zero-CLS while the first fetch resolves,
    // same discipline as MatchCardSkeleton elsewhere in this app.
    return (
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="🌍"
        title={t('arenaEmptyTitle')}
        description={t('arenaEmptyDesc')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {myRank != null && (
        <GlassCard variant="elevated" className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1 text-text-muted text-[10px] uppercase tracking-wider mb-1">
              {t('yourGlobalRank')}
              <InfoTip text={t('infoGlobalRank')} />
            </div>
            <div className="font-bebas text-2xl text-accent-green text-glow-green">#{myRank}</div>
          </div>
          <div className="text-end">
            <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{t('avgPointsShort')}</div>
            <div className="font-mono tabular-nums text-xl text-white">
              <NumberFlow value={entries.find((e) => e.user_id === user?.id)?.avg_points_per_prediction ?? 0} />
            </div>
          </div>
        </GlassCard>
      )}

      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const isMe = entry.user_id === user?.id;
          const division = DIVISION_META[entry.arena_division];
          const divisionColor = arenaDivisionColor(entry.arena_division);
          return (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx, 12) * 0.02 }}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-2xl border transition-colors',
                isMe
                  ? 'bg-accent-green/10 border-accent-green/30'
                  : 'bg-white/4 border-white/8',
              )}
            >
              <span className="font-mono tabular-nums text-sm text-text-muted w-7 text-center shrink-0">
                {idx + 1}
              </span>

              <div
                className="relative shrink-0"
                style={{ boxShadow: `0 0 0 2px ${divisionColor}` }}
              >
                <CosmeticAvatar
                  src={entry.avatar_url}
                  name={entry.username}
                  size="sm"
                  activeCosmetics={entry.active_cosmetics}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {/* dir="auto" — an English/Latin username inside an
                      RTL-ancestor row would otherwise truncate from the
                      CONTAINER's logical end (visually the left), cutting
                      "Dani Cohen" to "...ohen" instead of "Dani C...".
                      dir="auto" lets the browser derive this span's own
                      paragraph direction from its actual content, so
                      truncation always happens at the text's own natural
                      end regardless of the ancestor's direction. */}
                  <span dir="auto" className="text-sm font-semibold text-text-primary truncate">{entry.username}</span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                    style={{
                      color: divisionColor,
                      background: `color-mix(in oklch, ${divisionColor} 16%, var(--color-bg-card))`,
                      border: `1px solid color-mix(in oklch, ${divisionColor} 35%, transparent)`,
                    }}
                  >
                    {division.emoji} {t(division.labelKey)}
                  </span>
                </div>
                <p className="text-text-muted text-[11px] font-mono tabular-nums">
                  {entry.total_points} {t('pts')} · {entry.resolved_predictions} {t('arenaPicksSuffix')}
                </p>
              </div>

              <div className="text-end shrink-0">
                <div className="font-mono tabular-nums text-lg text-white">
                  {entry.avg_points_per_prediction?.toFixed(2) ?? '—'}
                </div>
                <div className="text-white/30 text-[9px] uppercase tracking-wider">{t('avgPointsShort')}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
