// Page-transition hand-off between router links and the diagonal wipe (components/fx/PageTransition.jsx).
// The router itself is untouched: Link asks for the cover half of the wipe, then calls the unchanged navigate().
// If the wipe is not mounted, is disabled (reduced motion) or takes too long, navigation happens immediately, so
// a transition can never block a route change, an auth redirect or a deep link.
let handle = null;

export function registerTransition(next) {
  handle = next;
  return () => {
    if (handle === next) handle = null;
  };
}

const SAFETY_MS = 450;

export function coverThen(go) {
  if (!handle || !handle.enabled()) {
    go();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    go();
  };
  const timer = window.setTimeout(run, SAFETY_MS);
  handle.cover().then(() => {
    window.clearTimeout(timer);
    run();
  }, run);
}
