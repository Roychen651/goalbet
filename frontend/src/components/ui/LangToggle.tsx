import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

interface LangToggleProps {
  className?: string;
  /** Flag-only mode — no text, used in cramped mobile headers */
  compact?: boolean;
}

export function LangToggle({ className, compact = false }: LangToggleProps) {
  const { lang, setLang } = useLangStore();

  return (
    <button
      onClick={() => { haptic('toggle_click'); playSound('toggle_click'); setLang(lang === 'en' ? 'he' : 'en'); }}
      className={cn(
        'flex items-center rounded-xl select-none transition-all duration-150',
        'bg-white/8 border border-white/10 hover:bg-white/12 hover:border-white/20',
        compact ? 'p-1.5' : 'gap-1.5 px-3 py-1.5 text-white text-sm font-medium',
        className
      )}
      title={lang === 'en' ? 'Switch to Hebrew' : 'עבור לאנגלית'}
    >
      {/* Text label, not a flag emoji — flag glyph metrics/rendering are
          inconsistent across platforms (some even render a bare two-letter
          code instead of a flag), same fix applied to TopBar.tsx's own
          inline lang button. */}
      <span className="text-[11px] font-bold leading-none tabular-nums">{lang === 'en' ? 'עב' : 'EN'}</span>
      {!compact && <span className="text-xs opacity-80">{lang === 'en' ? 'עברית' : 'English'}</span>}
    </button>
  );
}
