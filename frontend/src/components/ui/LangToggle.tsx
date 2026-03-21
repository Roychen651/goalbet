import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';

interface LangToggleProps {
  className?: string;
  /** Flag-only mode — no text, used in cramped mobile headers */
  compact?: boolean;
}

export function LangToggle({ className, compact = false }: LangToggleProps) {
  const { lang, setLang } = useLangStore();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      className={cn(
        'flex items-center rounded-xl select-none transition-all duration-150',
        'bg-white/8 border border-white/10 hover:bg-white/12 hover:border-white/20',
        compact ? 'p-1.5' : 'gap-1.5 px-3 py-1.5 text-white text-sm font-medium',
        className
      )}
      title={lang === 'en' ? 'Switch to Hebrew' : 'עבור לאנגלית'}
    >
      <span className="text-base leading-none">{lang === 'en' ? '🇮🇱' : '🇬🇧'}</span>
      {!compact && <span className="text-xs opacity-80">{lang === 'en' ? 'עברית' : 'English'}</span>}
    </button>
  );
}
