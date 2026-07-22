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

/**
 * V7 Sprint 51 — exposes the shared, already-gesture-unlocked AudioContext
 * so a caller (VoiceRadioPlayer.tsx) can build its own node graph (an
 * AnalyserNode for the visualizer) on the SAME context, never a second
 * `new AudioContext()`. Multiple concurrent contexts is wasteful and some
 * browsers cap how many can exist; this module already owns the one
 * legitimate instance for the whole app.
 */
export function getAudioContext(): AudioContext | null {
  return ctx;
}

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

// ── Sprint 51 — "Stadium Radio" ambient loop + broadcast jingle ─────────────
//
// Genuinely new capability, distinct from PLAYERS above: those are one-shot
// fire-and-forget SFX (a few hundred ms, no lifecycle to manage beyond their
// own onended cleanup). A stadium-ambience bed is a CONTINUOUS loop with a
// real start/stop lifecycle (tied to the radio player's play/pause state),
// so it gets its own small, self-contained node-graph manager below rather
// than being force-fit into the PLAYERS shape.
//
// Synthesis: lowpass-filtered white noise is the standard, well-established
// technique for a "crowd murmur/roar" texture (no sample library needed —
// still 0 KB shipped, same "zero-asset" discipline as every other sound in
// this file). Kept deliberately quiet (peak 0.035, vs. e.g. lock_thud's
// 0.22) — a background bed, never competing with narration.

let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;
let ambientAnalyser: AnalyserNode | null = null;

/**
 * Real frequency-domain data for the ambient bed — a genuine, connected
 * AudioContext graph, safe to read every animation frame via
 * getByteFrequencyData(). Returns null whenever the loop isn't running;
 * callers must treat that as "nothing to draw," never poll-retry.
 *
 * Deliberately NOT a source of real data for the spoken narration itself —
 * window.speechSynthesis does not route its audio through the Web Audio
 * API graph in any mainstream browser, so there is no AnalyserNode that
 * can read real frequency content from a SpeechSynthesisUtterance. Any
 * narration-reactive visual in VoiceRadioPlayer.tsx must be an honestly
 * SIMULATED pulse (driven by the utterance's own `boundary` event timing),
 * never presented as if it were real audio analysis — see that file's own
 * header comment for the split.
 */
export function getAmbientAnalyser(): AnalyserNode | null {
  return ambientAnalyser;
}

function buildNoiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Starts the ambient loop. No-op if already running or the context isn't unlocked. */
export function startAmbientLoop(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    if (ambientSource) return; // already running — idempotent

    const source = ctx.createBufferSource();
    source.buffer = buildNoiseBuffer(ctx, 2);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400; // muffled register — reads as distant crowd, not hiss
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 1.2); // slow fade-in, never a hard cut-in

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128; // small — a lower-third bar visualizer needs few bins, cheap per frame

    source.connect(filter);
    filter.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    source.start(now);

    ambientSource = source;
    ambientGain = gain;
    ambientAnalyser = analyser;
  } catch {
    // silent — same no-throw discipline as every other function in this file
  }
}

/** Fades out and stops the ambient loop. Safe to call even if not running. */
export function stopAmbientLoop(): void {
  const source = ambientSource;
  const gain = ambientGain;
  ambientSource = null;
  ambientGain = null;
  ambientAnalyser = null;

  try {
    if (gain && ctx) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }
    setTimeout(() => {
      try {
        source?.stop();
        source?.disconnect();
      } catch {
        // already stopped/disconnected — fine
      }
    }, 450);
  } catch {
    // silent
  }
}

/** One-shot "on air" stinger — a short ascending 3-note arpeggio. Fire-and-forget, no lifecycle. */
export function playBroadcastJingle(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const c = ctx;
    const now = c.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — a bright, simple major triad
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const start = now + i * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.24);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch {
    // silent
  }
}
