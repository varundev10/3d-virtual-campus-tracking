import { useCallback, useSyncExternalStore } from 'react';

// Tracks a CSS media query, e.g. useMediaQuery('(max-width: 920px)').
export function useMediaQuery(query) {
  const subscribe = useCallback((notify) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
