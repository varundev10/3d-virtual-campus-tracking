import { useEffect } from 'react';
import { prefersReducedMotion } from '../../lib/quality.js';
import IntroLoader from './IntroLoader.jsx';
import PageTransition from './PageTransition.jsx';
import RaveMode from './RaveMode.jsx';
import ScrollProgress from './ScrollProgress.jsx';
import { initMagnetic, initReveal, initScrollSkew, initTilt } from './behaviors.js';

// The motion layer, mounted once inside the providers. Everything here is decoration over the app: it adds no routes,
// holds no data, and each piece switches itself off on touch screens or under reduced motion (see behaviors.js).
// .fx-on is what makes [data-reveal] content start hidden, so with no JavaScript, or reduced motion, it just shows.
export default function Fx() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const root = document.documentElement;
    root.classList.add('fx-on');

    const stopSkew = initScrollSkew();
    const stopTilt = initTilt();
    const magnetic = initMagnetic();
    const reveal = initReveal();

    // Pages mount and unmount as the route changes: pick up new magnetic buttons and [data-reveal] blocks.
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        magnetic.refresh();
        reveal.scan();
      }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      stopSkew();
      stopTilt();
      magnetic.stop();
      reveal.stop();
      root.classList.remove('fx-on');
    };
  }, []);

  return (
    <>
      <ScrollProgress />
      <PageTransition />
      <RaveMode />
      <IntroLoader />
    </>
  );
}
