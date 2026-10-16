import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMPUS_ZONES, locationToScenePoint } from '../lib/campus.js';
import { CAMPUS_MODEL_TRANSFORM, getModelFormat } from '../lib/modelConfig.js';
import Icon from './ui/Icon.jsx';

const ACCENT = '#22d3ee';

// Scene environment per day/night mode. Applied to existing objects in place (see applyEnvironment)
// so switching never rebuilds the renderer, camera or controls.
const ENVIRONMENTS = {
  night: {
    sky: '#070d1a', fogNear: 120, fogFar: 260,
    ground: '#0d1a2c', road: '#1a2a40', roof: '#1e2c44', gridMajor: '#1d6b86', gridMinor: '#16324d', gridOpacity: 0.55,
    hemiSky: '#d6e8ff', hemiGround: '#0a1424', hemi: 2.4, sunColor: '#e6f0ff', sun: 2.8, rim: 0.9,
  },
  day: {
    sky: '#b9d3ea', fogNear: 160, fogFar: 320,
    ground: '#9fb7a4', road: '#5c6b78', roof: '#e9eef5', gridMajor: '#6f8f86', gridMinor: '#8aa598', gridOpacity: 0.35,
    hemiSky: '#ffffff', hemiGround: '#7b8f86', hemi: 2.6, sunColor: '#fff3d6', sun: 3.2, rim: 0.25,
  },
};

function applyEnvironment(env, zoneObjects, mode) {
  const palette = ENVIRONMENTS[mode] ?? ENVIRONMENTS.night;
  env.scene.background.set(palette.sky);
  env.scene.fog.color.set(palette.sky);
  env.scene.fog.near = palette.fogNear;
  env.scene.fog.far = palette.fogFar;
  env.ground.material.color.set(palette.ground);
  env.road.color.set(palette.road);
  // GridHelper stores its two line colors per vertex; rebuild just that color buffer.
  const colors = env.grid.geometry.getAttribute('color');
  const major = new THREE.Color(palette.gridMajor);
  const minor = new THREE.Color(palette.gridMinor);
  // Four vertices per grid line; the middle line uses the "major" color, as in GridHelper itself.
  const lines = colors.count / 4;
  const center = (lines - 1) / 2;
  for (let line = 0; line < lines; line += 1) {
    const c = line === center ? major : minor;
    for (let k = 0; k < 4; k += 1) colors.setXYZ(line * 4 + k, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  env.grid.material.opacity = palette.gridOpacity;
  env.hemi.color.set(palette.hemiSky);
  env.hemi.groundColor.set(palette.hemiGround);
  env.hemi.intensity = palette.hemi;
  env.sun.color.set(palette.sunColor);
  env.sun.intensity = palette.sun;
  env.rim.intensity = palette.rim;
  zoneObjects.forEach(({ roof }) => roof.material.color.set(palette.roof));
}
const START_CAMERA = new THREE.Vector3(78, 72, 86);

// Glass "HUD tag" label: rounded dark plate with a cyan hairline; solid cyan when selected.
function createLabelTexture(text, selected = false) {
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
  context.fillStyle = selected ? 'rgba(34, 211, 238, 0.96)' : 'rgba(7, 13, 26, 0.84)';
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = selected ? 'rgba(207, 250, 254, 0.95)' : 'rgba(34, 211, 238, 0.55)';
  context.stroke();
  context.fillStyle = selected ? '#031018' : '#e8f0ff';
  context.font = '600 46px "Space Grotesk", Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, w - 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Builds one placeholder building (into `buildings`) and its label (into `labels`, which stays
// visible over a loaded Metashape model so locations remain selectable).
function addBuilding(buildings, labels, zone, height, size) {
  const group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);

  const geometry = new THREE.BoxGeometry(size.width, height, size.depth);
  const material = new THREE.MeshStandardMaterial({
    color: zone.color,
    roughness: 0.42,
    metalness: 0.18,
  });
  const building = new THREE.Mesh(geometry, material);
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  building.userData.zoneId = zone.id;
  group.add(building);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(size.width + 1.5, 1.4, size.depth + 1.5),
    new THREE.MeshStandardMaterial({ color: '#1e2c44', roughness: 0.45, metalness: 0.3 }),
  );
  roof.position.y = height + 1;
  roof.castShadow = true;
  roof.userData.zoneId = zone.id;
  group.add(roof);

  buildings.add(group);

  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createLabelTexture(zone.id),
      transparent: true,
      depthTest: false,
    }),
  );
  label.scale.set(18, 4.5, 1);
  label.position.set(zone.x, height + 6, zone.z);
  label.userData.zoneId = zone.id;
  label.renderOrder = 10;
  labels.add(label);

  return { building, roof, label, height };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh && !child.isSprite && !child.isLine) return;
    child.geometry?.dispose();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
    });
  });
}

