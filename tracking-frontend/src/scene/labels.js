import * as THREE from 'three';

const LABEL_SIZE = { normal: [18, 4.5], selected: [20, 5] };

// Place label: a mono-caps pill with an ink outline. Night: a soft paper pill; day: white. The selected label turns
// chartreuse, like the selected building and list row. Type is always jet: on the pale fills, and on chartreuse.
const STYLES = {
  night: {
    fill: '#F5F5F2', stroke: '#0B0B0B', text: '#0B0B0B',
  },
  day: {
    fill: '#ffffff', stroke: '#0B0B0B', text: '#0B0B0B',
  },
  selectedNight: {
    fill: '#D4FF3F', stroke: '#0B0B0B', text: '#0B0B0B',
  },
  selectedDay: {
    fill: '#D4FF3F', stroke: '#0B0B0B', text: '#0B0B0B',
  },
};

export const LABEL_FONT = '500 40px "JetBrains Mono", ui-monospace, Consolas, monospace';

export function createLabelTexture(text, { mode = 'night', selected = false } = {}) {
  const style = selected
    ? (mode === 'day' ? STYLES.selectedDay : STYLES.selectedNight)
    : (STYLES[mode] ?? STYLES.night);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const inset = 6;
  const w = canvas.width - inset * 2;
  const h = canvas.height - inset * 2;
  context.beginPath();
  if (context.roundRect) context.roundRect(inset, inset, w, h, h / 2);
  else context.rect(inset, inset, w, h);
  context.fillStyle = style.fill;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = style.stroke;
  context.stroke();
  context.fillStyle = style.text;
  context.font = LABEL_FONT;
  if ('letterSpacing' in context) context.letterSpacing = '3px';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 2, w - 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createLabelSprite(zone, mode) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createLabelTexture(zone.id, { mode }),
      transparent: true,
      depthTest: false,
      toneMapped: false,
    }),
  );
  sprite.scale.set(...LABEL_SIZE.normal, 1);
  sprite.userData.zoneId = zone.id;
  sprite.renderOrder = 10;
  return sprite;
}

// Re-draws a label's texture (mode or selection changed) and frees the old one.
export function restyleLabel(sprite, zone, { mode, selected }) {
  sprite.material.map?.dispose();
  sprite.material.map = createLabelTexture(zone.id, { mode, selected });
  sprite.material.needsUpdate = true;
}

const clamp = THREE.MathUtils.clamp;

// Keeps labels legible without clutter: they grow a little with distance, fade when the camera is far away
// (but never vanish, so places stay discoverable) and soften when the camera is right on top of them.
// `hover` (0..1) brightens and enlarges a label slightly; `dim` (0..1) recedes the labels of unselected places.
// `viewScale` is how much bigger the scene is than the placeholder campus (the true-size tiles are ~5x): distances are
// measured in placeholder units and the label is drawn that much larger, so it reads the same on screen.
export function updateLabelDistance(sprite, selected, worldDistance, { hover = 0, dim = 0, viewScale = 1 } = {}) {
  const cameraDistance = worldDistance / viewScale;
  const [baseW, baseH] = selected ? LABEL_SIZE.selected : LABEL_SIZE.normal;
  const scale = clamp(cameraDistance / 120, 0.65, 1.4) * (1 + 0.08 * hover) * viewScale;
  sprite.scale.set(baseW * scale, baseH * scale, 1);
  if (selected) {
    sprite.material.opacity = 1;
    return;
  }
  const far = clamp(1 - (cameraDistance - 150) / 110, 0.3, 1);
  const near = cameraDistance < 30 ? clamp((cameraDistance - 12) / 18, 0.2, 1) : 1;
  const base = far * near * (1 - 0.5 * dim);
  sprite.material.opacity = base + (1 - base) * hover;
}
