import { useEffect } from 'react';
import { useToast } from '../ui/Toast.jsx';
import { prefersReducedMotion } from '../../lib/quality.js';

// Easter egg. The Konami code (up up down down left right left right B A) or five quick clicks on the logo swap pink
// and chartreuse (one class on <html>, see the end of styles/tokens.css), speed the marquees up and wash the screen once
// with a slow, strobe-free pulse. A toast confirms it and offers "Exit rave mode". Purely cosmetic: it touches no data,
// no route and no request. Under reduced motion only the static palette swap and the toast remain.
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const KEY = 'ucer.rave';
const CLICKS = 5;
const CLICK_WINDOW_MS = 2500;
const TYPING = 'input, textarea, select, [contenteditable="true"]';

export default function RaveMode() {
  const toast = useToast();

  useEffect(() => {
    const root = document.documentElement;
    let progress = 0;
    let clicks = [];
    let burstTimer = 0;

    const apply = (on, announce) => {
      root.classList.toggle('rave', on);
      try {
        window.sessionStorage.setItem(KEY, on ? '1' : '0');
      } catch {
        // Storage unavailable: rave mode simply lasts until reload.
      }
      if (on && !prefersReducedMotion()) {
        root.classList.add('rave-burst');
        window.clearTimeout(burstTimer);
        burstTimer = window.setTimeout(() => root.classList.remove('rave-burst'), 1500);
      }
      if (!announce) return;
      if (on) {
        toast.info('Rave mode is on. Pink and chartreuse have traded places.', {
          duration: 9000,
          action: { label: 'Exit rave mode', onClick: () => apply(false, false) },
        });
      } else {
        toast.info('Rave mode is off.');
      }
    };
    const toggle = () => apply(!root.classList.contains('rave'), true);

    try {
      if (window.sessionStorage.getItem(KEY) === '1') apply(true, false);
    } catch {
      // Ignore: start in the normal palette.
    }

    const onKey = (event) => {
      if (event.target instanceof Element && event.target.closest(TYPING)) return;
      const key = event.key.toLowerCase();
      if (key === KONAMI[progress]) {
        progress += 1;
        if (progress === KONAMI.length) {
          progress = 0;
          toggle();
        }
      } else {
        progress = key === KONAMI[0] ? 1 : 0;
      }
    };
    const onClick = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.brand-lockup')) return;
      const now = performance.now();
      clicks = [...clicks.filter((time) => now - time < CLICK_WINDOW_MS), now];
      if (clicks.length >= CLICKS) {
        clicks = [];
        toggle();
      }
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      window.clearTimeout(burstTimer);
    };
  }, [toast]);

  return <div className="rave-wash" aria-hidden="true" />;
}
