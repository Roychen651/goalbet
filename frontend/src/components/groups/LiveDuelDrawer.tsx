import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, X } from 'lucide-react';
import { CoinIcon } from '../ui/CoinIcon';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { useRealtimeSubscription, useRealtimeReconnect } from '../providers/RealtimeProvider';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { COIN_COSTS } from '../../lib/constants';
import type { TranslationKey } from '../../lib/i18n';

// V6 Sprint 47 Commit 3 — "Live Duels": real DB-backed escrow, replacing
// Commit 2's pure-broadcast negotiation. Commit 2 had no persisted state
// to build on yet (live_duels didn't exist), so pure `duel_challenge`
// broadcast chatter was the only option; now that migration 065 gives
// this a real, RLS-protected, Realtime-subscribable table, DB state +
// postgres_changes is the correct discovery mechanism — the same pattern
// SyndicatePoolCard/BattleMeter already use for every other public group
// activity. The generalized broadcast plumbing Commit 2 built
// (useLiveDuelBroadcast, DuelChallengePayload) stays available
// infrastructure in RealtimeProvider.tsx; this component simply doesn't
// need it anymore. Every coin movement here happens via one of the three
// real RPCs (migration 065) — this component never trusts a client-side
// guess about balances or outcomes.
//
// Swipe-to-close bottom sheet — rule 4.13 — same drag="y" +
// dragConstraints + onDragEnd threshold shape as every other bottom sheet
// in this codebase, onPointerDown stopPropagation on the one scroll
// container.

interface LiveDuelDrawerProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
}

interface LiveDuel {
  id: string;
  challenger_id: string;
  challenger_side: 'home' | 'away';
  acceptor_id: string | null;
  acceptor_side: 'home' | 'away' | null;
  stake: number;
  status: 'pending' | 'active' | 'resolved' | 'refunded';
  challenger: { username: string } | null;
  acceptor: { username: string } | null;
}

const MIN_STAKE = 5;
// The same per-match economy ceiling every other stake surface in this
// app is bounded by (COIN_COSTS.MAX_PER_MATCH) — a real, already-stated
// quantity, not a fresh arbitrary cap invented for this one drawer.
const MAX_STAKE = COIN_COSTS.MAX_PER_MATCH;
const STEP = 2;

const ERROR_KEY: Record<string, TranslationKey> = {
  invalid_side: 'duelErrorGeneric',
  invalid_amount: 'duelErrorGeneric',
  match_not_live: 'duelErrorNotLive',
  insufficient_coins: 'duelErrorInsufficientCoins',
  member_not_found: 'duelErrorGeneric',
  duel_not_found: 'duelErrorGeneric',
  duel_closed: 'duelErrorClosed',
  cannot_accept_own_duel: 'duelErrorGeneric',
};

