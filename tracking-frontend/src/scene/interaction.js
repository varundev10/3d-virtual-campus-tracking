import * as THREE from 'three';

// Hover / selection visuals for the placeholder buildings. Every value is eased toward its target each frame,
// so nothing snaps: buildings rise and shade on hover, the selected building lights up in gold and ivory, and the rest of the
// campus recedes into the ground.
const DEFAULT_PALETTE = {
  hover: '#d7b477', hoverWall: '#613546', hoverRoof: '#b3945a', outline: '#d7b477',
  selectWall: '#faf3eb', selectRoof: '#d7b477', dim: '#210c13', dimAmount: 0.55, emissive: 0.2,
};

const colors = {
  hover: new THREE.Color(),
  hoverWall: new THREE.Color(),
  hoverRoof: new THREE.Color(),
  outline: new THREE.Color(),
  selectWall: new THREE.Color(),
  selectRoof: new THREE.Color(),
  dim: new THREE.Color(),
};
const settings = { dimAmount: 0.6, emissive: 0 };

// Called by applyEnvironment whenever the day / night look changes.
export function setInteractionPalette(palette = DEFAULT_PALETTE) {
  Object.keys(colors).forEach((key) => colors[key].set(palette[key]));
  settings.dimAmount = palette.dimAmount;
  settings.emissive = palette.emissive;
}
setInteractionPalette();

const HOVER_LIFT = 0.7;
const SELECT_LIFT = 0.9;

// Frame-rate independent exponential approach: reaches ~63% of the way in 1/rate seconds.
export const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

const noRaycast = () => {};

// Thin edge lines around the walls and roof slab, drawn slightly outside the surfaces so they never z-fight.
export function createOutline(width, depth, height) {
  const material = new THREE.LineBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const body = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 1.012, height * 1.004, depth * 1.012)),
    material,
  );
  body.position.y = height / 2;
  const roof = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry((width + 1.5) * 1.01, 1.4 * 1.06, (depth + 1.5) * 1.01)),
    material,
  );
  roof.position.y = height + 1;
  body.raycast = noRaycast;
  roof.raycast = noRaycast;
  const group = new THREE.Group();
  group.add(body, roof);
  group.visible = false;
  return { group, material };
}

function restEntry(entry) {
  entry.hover = 0;
  entry.select = 0;
  entry.dim = 0;
  entry.group.position.y = 0;
  entry.group.scale.setScalar(1);
  entry.blob.position.y = 0.26;
  entry.pin.ring.position.y = 0.3;
  entry.label.position.y = entry.labelY;
  entry.building.material.color.copy(entry.building.material.userData.base);
  entry.roof.material.color.copy(entry.roof.material.userData.base);
  entry.building.material.emissiveIntensity = 0;
  entry.roof.material.emissiveIntensity = 0;
  entry.outline.group.visible = false;
  entry.outline.material.opacity = 0;
  entry.pin.diamond.material.emissiveIntensity = 0.75;
  entry.pin.diamond.scale.setScalar(1);
}

// Advances one building's hover / select / dim state and applies it. Entries at rest are skipped entirely.
export function updateEntryVisuals(entry, dt, time, motion) {
  entry.hover = damp(entry.hover, entry.hoverTarget, 14, dt);
  entry.select = damp(entry.select, entry.selected ? 1 : 0, 8, dt);
  entry.dim = damp(entry.dim, entry.dimTarget, 6, dt);

  const settled = entry.hover < 0.002 && entry.select < 0.002 && entry.dim < 0.002;
  if (settled && !entry.hoverTarget && !entry.selected && !entry.dimTarget) {
    if (!entry.atRest) {
      restEntry(entry);
      entry.atRest = true;
    }
    return;
  }
  entry.atRest = false;

  const { hover, select, dim } = entry;
  const lift = hover * HOVER_LIFT + select * SELECT_LIFT;
  entry.group.position.y = lift;
  entry.group.scale.setScalar(1 + 0.012 * select);
  // Keep the contact shadow and the ground ring on the ground while the building rises.
  entry.blob.position.y = 0.26 - lift;
  entry.pin.ring.position.y = 0.3 - lift;
  entry.label.position.y = entry.labelY + lift;

  const wall = entry.building.material;
  const roof = entry.roof.material;
  // Hover shades the walls toward the hover tone, selection inverts them, dimming fades them into the ground.
  wall.color.copy(wall.userData.base).lerp(colors.hoverWall, hover * 0.8).lerp(colors.selectWall, select)
    .lerp(colors.dim, settings.dimAmount * dim);
  roof.color.copy(roof.userData.base).lerp(colors.hoverRoof, hover * 0.8).lerp(colors.selectRoof, select)
    .lerp(colors.dim, settings.dimAmount * dim * 0.6);
  wall.emissive.copy(colors.hover);
  roof.emissive.copy(colors.hover);
  wall.emissiveIntensity = settings.emissive * Math.max(hover, select);
  roof.emissiveIntensity = wall.emissiveIntensity * 0.5;

  // The edge lines trace the building on hover and hold on selection, breathing very slightly.
  const breathe = motion ? 0.08 * select * Math.sin(time * 3) : 0;
  const outline = Math.max(hover * 0.75, select) + breathe;
  entry.outline.material.opacity = outline;
  entry.outline.material.color.copy(colors.outline);
  entry.outline.group.visible = outline > 0.01;

  const emphasis = Math.max(hover, select);
  entry.pin.diamond.material.emissiveIntensity = 0.75 + 0.6 * emphasis;
  entry.pin.diamond.scale.setScalar(1 + 0.3 * emphasis);
}
