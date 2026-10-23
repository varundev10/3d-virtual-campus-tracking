import { lazy, Suspense } from 'react';

// The 3D scene (three.js and its loaders) is the heaviest part of the app, so it loads as its own chunk: the
// sign-in and dashboard pages are interactive before it arrives, and the explorer fetches it while the intro runs.
const loadScene = () => import('./CampusScene.jsx');
const CampusScene = lazy(loadScene);

// Fetch the chunk ahead of need (after sign-in, when the browser is idle) so opening the explorer does not wait for it.
export function preloadCampusScene() {
  loadScene().catch(() => {});
}

export default function LazyCampusScene(props) {
  return (
    <Suspense fallback={<div className="campus-scene scene-loading" aria-hidden="true" />}>
      <CampusScene {...props} />
    </Suspense>
  );
}
