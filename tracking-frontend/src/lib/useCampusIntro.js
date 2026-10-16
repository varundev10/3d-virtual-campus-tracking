import { useCallback, useEffect, useRef, useState } from 'react';
import { INTRO_SECONDS } from '../scene/introCamera.js';
import { markIntroPlayed } from './introSession.js';

// Phases: loading (real progress) -> title -> reveal (camera sweep) -> ready (Enter Campus) -> done.
// `off` means the intro does not play at all (already seen this session, deep link, or no WebGL).
const MIN_LOADING_MS = 700; // avoid a one-frame flash when everything is already cached
const TITLE_MS = 1800;
const TITLE_REDUCED_MS = 1200;
const REVEAL_GRACE_MS = 2500; // safety net if the scene never reports the end of its sweep
const SLOW_MS = 6000;
const STEP_TIMEOUT_MS = 4000; // bounds how long we wait on fonts; it does not advance the progress bar

// Weights give the real steps a sensible share of the bar. A skipped step (no model installed) is left out.
const WEIGHTS = { fonts: 1, data: 2, scene: 2, model: 3 };
const SETTLED = ['done', 'failed', 'skipped'];

function loadFonts() {
  if (!document.fonts?.load) return Promise.resolve('done');
  const loads = Promise.allSettled([
    document.fonts.load('600 20px "Space Grotesk"'),
    document.fonts.load('500 16px "Inter"'),
  ]).then(() => 'done');
  const timeout = new Promise((resolve) => { window.setTimeout(() => resolve('timeout'), STEP_TIMEOUT_MS); });
  return Promise.race([loads, timeout]);
}

function modelStep(model) {
  if (model.state === 'loaded') return { state: 'done', detail: 'Loaded' };
  if (model.state === 'placeholder') {
    return model.reason === 'error'
      ? { state: 'failed', detail: 'Could not load it. Using the generated campus layout' }
      : { state: 'skipped', detail: 'Not installed. Using the generated campus layout' };
  }
  return {
    state: 'active',
    progress: model.progress,
    detail: model.progress != null ? `${Math.round(model.progress * 100)}%` : 'Checking…',
  };
}

function stepFraction(step) {
  if (step.state === 'done' || step.state === 'failed') return 1;
  if (step.state === 'active') return step.progress ?? 0;
  return 0;
}

/**
 * Orchestrates the intro from the page's real loading state. Nothing here advances on a timer except short
 * dwell times between phases; the bar itself only moves when a real step makes progress.
 */
export function useCampusIntro({ enabled, locations, model, sceneReady, reducedMotion }) {
  const [phase, setPhase] = useState(enabled ? 'loading' : 'off');
  const [skipped, setSkipped] = useState(false);
  const [fonts, setFonts] = useState(enabled ? 'active' : 'done');
  const [slow, setSlow] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    startedAt.current = performance.now();
    loadFonts().then((result) => {
      if (!cancelled) setFonts(result === 'done' ? 'done' : 'failed');
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const steps = enabled ? [
    { id: 'fonts', label: 'Typography', state: fonts, detail: fonts === 'failed' ? 'Using system fonts' : '' },
    {
      id: 'data',
      label: 'Campus locations',
      state: locations.error ? 'failed' : locations.data ? 'done' : 'active',
      detail: locations.error ? 'Could not load them' : locations.data ? `${locations.data.length} loaded` : '',
    },
    { id: 'scene', label: '3D scene', state: sceneReady ? 'done' : 'active', detail: sceneReady ? 'First frame rendered' : '' },
    { id: 'model', label: 'Campus model', ...modelStep(model) },
  ].map((step) => ({ ...step, weight: WEIGHTS[step.id] })) : [];

  const counted = steps.filter((step) => step.state !== 'skipped');
  const totalWeight = counted.reduce((sum, step) => sum + step.weight, 0);
  const doneWeight = counted.reduce((sum, step) => sum + step.weight * stepFraction(step), 0);
  const percent = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 100;
  const settled = steps.every((step) => SETTLED.includes(step.state));

  // loading -> title once every real step has settled (and the screen has been up for a moment).
  useEffect(() => {
    if (phase !== 'loading' || !settled) return undefined;
    const wait = Math.max(0, MIN_LOADING_MS - (performance.now() - startedAt.current));
    const timer = window.setTimeout(() => setPhase('title'), wait);
    return () => window.clearTimeout(timer);
  }, [phase, settled]);

  // Offer a reminder that skipping is possible if loading drags on.
  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // title -> reveal (camera sweep), or straight to ready when the user prefers reduced motion.
  useEffect(() => {
    if (phase !== 'title') return undefined;
    const timer = window.setTimeout(
      () => setPhase(reducedMotion ? 'ready' : 'reveal'),
      reducedMotion ? TITLE_REDUCED_MS : TITLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    const timer = window.setTimeout(() => setPhase('ready'), INTRO_SECONDS * 1000 + REVEAL_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Once the loading screen has been left, the intro counts as seen for this session.
  useEffect(() => {
    if (phase !== 'loading' && phase !== 'off') markIntroPlayed();
  }, [phase]);

  const onSceneIntroEnd = useCallback(() => {
    setPhase((current) => (current === 'reveal' ? 'ready' : current));
  }, []);
  const skip = useCallback(() => {
    setSkipped(true);
    setPhase('done');
  }, []);
  const enter = useCallback(() => setPhase('done'), []);

  const active = phase !== 'off' && phase !== 'done';

  // What the 3D scene should be doing, derived from the phase so the two can never disagree.
  let sceneIntro = 'off';
  if (phase === 'loading') sceneIntro = 'hold';
  else if (phase === 'title') sceneIntro = reducedMotion ? 'settle' : 'hold';
  else if (phase === 'reveal') sceneIntro = 'play';
  else if (phase === 'done' && skipped) sceneIntro = 'skip';

  // Esc ends the intro from anywhere; it never needs a pointer.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (phase === 'ready') enter();
      else skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, phase, enter, skip]);

  // At the end, grabbing the scene itself also counts as "entering".
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const onPointer = () => enter();
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [phase, enter]);

  return { phase, active, steps, percent, slow, sceneIntro, onSceneIntroEnd, skip, enter };
}
