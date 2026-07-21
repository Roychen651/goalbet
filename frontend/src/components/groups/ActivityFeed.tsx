import { useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, Swords, Repeat2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLangStore } from '../../stores/langStore';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useUIStore } from '../../stores/uiStore';
import { useGroupEvents, type GroupEvent } from '../../hooks/useGroupEvents';
import { CosmeticAvatar } from '../ui/CosmeticAvatar';
import { EmptyState } from '../ui/EmptyState';
import { cn, timeAgo } from '../../lib/utils';
import { CoinIcon } from '../ui/CoinIcon';
import { tg, type TranslationKey } from '../../lib/i18n';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { triggerCoinsRain } from '../effects/CoinsRainCanvas';
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

// V5 Sprint 36 — module-level, session-lifetime set of WON_COINS event ids
// that have already fired the coins-rain celebration. A per-render trigger
// (inside a plain useEffect keyed on event.id) would replay the rain on
// every mount/re-render of an already-seen event; this bounds it to "once
// per genuinely new pool-payout event this browser tab has ever rendered" —
// the same "don't replay feedback that already fired" restraint CLAUDE.md
// §33 established for CelebrationManager, applied here without needing a
// second persisted watermark (a pool payout is a rare, occasional event —
// unlike streak wins, there's no risk of this set growing unbounded within
// one session).
const celebratedPoolPayouts = new Set<string>();

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Stagger animation variants ───────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

// ── Main component ───────────────────────────────────────────────────────────

export function ActivityFeed() {
  const { t } = useLangStore();
  const { events, loading } = useGroupEvents();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="🏟️"
        title={t('lockerRoomEmpty')}
      />
    );
  }

  return (
    <div className="relative">
      {/* Glowing vertical timeline track */}
      <div
        className="absolute start-5 top-0 bottom-0 w-px"
        style={{
          background: 'linear-gradient(to bottom, var(--color-accent-green), transparent)',
          opacity: 0.2,
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} t={t} />
        ))}
      </motion.div>
    </div>
  );
}

// ── Individual event card ────────────────────────────────────────────────────