export function LiveDuelDrawer({ matchId, homeTeam, awayTeam, onClose }: LiveDuelDrawerProps) {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { t, lang } = useLangStore();
  const { addToast } = useUIStore();
  const coinsStore = useCoinsStore();
  const isHe = lang === 'he';

  const [stake, setStake] = useState(MIN_STAKE);
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [duels, setDuels] = useState<LiveDuel[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const homeName = isHe ? tTeam(homeTeam) : homeTeam;
  const awayName = isHe ? tTeam(awayTeam) : awayTeam;
  const sideLabel = (s: 'home' | 'away' | null) => (s === 'home' ? homeName : s === 'away' ? awayName : '');

  const fetchDuels = useCallback(async () => {
    if (!activeGroupId) return;
    const { data } = await supabase
      .from('live_duels')
      .select('id, challenger_id, challenger_side, acceptor_id, acceptor_side, stake, status, challenger:challenger_id(username), acceptor:acceptor_id(username)')
      .eq('group_id', activeGroupId)
      .eq('match_id', matchId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });
    setDuels((data as unknown as LiveDuel[]) ?? []);
  }, [activeGroupId, matchId]);

  useEffect(() => { fetchDuels(); }, [fetchDuels]);
  useRealtimeSubscription('live_duels', () => fetchDuels());
  useRealtimeReconnect(() => fetchDuels());

  const myDuel = duels.find((d) => d.challenger_id === user?.id || d.acceptor_id === user?.id) ?? null;
  const openOffers = duels.filter((d) => d.status === 'pending' && d.challenger_id !== user?.id && !dismissed.has(d.id));

  const runRpc = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      addToast(t('duelErrorGeneric'), 'error');
      haptic('error');
      return false;
    }
    const result = data as { success: boolean; error?: string; balance?: number };
    if (!result.success) {
      addToast(t(ERROR_KEY[result.error ?? ''] ?? 'duelErrorGeneric'), 'error');
      haptic('error');
      return false;
    }
    if (result.balance != null) coinsStore.setCoins(result.balance);
    await fetchDuels();
    return true;
  }, [addToast, t, coinsStore, fetchDuels]);

  const challengeGroup = useCallback(async () => {
    if (!user || !activeGroupId || submitting) return;
    setSubmitting(true);
    haptic('selection');
    playSound('toggle_click');
    const ok = await runRpc('create_duel_offer', {
      p_user_id: user.id, p_group_id: activeGroupId, p_match_id: matchId, p_side: side, p_stake: stake,
    });
    if (ok) { haptic('bet_lock'); playSound('lock_thud'); }
    setSubmitting(false);
  }, [user, activeGroupId, matchId, side, stake, submitting, runRpc]);

  const cancelChallenge = useCallback(async (duelId: string) => {
    if (!user || !activeGroupId || submitting) return;
    setSubmitting(true);
    haptic('selection');
    await runRpc('cancel_duel_offer', { p_user_id: user.id, p_group_id: activeGroupId, p_duel_id: duelId });
    setSubmitting(false);
  }, [user, activeGroupId, submitting, runRpc]);

  const acceptOffer = useCallback(async (duelId: string) => {
    if (!user || !activeGroupId || submitting) return;
    setSubmitting(true);
    haptic('selection');
    // V6 Sprint 47 Commit 4 — the "locked in" bet_lock/lock_thud pairing
    // must fire only on a CONFIRMED accept, matching challengeGroup's own
    // success-gated shape immediately above. Firing it unconditionally
    // before the RPC resolves (the pre-Commit-4 shape) meant a failed
    // accept (someone else already took the offer, insufficient coins)
    // gave a "locked in" feel immediately followed by runRpc's own
    // haptic('error') — two contradictory sensory signals for one tap.
    const ok = await runRpc('accept_duel_wager', { p_user_id: user.id, p_group_id: activeGroupId, p_duel_id: duelId });
    if (ok) { haptic('bet_lock'); playSound('lock_thud'); }
    setSubmitting(false);
  }, [user, activeGroupId, submitting, runRpc]);

  const ignoreOffer = useCallback((duelId: string) => {
    setDismissed((prev) => new Set(prev).add(duelId));
  }, []);

  const myOpponentName = myDuel
    ? (myDuel.challenger_id === user?.id ? myDuel.acceptor?.username : myDuel.challenger?.username) ?? ''
    : '';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 && info.velocity.y > 20) onClose();
        }}
      >
        <div className="card-elevated border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden" dir={isHe ? 'rtl' : 'ltr'}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
          </div>

          <div className="px-5 pt-3 pb-4 border-b border-white/8 flex items-center gap-2.5" onPointerDown={(e) => e.stopPropagation()}>
            <Swords size={18} className="text-blue-300 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bebas text-2xl tracking-wider text-white">{t('duelTitle')}</h2>
              <p className="text-white/45 text-xs truncate">{t('duelSubtitle')}</p>
            </div>
            <button type="button" onClick={onClose} className="ms-auto p-1.5 rounded-full hover:bg-white/8 shrink-0">
              <X size={16} className="text-white/50" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-5 max-h-[60vh] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
            {myDuel?.status === 'active' ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-lg font-semibold text-accent-green">
                  {t('duelMatched').replace('{0}', myOpponentName)}
                </p>
                <p className="text-white/45 text-xs flex items-center justify-center gap-1">
                  <CoinIcon size={12} className="inline-block align-[-1px]" />
                  {myDuel.stake * 2} · {sideLabel(myDuel.challenger_id === user?.id ? myDuel.challenger_side : myDuel.acceptor_side)}
                </p>
              </div>
            ) : myDuel?.status === 'pending' ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-white/70 text-sm">{t('duelWaitingForOpponent')}</p>
                <p className="text-xs text-white/45 flex items-center justify-center gap-1">
                  <CoinIcon size={12} className="inline-block align-[-1px]" />
                  {myDuel.stake} · {sideLabel(myDuel.challenger_side)}
                </p>
                <button
                  type="button"
                  onClick={() => cancelChallenge(myDuel.id)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-red-400/30 text-red-300 bg-red-400/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  {t('duelCancelChallenge')}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-white/45 mb-2">{t('duelPickSide')}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['home', 'away'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSide(s); haptic('selection'); playSound('toggle_click'); }}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 truncate ${
                          side === s
                            ? 'bg-blue-400/15 text-blue-300 border-blue-400/40'
                            : 'bg-white/5 text-white/70 border-white/10'
                        }`}
                      >
                        {sideLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45">{t('duelStakeLabel')}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={t('duelDecreaseStake')}
                      onClick={() => { setStake((v) => Math.max(MIN_STAKE, v - STEP)); haptic('selection'); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-white/6 border border-white/10 text-white active:scale-90"
                    >
                      −
                    </button>
                    <span className="font-mono tabular-nums text-sm text-white w-12 flex items-center gap-1 justify-center">
                      <CoinIcon size={13} />{stake}
                    </span>
                    <button
                      type="button"
                      aria-label={t('duelIncreaseStake')}
                      onClick={() => { setStake((v) => Math.min(MAX_STAKE, v + STEP)); haptic('selection'); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-white/6 border border-white/10 text-white active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={challengeGroup}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl font-bebas text-xl tracking-wider bg-blue-400/15 text-blue-300 border border-blue-400/40 active:scale-95 transition-all disabled:opacity-50"
                >
                  {t('duelChallengeButton')}
                </button>
              </>
            )}

            <div className="space-y-2 pt-1 border-t border-white/8">
              {openOffers.length === 0 ? (
                <p className="text-xs text-white/35 text-center py-2">{t('duelNoOffers')}</p>
              ) : (
                openOffers.map((offer) => (
                  <div key={offer.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                    <div className="flex-1 min-w-0 text-xs text-white/80 truncate">
                      <span className="font-semibold">{offer.challenger?.username ?? '?'}</span>{' '}
                      {t('duelIncomingOfferPrefix')}{' '}
                      <CoinIcon size={11} className="inline-block align-[-1px]" />{offer.stake}{' '}
                      {t('duelIncomingOfferOn')} {sideLabel(offer.challenger_side)}
                    </div>
                    <button
                      type="button"
                      onClick={() => acceptOffer(offer.id)}
                      disabled={submitting || !!myDuel}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 active:scale-95 shrink-0 disabled:opacity-50"
                    >
                      {t('duelAccept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => ignoreOffer(offer.id)}
                      className="px-2 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 shrink-0"
                    >
                      {t('duelIgnore')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
