import { useEffect, useState } from 'react';

/** Tiny matchMedia wrapper. Query strings should match Tailwind's own
 * breakpoints (e.g. '(min-width: 640px)' for `sm:`) so this never becomes a
 * second, drifting source of truth for what "desktop" means in this app. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
