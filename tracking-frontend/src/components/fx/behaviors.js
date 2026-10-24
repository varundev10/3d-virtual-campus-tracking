// Global, delegated pointer and scroll behaviours of the motion layer. Each init function returns its own cleanup and
// does nothing on touch screens or under reduced motion, so no listener is attached where the effect cannot show.
// Markup opts in with data attributes: [data-tilt], [data-magnetic] (and every .btn-primary), [data-skew], [data-reveal].
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---- Scroll-velocity skew: large type and marquees lean with scroll speed and settle back to 0. ----
export function initScrollSkew() {
  let last = window.scrollY;
  let lastTime = performance.now();
  let skew = 0;
  let target = 0;
  let raf = 0;

  const apply = (value) => {
    document.querySelectorAll('[data-skew]').forEach((el) => {
      if (value === null) el.style.removeProperty('--skew');
      else el.style.setProperty('--skew', `${value.toFixed(2)}deg`);
    });
  };
  const tick = () => {
    skew += (target - skew) * 0.14;
    target *= 0.88;
    if (Math.abs(skew) > 0.03 || Math.abs(target) > 0.03) {
      apply(skew);
      raf = requestAnimationFrame(tick);
    } else {
      apply(null);
      raf = 0;
    }
  };
  const onScroll = () => {
    const now = performance.now();
    const velocity = (window.scrollY - last) / Math.max(now - lastTime, 1); // px per ms
    last = window.scrollY;
    lastTime = now;
    target = clamp(velocity * 1.6, -5, 5);
    if (!raf) raf = requestAnimationFrame(tick);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
    apply(null);
  };
}

// ---- Card tilt (<= --tilt-max, 6deg) with a light glint that follows the pointer. ----
export function initTilt() {
  if (!canHover()) return () => {};
  const MAX = 6;
  let current = null;
  const reset = (el) => ['--rx', '--ry', '--gx', '--gy'].forEach((name) => el.style.removeProperty(name));

  const onMove = (event) => {
    const el = event.target instanceof Element ? event.target.closest('[data-tilt]') : null;
    if (current && current !== el) reset(current);
    current = el;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', `${((0.5 - py) * 2 * MAX).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    if (current) reset(current);
    current = null;
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  return () => {
    document.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    onLeave();
  };
}

// ---- Magnetic primary buttons: drift a few pixels toward a pointer that is close, then settle. ----
export function initMagnetic() {
  if (!canHover()) return { refresh() {}, stop() {} };
  const RADIUS = 80;
  const PULL = 0.28;
  const MAX = 10;
  const applied = new WeakMap();
  let items = [];
  let pointer = null;
  let raf = 0;

  const refresh = () => {
    items.forEach((el) => {
      if (!el.isConnected) applied.delete(el);
    });
    items = [...document.querySelectorAll('.btn-primary:not(:disabled), [data-magnetic]')];
  };
  const set = (el, x, y) => {
    applied.set(el, [x, y]);
    el.style.setProperty('--mag-x', `${x.toFixed(1)}px`);
    el.style.setProperty('--mag-y', `${y.toFixed(1)}px`);
  };
  const clear = (el) => {
    if (!applied.has(el)) return;
    applied.delete(el);
    el.style.removeProperty('--mag-x');
    el.style.removeProperty('--mag-y');
  };
  const frame = () => {
    raf = 0;
    if (!pointer) {
      items.forEach(clear);
      return;
    }
    items.forEach((el) => {
      const [ox, oy] = applied.get(el) ?? [0, 0];
      const rect = el.getBoundingClientRect();
      // The rect already includes the current drift; take it back out so the button does not chase itself.
      const cx = rect.left - ox + rect.width / 2;
      const cy = rect.top - oy + rect.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const gap = Math.hypot(Math.max(Math.abs(dx) - rect.width / 2, 0), Math.max(Math.abs(dy) - rect.height / 2, 0));
      if (gap < RADIUS) set(el, clamp(dx * PULL, -MAX, MAX), clamp(dy * PULL, -MAX, MAX));
      else clear(el);
    });
  };
  const onMove = (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onLeave = () => {
    pointer = null;
    if (!raf) raf = requestAnimationFrame(frame);
  };

  refresh();
  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  return {
    refresh,
    stop() {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      items.forEach(clear);
    },
  };
}

// ---- Scroll-triggered entrances: [data-reveal] fades and rises once when it first enters the viewport. ----
export function initReveal() {
  if (!('IntersectionObserver' in window)) return { scan() {}, stop() {} };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  const scan = () => {
    document.querySelectorAll('[data-reveal]:not(.is-in):not([data-reveal-seen])').forEach((el) => {
      el.setAttribute('data-reveal-seen', '');
      observer.observe(el);
    });
  };
  scan();
  return { scan, stop: () => observer.disconnect() };
}
