// Zero-asset synthesized SFX (Sprint 17). No <audio> elements, no network
// requests, no binary assets — every sound is a few oscillator/gain nodes
// scheduled on a single lazily-created AudioContext. "Zero-weight" in the
// most literal sense: 0 KB shipped, nothing to preload, nothing to license.
//
// Autoplay compliance: an AudioContext is born suspended until resume() is
// called from inside a real user-gesture handler. unlockAudio() is wired to
// the app's first pointerdown (App.tsx's AppInitializer) and removes itself
// after firing once. playSound() checks the context is actually running
// before touching it and returns silently — never throws — if called before
// that gesture has happened, matching lib/haptics.ts's existing
// no-op-on-failure discipline exactly. The context is also only ever
// *created* from unlockAudio() (i.e. from a real gesture) — playSound()
// never lazily creates one — so a stray playSound() call before the first
// tap is a true no-op, not a silent context-creation side effect some
// browsers log a warning for.

export type SoundName = 'toggle_click' | 'coin_chime' | 'lock_thud' | 'rank_alert';

let ctx: AudioContext | null = null;

interface LegacyWindow {
  webkitAudioContext?: typeof AudioContext;
}

/** Call once from a real user-gesture handler (a tap). Safe to call repeatedly. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as LegacyWindow).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // silent — a sensory nicety must never block the gesture that triggered it
  }
}

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  /** If set, frequency glides from `freq` to this over `duration`. */
  freqEnd?: number;
  duration: number;
  peak: number;
}

function tone(c: AudioContext, spec: ToneSpec): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const now = c.currentTime;

  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, now);
  if (spec.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(spec.freqEnd, now + spec.duration);
  }

  // Fast attack, exponential decay — exponentialRampToValueAtTime requires a
  // nonzero starting value, hence the 0.0001 floor rather than a literal 0.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(spec.peak, now + Math.min(0.005, spec.duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + spec.duration + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

const PLAYERS: Record<SoundName, (c: AudioContext) => void> = {
  // Low-amplitude mechanical click — a settings toggle, a nav tap.
  toggle_click: (c) => tone(c, { type: 'square', freq: 1800, duration: 0.012, peak: 0.12 }),

  // Bright metallic chime — two sine partials a major sixth apart
  // (1046.5 Hz / C6 + 1568 Hz / G6), the same interval most coin-drop SFX
  // libraries use because it reads as "bright metal" rather than a beep.
  coin_chime: (c) => {
    tone(c, { type: 'sine', freq: 1046.5, duration: 0.18, peak: 0.18 });
    tone(c, { type: 'sine', freq: 1568, duration: 0.18, peak: 0.12 });
  },

  // Low, final — a bet window locking. Distinct register from the chime
  // (90 Hz dropping to 60 Hz) so the two are never confused mid-session.
  lock_thud: (c) => tone(c, { type: 'sine', freq: 90, freqEnd: 60, duration: 0.09, peak: 0.22 }),

  // Sprint 46 — a live rank-overtake alert. Two descending sine partials
  // (784 Hz -> 587 Hz, the mirror-inverse interval of coin_chime's rising
  // pair) so it reads as "notice, something moved against you" without
  // being confusable with coin_chime's ascending "you received something"
  // meaning or lock_thud's much lower, duller register.
  rank_alert: (c) => {
    tone(c, { type: 'sine', freq: 784, duration: 0.14, peak: 0.16 });
    tone(c, { type: 'sine', freq: 587, duration: 0.14, peak: 0.12 });
  },
};

/**
 * Plays a synthesized micro-sound. Silent no-op if the context doesn't
 * exist yet or isn't running (i.e. the app hasn't been unlocked by a user
 * gesture) — never throws, so a sensory nicety can never break a real
 * interaction it's attached to.
 */
export function playSound(name: SoundName): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    PLAYERS[name](ctx);
  } catch {
    // silent
  }
}
