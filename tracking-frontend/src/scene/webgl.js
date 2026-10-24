let cached = null;

// three.js needs WebGL 2. Probe once (and release the probe context straight away) so pages can choose a
// non-3D layout before they try to create a renderer, which would otherwise throw and blank the page.
export function isWebGLAvailable() {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = window.WebGL2RenderingContext ? canvas.getContext('webgl2') : null;
    cached = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