function clearGroup(group) {
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
}

function createPlaceholderCampus() {
  const group = new THREE.Group();
  group.name = 'placeholder-campus';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 120),
    new THREE.MeshStandardMaterial({ color: '#0d1a2c', roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Blueprint grid over the ground plane, squashed to the ground's 170 x 120 footprint.
  const grid = new THREE.GridHelper(170, 34, '#1d6b86', '#16324d');
  grid.scale.z = 120 / 170;
  grid.position.y = 0.04;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  group.add(grid);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#1a2a40', roughness: 0.7, metalness: 0.1 });
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(150, 0.18, 7), roadMaterial);
  mainRoad.position.set(0, 0.12, 0);
  group.add(mainRoad);

  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 95), roadMaterial);
  crossRoad.position.set(6, 0.14, 0);
  group.add(crossRoad);

  const buildings = new THREE.Group();
  buildings.name = 'placeholder-buildings';
  group.add(buildings);

  const geofenceShape = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-72, 0.45, -50),
      new THREE.Vector3(66, 0.45, -48),
      new THREE.Vector3(74, 0.45, 42),
      new THREE.Vector3(-58, 0.45, 52),
    ]),
    new THREE.LineBasicMaterial({ color: ACCENT, linewidth: 2 }),
  );
  group.add(geofenceShape);

  return { group, buildings, ground, grid, road: roadMaterial };
}

function prepareCampusModel(object) {
  object.name = 'metashape-campus-model';
  object.scale.setScalar(CAMPUS_MODEL_TRANSFORM.scale);
  object.position.set(
    CAMPUS_MODEL_TRANSFORM.position.x,
    CAMPUS_MODEL_TRANSFORM.position.y,
    CAMPUS_MODEL_TRANSFORM.position.z,
  );
  object.rotation.set(
    CAMPUS_MODEL_TRANSFORM.rotation.x,
    CAMPUS_MODEL_TRANSFORM.rotation.y,
    CAMPUS_MODEL_TRANSFORM.rotation.z,
  );

  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    if (!child.material) {
      child.material = new THREE.MeshStandardMaterial({ color: '#9fb3c8', roughness: 0.82 });
    }
  });
}

function createPin(color = ACCENT) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 5, 16),
    new THREE.MeshStandardMaterial({ color: '#cfdcee', metalness: 0.4, roughness: 0.3 }),
  );
  stem.position.y = 2.5;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 24, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }),
  );
  head.position.y = 6.2;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.08, 10, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;

  group.add(stem, head, ring);
  return group;
}

