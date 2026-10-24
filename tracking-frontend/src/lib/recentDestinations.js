// Recent destinations are a per-device convenience kept in localStorage, keyed by user id.
const MAX_RECENT = 6;
const keyFor = (userId) => `campus.recentDestinations.${userId}`;

export function readRecentDestinations(userId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((code) => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecentDestination(userId, code) {
  const next = [code, ...readRecentDestinations(userId).filter((c) => c !== code)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Storage unavailable; recents simply won't persist.
  }
  return next;
}

export function clearRecentDestinations(userId) {
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
