'use client';

import { useEffect, useState } from 'react';

/** Ekran koşulu sağlanıyorsa true; sunucuda ve ilk çizimde null. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