export default function CampusScene({
  locations,
  currentPosition,
  campusModelUrl,
  onModelStatus,
  zones = CAMPUS_ZONES,
  selectedZoneId = null,
  onSelectZone,
  route = null,
  label = '3D campus model',
  showControls = true,
  mode = 'night',
}) {
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const sceneRef = useRef(null);
  const placeholderRef = useRef(null);
  const buildingsRef = useRef(null);
  const labelsRef = useRef(null);
  const zoneObjectsRef = useRef(new Map());
  const modelRef = useRef(null);
  const routeRef = useRef(null);
  const focusRef = useRef(null);
  const cameraGoalRef = useRef(null);
  const viewRef = useRef(null);
  const envRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onSelectRef = useRef(onSelectZone);
  onSelectRef.current = onSelectZone;

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d1a');
    scene.fog = new THREE.Fog('#070d1a', 120, 260);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 1000);
    camera.position.copy(START_CAMERA);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 25;
    controls.maxDistance = 220;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', () => {
      focusRef.current = null;
      cameraGoalRef.current = null;
    });
    viewRef.current = { camera, controls };

    // Cool "night operations" lighting, still bright enough for a textured Metashape model.
    const ambient = new THREE.HemisphereLight('#d6e8ff', '#0a1424', 2.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight('#e6f0ff', 2.8);
    sun.position.set(40, 90, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    const rim = new THREE.DirectionalLight('#67e8f9', 0.9);
    rim.position.set(-60, 40, -70);
    scene.add(rim);

    const placeholder = createPlaceholderCampus();
    placeholderRef.current = placeholder.group;
    buildingsRef.current = placeholder.buildings;
    envRef.current = {
      scene, ground: placeholder.ground, grid: placeholder.grid, road: placeholder.road, hemi: ambient, sun, rim,
    };
    applyEnvironment(envRef.current, zoneObjectsRef.current, modeRef.current);
    scene.add(placeholder.group);

    const labels = new THREE.Group();
    labels.name = 'location-labels';
    labelsRef.current = labels;
    scene.add(labels);

    // Click (not drag) on a building or label selects that location.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pickZone = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets = [...labels.children];
      if (placeholder.group.visible) targets.push(...placeholder.buildings.children);
      const hit = raycaster.intersectObjects(targets, true).find((h) => h.object.userData.zoneId);
      return hit?.object.userData.zoneId ?? null;
    };
    const handleDown = (event) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const handleUp = (event) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const zoneId = pickZone(event);
      if (zoneId) onSelectRef.current?.(zoneId);
    };
    const handleMove = (event) => {
      if (!onSelectRef.current || event.buttons) return;
      renderer.domElement.style.cursor = pickZone(event) ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', handleDown);
    renderer.domElement.addEventListener('pointerup', handleUp);
    renderer.domElement.addEventListener('pointermove', handleMove);

    let frame;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      markersRef.current.forEach((marker) => {
        marker.position.y = Math.sin(elapsed * 2.4 + marker.position.x) * 0.35;
        marker.rotation.y += 0.012;
      });
      if (focusRef.current) {
        controls.target.lerp(focusRef.current, 0.08);
        if (controls.target.distanceTo(focusRef.current) < 0.1) focusRef.current = null;
      }
      if (cameraGoalRef.current) {
        camera.position.lerp(cameraGoalRef.current, 0.12);
        if (camera.position.distanceTo(cameraGoalRef.current) < 0.1) cameraGoalRef.current = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handleDown);
      renderer.domElement.removeEventListener('pointerup', handleUp);
      renderer.domElement.removeEventListener('pointermove', handleMove);
      controls.dispose();
      viewRef.current = null;
      envRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      if (modelRef.current) disposeObject(modelRef.current);
      if (placeholderRef.current) disposeObject(placeholderRef.current);
      disposeObject(labels);
      markersRef.current.clear();
      zoneObjectsRef.current.clear();
    };
  }, []);

  // Rebuild buildings and labels whenever the location list changes.
  useEffect(() => {
    const buildings = buildingsRef.current;
    const labels = labelsRef.current;
    if (!buildings || !labels) return;

    clearGroup(buildings);
    clearGroup(labels);
    zoneObjectsRef.current.clear();

    zones.forEach((zone, index) => {
      const objects = addBuilding(buildings, labels, zone, 9 + (index % 3) * 3, {
        width: 16 + (index % 2) * 4,
        depth: 13 + (index % 3) * 3,
      });
      // Built unselected; the highlight effect below restyles the selected zone, if any.
      zoneObjectsRef.current.set(zone.id, { ...objects, zone, selected: false });
    });
    if (envRef.current) applyEnvironment(envRef.current, zoneObjectsRef.current, modeRef.current);
  }, [zones]);

  // Day / night: restyle in place. Camera, controls and selection are untouched.
  useEffect(() => {
    if (envRef.current) applyEnvironment(envRef.current, zoneObjectsRef.current, mode);
  }, [mode]);

  // Highlight and focus the selected location. Only zones whose highlight state actually changes get a
  // new label texture (the old and new selection), not every label on each click.
  useEffect(() => {
    zoneObjectsRef.current.forEach((entry, id) => {
      const { building, label: sprite, zone } = entry;
      const selected = id === selectedZoneId;
      if (entry.selected === selected) return;
      entry.selected = selected;
      building.material.emissive = new THREE.Color(selected ? ACCENT : '#000000');
      building.material.emissiveIntensity = selected ? 0.55 : 0;
      sprite.material.map?.dispose();
      sprite.material.map = createLabelTexture(zone.id, selected);
      sprite.material.needsUpdate = true;
      sprite.scale.set(selected ? 22 : 18, selected ? 5.5 : 4.5, 1);
    });
    const target = zoneObjectsRef.current.get(selectedZoneId);
    if (target) focusRef.current = new THREE.Vector3(target.zone.x, 0, target.zone.z);
  }, [selectedZoneId, zones]);

  // Straight-line guidance from the user's position to the destination.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (routeRef.current) {
      scene.remove(routeRef.current);
      disposeObject(routeRef.current);
      routeRef.current = null;
    }
    if (!route?.from || !route?.to) return;
    const from = locationToScenePoint(route.from.latitude, route.from.longitude);
    const to = locationToScenePoint(route.to.latitude, route.to.longitude);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, 1.2, from.z),
        new THREE.Vector3(to.x, 1.2, to.z),
      ]),
      new THREE.LineDashedMaterial({ color: '#67e8f9', dashSize: 2.5, gapSize: 1.5 }),
    );
    line.computeLineDistances();
    scene.add(line);
    routeRef.current = line;
  }, [route]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !campusModelUrl) return;

    let cancelled = false;
    const modelFormat = getModelFormat(campusModelUrl);

    const showFallback = (message) => {
      if (cancelled) return;
      placeholderRef.current.visible = true;
      onModelStatus?.({
        state: 'placeholder',
        label: 'Placeholder',
        detail: message,
      });
    };

    const removeCurrentModel = () => {
      if (!modelRef.current) return;
      scene.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    };

    const addModel = (object) => {
      if (cancelled) {
        disposeObject(object);
        return;
      }

      removeCurrentModel();
      prepareCampusModel(object);
      scene.add(object);
      modelRef.current = object;
      placeholderRef.current.visible = false;
      onModelStatus?.({
        state: 'loaded',
        label: 'Metashape model',
        detail: campusModelUrl,
      });
    };

    const loadModel = () => {
      onModelStatus?.({
        state: 'loading',
        label: 'Loading model',
        detail: campusModelUrl,
      });

      if (modelFormat === 'gltf') {
        new GLTFLoader().load(
          campusModelUrl,
          (gltf) => addModel(gltf.scene),
          undefined,
          () => showFallback('Could not load GLB/GLTF model. Using placeholder campus.'),
        );
        return;
      }

      if (modelFormat === 'obj') {
        new OBJLoader().load(
          campusModelUrl,
          addModel,
          undefined,
          () => showFallback('Could not load OBJ model. Using placeholder campus.'),
        );
        return;
      }

      showFallback('Unsupported model format. Use GLB, GLTF, or OBJ.');
    };

    if (campusModelUrl.startsWith('blob:')) {
      loadModel();
    } else {
      fetch(campusModelUrl, { method: 'HEAD' })
        .then((response) => {
          const type = response.headers.get('content-type') ?? '';
          // Vite's SPA fallback answers unknown paths with index.html; treat that as missing.
          if (response.ok && !type.includes('text/html')) loadModel();
          else showFallback('Place the Metashape export at public/models/ucer-campus.glb.');
        })
        .catch(() => showFallback('Place the Metashape export at public/models/ucer-campus.glb.'));
    }

    return () => {
      cancelled = true;
    };
  }, [campusModelUrl, onModelStatus]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const activeIds = new Set(Object.keys(locations));

    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        scene.remove(marker);
        disposeObject(marker);
        markersRef.current.delete(id);
      }
    });

    Object.entries(locations).forEach(([id, ping]) => {
      if (ping.latitude == null || ping.longitude == null) return;

      let marker = markersRef.current.get(id);
      if (!marker) {
        marker = createPin(String(currentPosition?.userId) === id ? ACCENT : '#a78bfa');
        scene.add(marker);
        markersRef.current.set(id, marker);
      }

      const point = locationToScenePoint(ping.latitude, ping.longitude);
      marker.position.x = point.x;
      marker.position.z = point.z;
    });
  }, [currentPosition, locations]);

  // Dolly the camera toward / away from the orbit target, within the OrbitControls limits.
  const zoom = (factor) => {
    const view = viewRef.current;
    if (!view) return;
    const { camera, controls } = view;
    const offset = (cameraGoalRef.current ?? camera.position).clone().sub(controls.target);
    const length = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    cameraGoalRef.current = controls.target.clone().add(offset.setLength(length));
  };

  const resetView = () => {
    if (!viewRef.current) return;
    focusRef.current = new THREE.Vector3(0, 0, 0);
    cameraGoalRef.current = START_CAMERA.clone();
  };

  return (
    <div className="campus-scene">
      <div ref={mountRef} className="campus-scene-canvas" role="img" aria-label={label} />
      {showControls && (
        <div className="scene-controls" role="group" aria-label="3D view controls">
          <button type="button" className="icon-button" onClick={() => zoom(0.75)} aria-label="Zoom in" title="Zoom in">
            <Icon name="plus" size={16} />
          </button>
          <button type="button" className="icon-button" onClick={() => zoom(1.33)} aria-label="Zoom out" title="Zoom out">
            <Icon name="minus" size={16} />
          </button>
          <hr />
          <button type="button" className="icon-button" onClick={resetView} aria-label="Reset view" title="Reset view">
            <Icon name="target" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
