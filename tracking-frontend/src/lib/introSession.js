// The cinematic intro plays once per browser session (tab). sessionStorage survives reloads of the tab; the
// in-memory flag keeps the rule true for route changes even when storage is unavailable (private mode).
const KEY = 'ucer.introPlayed';
let playedInMemory = false;

export function hasPlayedIntro() {
  if (playedInMemory) return true;
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroPlayed() {
  playedInMemory = true;
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage unavailable; the in-memory flag still covers this page load.
  }
}
