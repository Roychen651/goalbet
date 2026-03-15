import { useThemeStore } from '../../stores/themeStore';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed top-4 end-4 z-50 w-9 h-9 rounded-full flex items-center justify-center text-lg
        bg-white/10 border border-white/15 backdrop-blur-sm
        hover:bg-white/20 hover:border-white/25
        active:scale-90
        transition-all duration-200 shadow-md
        sm:top-5 sm:end-5"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
