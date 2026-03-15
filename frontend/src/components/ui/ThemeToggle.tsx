import { useThemeStore } from '../../stores/themeStore';
import { cn } from '../../lib/utils';

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const { theme, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex items-center justify-center text-lg rounded-full',
        'bg-white/10 border border-white/15 hover:bg-white/20 hover:border-white/25',
        'active:scale-90 transition-all duration-200',
        inline
          ? 'w-9 h-9'
          : 'hidden sm:flex fixed top-5 end-5 z-50 w-9 h-9 backdrop-blur-sm shadow-md'
      )}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
