/**
 * VoiceRadioPlayer — "Commissioner Radio" (V7 Sprint 51).
 *
 * Speaks the group's weekly Commissioner brief via the native
 * window.speechSynthesis API — zero third-party TTS, $0 forever, matching
 * this codebase's own "zero-asset synthesized audio" discipline already
 * established for lib/sensoryAudio.ts's SFX.
 *
 * VISUALIZER HONESTY SPLIT (see CLAUDE.md §69 for the full write-up):
 * window.speechSynthesis does NOT route its audio through the Web Audio
 * API graph in any mainstream browser — there is no AudioNode/MediaStream
 * exposed for synthesized speech, so an AnalyserNode literally cannot read
 * real frequency data from the voice. The bars below are therefore two
 * HONESTLY DIFFERENT signals, drawn together but never conflated:
 *   - REAL data: getAmbientAnalyser() (lib/sensoryAudio.ts) reads a
 *     genuine, connected AudioContext graph — the ambient stadium bed.
 *   - SIMULATED data: a decaying pulse bumped by the utterance's own real
 *     `boundary` event (fires per word/sentence — real timing, not
 *     fabricated), giving a plausible "talking" impression without ever
 *     claiming to be actual voice-frequency analysis.
 *
 * DEFENSIVE DEGRADATION: speechSynthesis.getVoices() is frequently empty
 * until the async `voiceschanged` event fires, and many sandboxed/headless
 * environments have zero installed OS-level TTS voices at all. Voice
 * availability (for whichever language is currently active) is checked for
 * real before any play control is enabled; if none exists, this renders a
 * text-only "Text Edition" card instead — same outer shell, same height,
 * zero CLS between the two states.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, Gauge, Mic, Radio } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import {
  playSound,
  playBroadcastJingle,
  startAmbientLoop,
  stopAmbientLoop,
  getAmbientAnalyser,
  unlockAudio,
} from '../../lib/sensoryAudio';

interface VoiceRadioPlayerProps {
  textEn: string;
  textHe: string;
  themeEn?: string | null;
  themeHe?: string | null;
}

const RATE_OPTIONS = [0.85, 1, 1.15, 1.3];
const PITCH_OPTIONS = [0.9, 1, 1.1];
const BAR_COUNT = 24;

function findVoice(voices: SpeechSynthesisVoice[], langPrefix: string): SpeechSynthesisVoice | null {
  return voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ?? null;
}

type VoiceState = 'checking' | 'available' | 'unavailable';

export function VoiceRadioPlayer({ textEn, textHe, themeEn, themeHe }: VoiceRadioPlayerProps) {
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';
  const text = (isHe && textHe) || textEn;
  const theme = (isHe && themeHe) || themeEn;
  const prefersReducedMotion = useReducedMotion();

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voiceState, setVoiceState] = useState<VoiceState>(speechSupported ? 'checking' : 'unavailable');
  const [isPlaying, setIsPlaying] = useState(false);
  const [rateIdx, setRateIdx] = useState(1);
  const [pitchIdx, setPitchIdx] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Decaying "narration pulse" — real utterance boundary timing, honestly
  // simulated visual, never real frequency data. See file header.
  const pulseRef = useRef(0);

  // Voice availability — real getVoices() + the async voiceschanged event,
  // since voices are frequently NOT populated synchronously.
  useEffect(() => {
    if (!speechSupported) {
      setVoiceState('unavailable');
      return;
    }
    const langPrefix = isHe ? 'he' : 'en';
    const check = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return; // not loaded yet — wait for voiceschanged
      setVoiceState(findVoice(voices, langPrefix) ? 'available' : 'unavailable');
    };
    check();
    window.speechSynthesis.addEventListener('voiceschanged', check);
    // A device that never fires voiceschanged (or genuinely has zero
    // voices — real in this sandbox's headless Chromium) must still
    // resolve out of "checking," never hang forever.
    const timeout = setTimeout(() => {
      setVoiceState((prev) => (prev === 'checking' ? 'unavailable' : prev));
    }, 2500);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', check);
      clearTimeout(timeout);
    };
  }, [speechSupported, isHe]);

  const stopEverything = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // silent — speech APIs are a nicety, never allowed to throw into the UI
    }
    stopAmbientLoop();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount (e.g. navigating away from Locker Room mid-playback).
  useEffect(() => stopEverything, [stopEverything]);

  // A new week's brief replacing the currently-playing one — stop, don't
  // let a stale utterance keep narrating text no longer on screen.
  useEffect(() => {
    stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        const w = canvas.width;
        const h = canvas.height;
        ctx2d.clearRect(0, 0, w, h);
        const barW = w / BAR_COUNT;

        const analyser = getAmbientAnalyser();
        let freqData: Uint8Array<ArrayBuffer> | null = null;
        if (analyser) {
          // Explicit ArrayBuffer construction — TS 5.7+'s stricter DOM lib
          // typings for getByteFrequencyData() require a Uint8Array<ArrayBuffer>
          // specifically; `new Uint8Array(count)` alone infers the looser
          // ArrayBufferLike and no longer satisfies that signature.
          freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
          analyser.getByteFrequencyData(freqData);
        }

        pulseRef.current *= 0.9; // exponential decay each frame

        for (let i = 0; i < BAR_COUNT; i++) {
          let mag = 0.08; // idle floor — bars never fully vanish while playing
          if (freqData) {
            const bucket = Math.floor((i / BAR_COUNT) * freqData.length);
            mag = Math.max(mag, freqData[bucket] / 255);
          }
          mag = Math.min(1, mag + pulseRef.current * (0.3 + 0.7 * Math.random()));
          const barH = Math.max(2, mag * h);
          ctx2d.fillStyle = `rgba(255,193,74,${0.35 + mag * 0.5})`;
          ctx2d.fillRect(i * barW + 1, h - barH, Math.max(1, barW - 2), barH);
        }
      }
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const handlePlay = () => {
    if (!speechSupported || voiceState !== 'available' || !text) return;
    unlockAudio(); // safe even if already unlocked — idempotent
    haptic('toggle_click');
    playSound('toggle_click');
    playBroadcastJingle();
    startAmbientLoop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isHe ? 'he-IL' : 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const voice = findVoice(voices, isHe ? 'he' : 'en');
    if (voice) utterance.voice = voice;
    utterance.rate = RATE_OPTIONS[rateIdx];
    utterance.pitch = PITCH_OPTIONS[pitchIdx];
    utterance.onboundary = () => {
      pulseRef.current = 1;
    };
    utterance.onend = stopEverything;
    utterance.onerror = stopEverything;

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(drawFrame);
  };

  const handlePause = () => {
    haptic('toggle_click');
    playSound('toggle_click');
    stopEverything();
  };

  if (!text) return null;

  const showTextEdition = voiceState === 'unavailable';
  const controlsDisabled = voiceState === 'checking';

  return (
    <div className="relative mb-4 rounded-2xl p-[1.5px] overflow-hidden" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Rotating conic-gradient border — the exact "broadcast card" grammar
          AiBanterCard/HTAnalystCard already established, reused verbatim
          rather than inventing a fourth visual language. Slower (8s) than
          HTAnalystCard's urgent 4.2s live-match pace — a weekly show recap
          isn't live-match tension, closer to AIScoutCard's calmer cadence. */}
      <motion.span
        aria-hidden
        className="absolute inset-[-40%] pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg,' +
            ' rgba(255,77,102,0) 0%,' +
            ' rgba(255,77,102,0.55) 18%,' +
            ' rgba(255,201,74,0.65) 42%,' +
            ' rgba(189,232,245,0.55) 68%,' +
            ' rgba(255,77,102,0) 100%)',
        }}
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
      />

      <div
        className="relative rounded-[calc(1rem-1.5px)] backdrop-blur-2xl overflow-hidden min-h-[172px] p-3.5"
        style={{
          background: 'linear-gradient(180deg, rgba(6,10,22,0.86) 0%, rgba(12,10,26,0.84) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px -24px rgba(0,0,0,0.75)',
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4D66 0%, #FFC94A 100%)', boxShadow: '0 0 12px rgba(255,77,102,0.4)' }}
          >
            <Radio size={15} className="text-white" />
          </div>
          <span
            className="text-sm font-bold"
            style={{
              backgroundImage: 'linear-gradient(120deg, #FFC94A 0%, #BDE8F5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('commissionerRadioLabel')}
          </span>
          {theme && (
            <span className="ms-auto text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/55 max-w-[45%] truncate">
              {theme}
            </span>
          )}
        </div>

        <p className="text-white/85 text-sm leading-relaxed mb-3">{text}</p>

        {showTextEdition ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
            <Mic size={12} /> {t('commissionerTextEdition')}
          </span>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              width={280}
              height={36}
              className="w-full h-9 rounded-md"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-2 mt-3">
              <motion.button
                type="button"
                whileTap={controlsDisabled ? undefined : { scale: 0.92 }}
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={controlsDisabled}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #FF4D66 0%, #FFC94A 100%)' }}
                aria-label={isPlaying ? t('commissionerPause') : t('commissionerPlay')}
              >
                {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ms-0.5" />}
              </motion.button>
              <button
                type="button"
                onClick={() => setRateIdx((i) => (i + 1) % RATE_OPTIONS.length)}
                disabled={controlsDisabled}
                className="px-2.5 h-8 rounded-full text-[11px] font-mono tabular-nums border border-white/15 text-white/70 disabled:opacity-40"
                aria-label={t('commissionerSpeed')}
              >
                {RATE_OPTIONS[rateIdx]}x
              </button>
              <button
                type="button"
                onClick={() => setPitchIdx((i) => (i + 1) % PITCH_OPTIONS.length)}
                disabled={controlsDisabled}
                className="flex items-center gap-1 px-2.5 h-8 rounded-full text-[11px] font-mono tabular-nums border border-white/15 text-white/70 disabled:opacity-40"
                aria-label={t('commissionerPitch')}
              >
                <Gauge size={12} /> {PITCH_OPTIONS[pitchIdx]}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
