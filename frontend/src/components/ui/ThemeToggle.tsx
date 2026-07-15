import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const { theme, toggle } = useThemeStore();

  return (
    <button
      onClick={() => { haptic('toggle_click'); playSound('toggle_click'); toggle(); }}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex items-center justify-center rounded-full',
        'bg-white/10 border border-white/15 hover:bg-white/20 hover:border-white/25',
        'active:scale-90 transition-all duration-200',
        inline
          ? 'w-9 h-9'
          : 'hidden sm:flex fixed top-5 end-5 z-50 w-9 h-9 backdrop-blur-sm shadow-md'
      )}
      aria-label="Toggle theme"
    >
      {/* Lucide icon, not emoji — a font-rendered 🌙/☀️ pair has visibly
          different glyph metrics per platform, so flexbox centering the
          line box still leaves the actual ink off-center (reported live).
          An SVG icon has exact, predictable geometry. */}
      {theme === 'dark' ? <Moon size={15} className="text-text-muted" /> : <Sun size={15} className="text-text-muted" />}
    </button>
  );
}
