import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, X } from 'lucide-react';
import { CoinIcon } from '../ui/CoinIcon';
import { useLiveDuelBroadcast, type DuelChallengePayload } from '../providers/RealtimeProvider';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { COIN_COSTS } from '../../lib/constants';

// V6 Sprint 47 Commit 2 — "Live Duels" negotiation layer. Everything in
// this component is pure matchmaking chatter over the `duel_challenge`
// broadcast event (RealtimeProvider.tsx) — offer / accept / cancel — and
// NEVER writes to Postgres, never touches a coin balance. Once two members
// agree on terms (an offer gets accepted), the drawer shows a "Matched!"
// state and stops there — Commit 3 is what wires the real escrow RPC
// (each side independently debits their OWN balance from their OWN
// session, never one party moving the other's coins — see the
// DuelChallengePayload file-header comment in RealtimeProvider.tsx for
// exactly why a broadcast payload alone can never be trusted to move
// money). This component is deliberately NOT mounted anywhere in the app
// yet — no entry trigger exists on MatchCard — the same "built now,
// dormant until wired" precedent as usePredictions.ts's
// isPredictionSubmitInFlight (§50, Sprint 35 Commit 3).
//
// Swipe-to-close bottom sheet — rule 4.13 — same drag="y" +
// dragConstraints + onDragEnd threshold shape as every other bottom sheet
// in this codebase (MomentumBetSheet, CoinGuide), onPointerDown
// stopPropagation on the one scroll container.

interface LiveDuelDrawerProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
}

const MIN_STAKE = 5;
// The same per-match economy ceiling every other stake surface in this
// app is bounded by (COIN_COSTS.MAX_PER_MATCH) — a real, already-stated
// quantity, not a fresh arbitrary cap invented for this one drawer.
const MAX_STAKE = COIN_COSTS.MAX_PER_MATCH;
const STEP = 2;

