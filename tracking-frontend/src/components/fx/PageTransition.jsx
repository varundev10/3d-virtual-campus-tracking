import { useEffect, useRef } from 'react';
import { useRouter } from '../../lib/router.jsx';
import { registerTransition } from '../../lib/transition.js';
import { prefersReducedMotion } from '../../lib/quality.js';
import Motif from './Motif.jsx';

// A diagonal pink wipe between routes, under 600 ms in total: it sweeps over the old page (cover, ~240 ms), the router
// swaps the page underneath, then it sweeps off to reveal the new one (~340 ms). Link asks for the cover half
// (lib/transition.js) and then calls the unchanged navigate(). Back/forward and redirects change the path without a
// cover, so they only get a quick reveal. The wipe is pointer-events: none except while covering, and it can never
// hold a navigation back (see the safety timer in lib/transition.js).
const SLANT = 30; // percent the wipe edge leans over the full height
const HIDDEN = `polygon(-40% 0, -10% 0, -40% 100%, -40% 100%)`;
const COVERED = `polygon(-40% 0, ${140}% 0, ${140 - SLANT}% 100%, -40% 100%)`;
const REVEALED = `polygon(${140}% 0, 150% 0, 150% 100%, ${140 - SLANT}% 100%)`;
const FULL = `polygon(-10% 0, 150% 0, 150% 100%, -40% 100%)`;

export default function PageTransition() {
  const panel = useRef(null);
  const covered = useRef(false);
  const mounted = useRef(false);
  const startedAt = useRef(performance.now());
  const current = useRef(null);
  const { path } = useRouter();

  // One animation at a time: starting a new sweep cancels the previous one, so finished sweeps do not pile up.
  const sweep = (frames, duration) => {
    const el = panel.current;
    current.current?.cancel();
    el.style.visibility = 'visible';
    const run = el.animate({ clipPath: frames }, { duration, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', fill: 'forwards' });
    current.current = run;
    return run.finished.then(() => run, () => null);
  };
  const reveal = () => {
    covered.current = false;
    return sweep([FULL, REVEALED], 340).then((run) => {
      if (!run || current.current !== run) return;
      panel.current.style.visibility = 'hidden';
      panel.current.style.pointerEvents = 'none';
    });
  };

  useEffect(() => registerTransition({
    enabled: () => !prefersReducedMotion() && document.visibilityState === 'visible',
    cover: async () => {
      panel.current.style.pointerEvents = 'auto';
      await sweep([HIDDEN, COVERED], 240);
      covered.current = true;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sweep and reveal only touch refs
  }), []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (prefersReducedMotion()) return;
    // A path change that arrives while already covered (a Link click) reveals; one that arrives on its own (back/forward,
    // a redirect after sign-in) gets a quick reveal. Redirects during the first moments after load are not decorated.
    if (!covered.current && performance.now() - startedAt.current < 1200) return;
    reveal();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on route change only
  }, [path]);

  return (
    <div className="page-wipe is-pink" ref={panel} aria-hidden="true">
      <Motif size={72} spin />
    </div>
  );
}