function EventCard({ event, t }: { event: GroupEvent; t: (k: TranslationKey) => string }) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  // AI banter has its own premium broadcast card — MICRO_BANTER (Sprint 14)
  // reuses it verbatim: same metadata shape (text_en/text_he/home_team/
  // away_team), same "AI Scout" visual identity, no reason for a second card.
  if (event.event_type === 'AI_BANTER' || event.event_type === 'MICRO_BANTER') {
    return <AiBanterCard event={event} t={t} />;
  }

  const isPrediction = event.event_type === 'PREDICTION_LOCKED';
  const isWon = event.event_type === 'WON_COINS';
  const isPoolContribution = event.event_type === 'POOL_CONTRIBUTION';
  const isBattleProgress = event.event_type === 'BATTLE_PROGRESS';
  const meta = event.metadata;
  const isPoolPayout = isWon && meta.is_pool_payout === true;

  // V5 Sprint 36 — the moment a genuinely new pool-payout WON_COINS event
  // renders for the first time, fire the coins-rain celebration. Bounded by
  // the module-level `celebratedPoolPayouts` set (see its own comment
  // above) so re-renders/re-mounts of an already-seen event never replay it.
  useEffect(() => {
    if (isPoolPayout && !celebratedPoolPayouts.has(event.id)) {
      celebratedPoolPayouts.add(event.id);
      triggerCoinsRain();
    }
  }, [isPoolPayout, event.id]);

  // Match info from joined data (matches table) — preferred over metadata
  const homeTeamEn = event.home_team || String(meta.home_team ?? '');
  const awayTeamEn = event.away_team || String(meta.away_team ?? '');
  const homeTeam = lang === 'he' && homeTeamEn ? tTeam(homeTeamEn) : homeTeamEn;
  const awayTeam = lang === 'he' && awayTeamEn ? tTeam(awayTeamEn) : awayTeamEn;
  const homeBadge = event.home_team_badge;
  const awayBadge = event.away_team_badge;
  const hasMatch = !!(homeTeam && awayTeam);

  // Glow styles per event type
  const glowClass = isPrediction
    ? 'shadow-[0_0_15px_rgba(96,165,250,0.18)] border-blue-400/20'
    : isWon
      ? 'shadow-[0_0_20px_rgba(var(--color-accent-green-rgb,189,232,245),0.25)] border-accent-green/30'
      : isPoolContribution
        ? 'shadow-[0_0_15px_rgba(245,197,24,0.20)] border-amber-400/20'
        : isBattleProgress
          ? 'shadow-[0_0_15px_rgba(114,144,255,0.20)] border-[color:var(--battle-challenger)]/25'
          : 'shadow-[0_0_15px_rgba(168,85,247,0.18)] border-purple-400/20';

  // Dot color
  const dotClass = isPrediction
    ? 'bg-blue-400 border-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.4)]'
    : isWon
      ? 'bg-accent-green border-accent-green/50 shadow-[0_0_8px_rgba(var(--color-accent-green-rgb,189,232,245),0.5)]'
      : isPoolContribution
        ? 'bg-amber-400 border-amber-400/50 shadow-[0_0_8px_rgba(245,197,24,0.4)]'
        : isBattleProgress
          ? 'bg-[color:var(--battle-challenger)] border-[color:var(--battle-challenger)]/50 shadow-[0_0_8px_rgba(114,144,255,0.4)]'
          : 'bg-purple-400 border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.4)]';

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative ps-10 pe-4 py-3.5',
        'rounded-2xl border backdrop-blur-xl',
        'bg-bg-card/60',
        'transition-all duration-300',
        glowClass,
        isWon && 'animate-pulse-subtle',
      )}
    >
      {/* Timeline dot */}
      <div className={cn('absolute start-3.5 top-5 w-3 h-3 rounded-full border-2 z-10', dotClass)} />

      {/* Header — BATTLE_PROGRESS is a system event (user_id is always null,
          same as AI_BANTER/MICRO_BANTER — no group member "did" a score
          refresh), so it gets a Swords icon in place of a human Avatar
          rather than rendering "Unknown" with a blank avatar. */}
      <div className="flex items-center gap-2.5 mb-2">
        {isBattleProgress ? (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in oklch, var(--battle-challenger) 20%, var(--color-bg-card))' }}
          >
            <Swords size={14} style={{ color: 'var(--battle-challenger)' }} />
          </div>
        ) : (
          <CosmeticAvatar
            src={event.avatar_url}
            name={event.username ?? '?'}
            size="sm"
            activeCosmetics={event.active_cosmetics}
            className="shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary">
            {isBattleProgress ? t('battleTitle') : event.username}
          </span>
          <span className="text-text-muted text-xs ms-2">
            {timeAgo(event.created_at, t)}
          </span>
        </div>
      </div>

      {/* ── PREDICTION_LOCKED ─────────────────────────────────────────────── */}
      {isPrediction && (
        <div className="space-y-2">
          {/* Action line */}
          <p className="text-sm text-text-primary/80">
            {t('activityPredictionLocked')}
            {meta.tiers_count ? (
              <span className="text-text-muted text-xs ms-1">
                · {String(meta.tiers_count)} {isHe ? 'שלבים' : 'tiers'}
              </span>
            ) : null}
            {meta.coins_bet ? (
              <span className="text-amber-400 text-xs ms-1">
                · <CoinIcon size={13} className="inline-block align-[-1px] mx-0.5" />{String(meta.coins_bet)}
              </span>
            ) : null}
          </p>

          {/* Match strip */}
          {hasMatch && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/4 border border-white/6">
              {homeBadge && (
                <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
              <span className="text-text-muted text-[10px] font-barlow uppercase">{isHe ? 'נגד' : 'vs'}</span>
              <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
              {awayBadge && (
                <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
            </div>
          )}

          {/* SECURITY HOTFIX (pre-Sprint-47) — this block used to render
              meta.predicted_outcome/predicted_home_score/predicted_away_score/
              predicted_btts/predicted_over_under/predicted_corners here,
              unconditionally, for every group member, regardless of whether
              the match had kicked off. group_events has no kickoff-time RLS
              gate (unlike predictions, migration 037), so this was a real,
              live leak of every member's exact pre-kickoff pick — see
              usePredictions.ts's own hotfix comment for the full writeup.
              usePredictions.ts no longer writes those fields into metadata
              at all, so removed the render entirely rather than leave dead
              code whose only safety property is "nobody happens to write
              this field anymore" — a future field re-add would silently
              re-open the leak if this block were still here. */}

          {/* V6 Sprint 47 — provenance line for a tail's OWN card (never
              the source card — the source never learns who tailed it,
              matching Blind Tail's one-way design). */}
          {meta.tailed_from_username != null && (
            <p className="text-[11px] text-blue-300/80">
              {t('activityTailedFrom').replace('{0}', String(meta.tailed_from_username))}
            </p>
          )}

          <TailButton event={event} t={t} />
        </div>
      )}

      {/* ── WON_COINS ─────────────────────────────────────────────────────── */}
      {isWon && (
        <div className="space-y-2">
          <p className="text-sm text-text-primary/80">
            💰 {tg(t, 'activityWonCoins', event.gender).replace('{0}', String(meta.points ?? 0)).replace('{1}', String(meta.coins ?? 0))}
            {isPoolPayout && (
              <span className="inline-flex items-center gap-1 ms-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/25 align-middle">
                <Users size={10} /> {t('poolPayoutBadge')}
              </span>
            )}
          </p>

          {/* Match strip */}
          {hasMatch && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-green/5 border border-accent-green/10">
              {homeBadge && (
                <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
              <span className="text-text-muted text-[10px] font-barlow uppercase">{isHe ? 'נגד' : 'vs'}</span>
              <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
              {awayBadge && (
                <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD_CLIMB ─────────────────────────────────────────────── */}
      {event.event_type === 'LEADERBOARD_CLIMB' && (
        <p className="text-sm text-text-primary/80">
          📈 {tg(t, 'activityClimbedRank', event.gender).replace('{0}', String(meta.rank ?? '?'))}
        </p>
      )}

      {/* ── POOL_CONTRIBUTION ──────────────────────────────────────────────
          A real user (event.user_id/username) contributing to (or raising
          their stake in) a Syndicate Pool — a public, cooperative activity
          by design (migration 055's RLS note: pool contributions are
          visible to the whole group immediately, not hidden until kickoff
          like individual predictions). */}
      {isPoolContribution && (
        <div className="space-y-2">
          <p className="text-sm text-text-primary/80">
            <Users size={13} className="inline-block align-[-2px] me-1 text-amber-400" />
            {tg(t, 'activityPoolContribution', event.gender)
              .replace('{0}', String(meta.amount ?? 0))
              .replace('{1}', String(meta.total_staked ?? 0))}
          </p>
          {hasMatch && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/10">
              {homeBadge && (
                <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
              <span className="text-text-muted text-[10px] font-barlow uppercase">{isHe ? 'נגד' : 'vs'}</span>
              <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
              {awayBadge && (
                <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BATTLE_PROGRESS ────────────────────────────────────────────────
          System event (user_id null) — 'started' when the defender accepts
          a challenge, 'final' once the battle window closes (backend
          scheduler, every 30 min — CLAUDE.md §51). Both milestones share
          this one block; only the copy + score line differ. */}
      {isBattleProgress && (
        <div className="space-y-1.5">
          <p className="text-sm text-text-primary/80">
            <Swords size={13} className="inline-block align-[-2px] me-1" style={{ color: 'var(--battle-challenger)' }} />
            {meta.milestone === 'final' ? t('activityBattleFinal') : t('activityBattleStarted')}
          </p>
          {meta.milestone === 'final' && meta.challenger_score != null && meta.defender_score != null && (
            <p className="text-xs font-mono tabular-nums text-text-muted">
              <span style={{ color: 'var(--battle-challenger)' }}>{Number(meta.challenger_score).toFixed(1)}</span>
              {' — '}
              <span style={{ color: 'var(--battle-defender)' }}>{Number(meta.defender_score).toFixed(1)}</span>
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Tail Button (V6 Sprint 47 — "Blind Tail" copy-betting) ──────────────────
// Copies another group member's already-locked prediction via
// submit_copied_prediction() (migration 064). The client NEVER reads or
// sends a pick value — only the source prediction's id (safe: reveals
// nothing about what was predicted, same class as coins_bet/tiers_count).
// The RPC reads the real picks server-side and writes an identical row
// under the tailer's OWN user_id; the tailer only ever learns the result
// once it's their own always-visible row (migration 037's RLS wall never
// has to be crossed from the client side). A 5% win royalty flows back to
// the ROOT creator automatically at resolution time (scoreUpdater.ts) —
// nothing here needs to know about that; it's purely a resolution-time
// concern.
function TailButton({ event, t }: { event: GroupEvent; t: (k: TranslationKey) => string }) {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { addToast } = useUIStore();
  const coinsStore = useCoinsStore();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [tailed, setTailed] = useState(false);

  const meta = event.metadata;
  const sourcePredictionId = meta.prediction_id != null ? String(meta.prediction_id) : null;

  // Hidden entirely — never your own event, never an event whose source
  // row is unknown (pre-hotfix rows never wrote prediction_id — fails
  // safe by simply not offering a tail rather than guessing), never once
  // the source match has kicked off. This is a UX gate only — the real
  // enforcement is prevent_late_prediction() (migration 037's trigger),
  // which fires inside the RPC regardless of what the client believes.
  const isOwn = !user || event.user_id === user.id;
  const kickoffMs = event.kickoff_time ? new Date(event.kickoff_time).getTime() : null;
  const stillOpen = kickoffMs != null && kickoffMs > Date.now();

  const tail = useCallback(async () => {
    if (!user || !activeGroupId || !sourcePredictionId || submitting) return;
    setSubmitting(true);
    haptic('selection');
    try {
      const { data, error } = await supabase.rpc('submit_copied_prediction', {
        p_user_id: user.id,
        p_group_id: activeGroupId,
        p_source_prediction_id: sourcePredictionId,
      });

      if (error) {
        haptic('error');
        addToast(t(error.message?.includes('locked 15 minutes') ? 'tailErrorLocked' : 'tailErrorGeneric'), 'error');
        return;
      }

      const result = data as {
        success: boolean;
        error?: string;
        balance?: number;
        prediction?: { id?: string; coins_bet?: number; is_parlay?: boolean; parlay_linked_tiers?: string[] | null };
      } | null;

      if (!result?.success) {
        haptic('error');
        addToast(t(result?.error === 'insufficient_coins' ? 'tailErrorInsufficientCoins' : 'tailErrorGeneric'), 'error');
        return;
      }

      if (result.balance != null) coinsStore.setCoins(result.balance);

      // Own leak-free PREDICTION_LOCKED announcement — mirrors
      // usePredictions.ts's own post-submit insert exactly, so the
      // tailer's OWN card renders identically (and is itself tailable by
      // a third member, chain-flattened server-side back to the ROOT
      // creator either way).
      supabase
        .from('group_events')
        .insert({
          group_id: activeGroupId,
          user_id: user.id,
          event_type: 'PREDICTION_LOCKED',
          match_id: event.match_id,
          metadata: {
            prediction_id: result.prediction?.id ?? null,
            coins_bet: result.prediction?.coins_bet ?? null,
            is_parlay: result.prediction?.is_parlay ?? false,
            parlay_linked_tiers: result.prediction?.parlay_linked_tiers ?? null,
            tiers_count: meta.tiers_count ?? null,
            tailed_from_username: event.username ?? null,
          },
        })
        .then(({ error: evtErr }) => {
          if (evtErr) console.warn('[TailButton] group_event insert failed:', evtErr.message);
        });

      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      haptic('bet_lock');
      playSound('lock_thud');
      addToast(t('tailSuccessToast'), 'success');
      setTailed(true);
    } catch {
      haptic('error');
      addToast(t('tailErrorGeneric'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, activeGroupId, sourcePredictionId, submitting, event.match_id, event.username, meta.tiers_count, addToast, coinsStore, queryClient, t]);

  if (isOwn || !sourcePredictionId || !stillOpen || tailed) return null;

  return (
    <button
      type="button"
      onClick={tail}
      disabled={submitting}
      className={cn(
        'inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-1 rounded-lg',
        'text-xs font-semibold border border-blue-400/30 text-blue-300 bg-blue-400/10',
        'transition-all active:scale-95 disabled:opacity-50',
      )}
    >
      <Repeat2 size={13} />
      {t('tailButtonLabel')}
    </button>
  );
}

// ── AI Provocateur banter card ───────────────────────────────────────────────
// Visually unmistakable vs human messages: rotating conic-gradient border, dark
// glass panel, gradient "AI Scout" identity with a Sparkles avatar and an "AI"
// pill. Lang-aware text from metadata; returns null if Groq produced nothing.

function AiBanterCard({ event, t }: { event: GroupEvent; t: (k: TranslationKey) => string }) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';
  const meta = event.metadata;
  const text = String((isHe && meta.text_he) || meta.text_en || '').trim();

  const homeTeamEn = event.home_team || String(meta.home_team ?? '');
  const awayTeamEn = event.away_team || String(meta.away_team ?? '');
  const homeTeam = isHe && homeTeamEn ? tTeam(homeTeamEn) : homeTeamEn;
  const awayTeam = isHe && awayTeamEn ? tTeam(awayTeamEn) : awayTeamEn;
  const homeBadge = event.home_team_badge;
  const awayBadge = event.away_team_badge;
  const hasMatch = !!(homeTeam && awayTeam);

  if (!text) return null;

  return (
    <motion.div variants={itemVariants} className="relative ps-10">
      {/* Timeline dot — AI gradient */}
      <div className="absolute start-3.5 top-5 w-3 h-3 rounded-full border-2 z-10 bg-violet-400 border-violet-300/50 shadow-[0_0_10px_rgba(167,139,250,0.6)]" />

      {/* Rotating conic-gradient border */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden" dir={isHe ? 'rtl' : 'ltr'}>
        <motion.span
          aria-hidden
          className="absolute inset-[-55%]"
          style={{
            background:
              'conic-gradient(from 0deg,' +
              ' rgba(167,139,250,0.0) 0%,' +
              ' rgba(167,139,250,0.95) 14%,' +
              ' rgba(96,165,250,0.80) 34%,' +
              ' rgba(189,232,245,0.85) 52%,' +
              ' rgba(167,139,250,0.50) 70%,' +
              ' rgba(96,165,250,0.0) 86%,' +
              ' rgba(167,139,250,0.0) 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
        />

        {/* Dark glass panel */}
        <div
          className="relative rounded-[calc(1rem-1.5px)] backdrop-blur-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(6,10,22,0.82) 0%, rgba(12,10,26,0.80) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px -24px rgba(0,0,0,0.75)',
          }}
        >
          <div className="relative px-3.5 pt-2.5 pb-3">
            {/* Header: AI avatar + gradient name + AI pill + time */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)',
                  boxShadow: '0 0 12px rgba(167,139,250,0.5)',
                }}
              >
                <Sparkles size={15} className="text-white" />
              </div>
              <span
                className="text-sm font-bold"
                style={{
                  backgroundImage: 'linear-gradient(120deg, #A78BFA 0%, #BDE8F5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('lockerAiName')}
              </span>
              <span className="text-[9px] font-bold tracking-[0.18em] px-1.5 py-0.5 rounded-md border border-violet-400/40 text-violet-200 bg-violet-500/15">
                AI
              </span>
              <span className="text-text-muted text-xs ms-auto">{timeAgo(event.created_at, t)}</span>
            </div>

            {/* Banter */}
            <p className="text-[13.5px] leading-snug text-white/95 font-display">{text}</p>

            {/* Match strip */}
            {hasMatch && (
              <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
                {homeBadge && (
                  <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                )}
                <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
                <span className="text-text-muted text-[10px] font-barlow uppercase">{isHe ? 'נגד' : 'vs'}</span>
                <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
                {awayBadge && (
                  <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

