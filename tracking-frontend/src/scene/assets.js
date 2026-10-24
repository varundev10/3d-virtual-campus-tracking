import * as THREE from 'three';

// Deterministic PRNG so decorative scatter (stars, windows, particles) looks the same on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.shared = true;
  return texture;
}

// Small procedural textures shared by the whole scene (lamp halos, soft contact shadows, cloud shadows).
// Everything is drawn on a canvas, so no image files are loaded.
export function createAssets() {
  // Soft white blob: lamp halos and the pools of light on the ground.
  const glow = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Soft dark blob: fake ambient occlusion under each building, so it sits on the ground even with shadows off.
  const blob = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Irregular cloud-shaped blob: slow drifting cloud shadows on the ground.
  const cloud = canvasTexture(256, (ctx, s) => {
    const random = mulberry32(7);
    for (let i = 0; i < 9; i += 1) {
      const x = s * (0.25 + random() * 0.5);
      const y = s * (0.3 + random() * 0.4);
      const r = s * (0.16 + random() * 0.14);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });

  return {
    glow,
    blob,
    cloud,
    dispose() {
      glow.dispose();
      blob.dispose();
      cloud.dispose();
    },
  };
}
