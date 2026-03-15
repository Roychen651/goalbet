import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';

interface LangToggleProps {
  className?: string;
}

export function LangToggle({ className }: LangToggleProps) {
  const { lang, setLang } = useLangStore();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
        'bg-white/8 border border-white/10 text-white text-sm font-medium',
        'hover:bg-white/12 hover:border-white/20 transition-all duration-150',
        'select-none',
        className
      )}
      title={lang === 'en' ? 'Switch to Hebrew' : 'עבור לאנגלית'}
    >
      <span className="text-base leading-none">{lang === 'en' ? '🇮🇱' : '🇬🇧'}</span>
      <span className="text-xs opacity-80">{lang === 'en' ? 'עברית' : 'English'}</span>
    </button>
  );
}
