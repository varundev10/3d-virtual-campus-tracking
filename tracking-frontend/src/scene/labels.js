import * as THREE from 'three';

const LABEL_SIZE = { normal: [18, 4.5], selected: [22, 5.5] };

// Glass "HUD tag" label. Night: dark plate with a cyan hairline. Day: frosted light plate with a teal hairline.
// Selected: solid cyan in both modes.
const STYLES = {
  night: {
    fill: 'rgba(7, 13, 26, 0.84)', stroke: 'rgba(34, 211, 238, 0.55)', text: '#e8f0ff',
  },
  day: {
    fill: 'rgba(255, 255, 255, 0.9)', stroke: 'rgba(14, 116, 144, 0.6)', text: '#0b1424',
  },
  selected: {
    fill: 'rgba(34, 211, 238, 0.96)', stroke: 'rgba(207, 250, 254, 0.95)', text: '#031018',
  },
};

export function createLabelTexture(text, { mode = 'night', selected = false } = {}) {
  const style = selected ? STYLES.selected : (STYLES[mode] ?? STYLES.night);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const inset = 6;
  const w = canvas.width - inset * 2;
  const h = canvas.height - inset * 2;
  context.beginPath();
  if (context.roundRect) context.roundRect(inset, inset, w, h, 26);
  else context.rect(inset, inset, w, h);
  context.fillStyle = style.fill;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = style.stroke;
  context.stroke();
  context.fillStyle = style.text;
  context.font = '600 46px "Space Grotesk", Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, w - 40);
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
export function updateLabelDistance(sprite, selected, cameraDistance) {
  const [baseW, baseH] = selected ? LABEL_SIZE.selected : LABEL_SIZE.normal;
  const scale = clamp(cameraDistance / 120, 0.65, 1.4);
  sprite.scale.set(baseW * scale, baseH * scale, 1);
  if (selected) {
    sprite.material.opacity = 1;
    return;
  }
  const far = clamp(1 - (cameraDistance - 150) / 110, 0.3, 1);
  const near = cameraDistance < 30 ? clamp((cameraDistance - 12) / 18, 0.2, 1) : 1;
  sprite.material.opacity = far * near;
}