function genNonce(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// "My own current duel negotiation state" — covers both roles: I offered
// (status 'offered') or I accepted someone else's offer (status
// 'matched' arrives either way, from whichever side confirms the match).
type MyDuelState =
  | { status: 'idle' }
  | { status: 'offered'; duelNonce: string; stake: number; side: 'home' | 'away' }
  | { status: 'matched'; duelNonce: string; opponentUsername: string };

export function LiveDuelDrawer({ matchId, homeTeam, awayTeam, onClose }: LiveDuelDrawerProps) {
  const { user, profile } = useAuthStore();
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';

  const [stake, setStake] = useState(MIN_STAKE);
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [myDuel, setMyDuel] = useState<MyDuelState>({ status: 'idle' });
  // Open offers from OTHER members, keyed by duelNonce — a Map so a
  // superseding message (cancel/accept) can remove exactly one entry
  // without scanning an array.
  const [incoming, setIncoming] = useState<Map<string, DuelChallengePayload>>(new Map());

  const homeName = isHe ? tTeam(homeTeam) : homeTeam;
  const awayName = isHe ? tTeam(awayTeam) : awayTeam;
  const sideLabel = (s: 'home' | 'away') => (s === 'home' ? homeName : awayName);

  const onDuelMessage = useCallback((msg: DuelChallengePayload) => {
    if (!user) return;

    if (msg.type === 'offer') {
      // Never my own offer (self-echo is off, but guard defensively) and
      // never a reply targeted at someone else specifically.
      if (msg.fromUserId === user.id) return;
      if (msg.toUserId != null && msg.toUserId !== user.id) return;
      setIncoming((prev) => {
        const next = new Map(prev);
        next.set(msg.duelNonce, msg);
        return next;
      });
      return;
    }

    if (msg.type === 'cancel') {
      setIncoming((prev) => {
        if (!prev.has(msg.duelNonce)) return prev;
        const next = new Map(prev);
        next.delete(msg.duelNonce);
        return next;
      });
      return;
    }

    if (msg.type === 'accept') {
      // Someone accepted an offer I made — only react if it's genuinely
      // MY outstanding offer and the accept is addressed to me.
      setMyDuel((prev) => {
        if (prev.status !== 'offered' || prev.duelNonce !== msg.duelNonce) return prev;
        if (msg.toUserId !== user.id) return prev;
        haptic('bet_lock');
        playSound('lock_thud');
        return { status: 'matched', duelNonce: msg.duelNonce, opponentUsername: msg.fromUsername };
      });
      // If it happened to also be sitting in my own incoming list
      // (shouldn't normally, since 'offer' filters out my own — but a
      // second accept racing on the same nonce is a real possibility),
      // drop it there too.
      setIncoming((prev) => {
        if (!prev.has(msg.duelNonce)) return prev;
        const next = new Map(prev);
        next.delete(msg.duelNonce);
        return next;
      });
    }
  }, [user]);

  const { send } = useLiveDuelBroadcast(matchId, onDuelMessage);

  const challengeGroup = useCallback(() => {
    if (!user || !profile) return;
    const duelNonce = genNonce();
    haptic('selection');
    playSound('toggle_click');
    send({ type: 'offer', duelNonce, fromUserId: user.id, fromUsername: profile.username, toUserId: null, stake, side });
    setMyDuel({ status: 'offered', duelNonce, stake, side });
  }, [user, profile, stake, side, send]);

  const cancelChallenge = useCallback(() => {
    if (myDuel.status !== 'offered' || !user || !profile) return;
    haptic('selection');
    send({
      type: 'cancel',
      duelNonce: myDuel.duelNonce,
      fromUserId: user.id,
      fromUsername: profile.username,
      toUserId: null,
      stake: myDuel.stake,
      side: myDuel.side,
    });
    setMyDuel({ status: 'idle' });
  }, [myDuel, user, profile, send]);

  const acceptOffer = useCallback((offer: DuelChallengePayload) => {
    if (!user || !profile) return;
    haptic('bet_lock');
    playSound('lock_thud');
    send({
      type: 'accept',
      duelNonce: offer.duelNonce,
      fromUserId: user.id,
      fromUsername: profile.username,
      toUserId: offer.fromUserId,
      stake: offer.stake,
      side: offer.side === 'home' ? 'away' : 'home', // I take the opposite side from the offerer
    });
    setIncoming((prev) => {
      const next = new Map(prev);
      next.delete(offer.duelNonce);
      return next;
    });
    setMyDuel({ status: 'matched', duelNonce: offer.duelNonce, opponentUsername: offer.fromUsername });
  }, [user, profile, send]);

  const ignoreOffer = useCallback((duelNonce: string) => {
    setIncoming((prev) => {
      const next = new Map(prev);
      next.delete(duelNonce);
      return next;
    });
  }, []);

  const openOffers = useMemo(() => Array.from(incoming.values()), [incoming]);

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
            {myDuel.status === 'matched' ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-lg font-semibold text-accent-green">
                  {t('duelMatched').replace('{0}', myDuel.opponentUsername)}
                </p>
                <p className="text-white/45 text-xs">{t('duelConfirmingEscrow')}</p>
              </div>
            ) : myDuel.status === 'offered' ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-white/70 text-sm">{t('duelWaitingForOpponent')}</p>
                <p className="text-xs text-white/45 flex items-center justify-center gap-1">
                  <CoinIcon size={12} className="inline-block align-[-1px]" />
                  {myDuel.stake} · {sideLabel(myDuel.side)}
                </p>
                <button
                  type="button"
                  onClick={cancelChallenge}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-red-400/30 text-red-300 bg-red-400/10 active:scale-95 transition-all"
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
                  className="w-full py-3 rounded-2xl font-bebas text-xl tracking-wider bg-blue-400/15 text-blue-300 border border-blue-400/40 active:scale-95 transition-all"
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
                  <div key={offer.duelNonce} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                    <div className="flex-1 min-w-0 text-xs text-white/80 truncate">
                      <span className="font-semibold">{offer.fromUsername}</span>{' '}
                      {t('duelIncomingOfferPrefix')}{' '}
                      <CoinIcon size={11} className="inline-block align-[-1px]" />{offer.stake}{' '}
                      {t('duelIncomingOfferOn')} {sideLabel(offer.side)}
                    </div>
                    <button
                      type="button"
                      onClick={() => acceptOffer(offer)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 active:scale-95 shrink-0"
                    >
                      {t('duelAccept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => ignoreOffer(offer.duelNonce)}
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
