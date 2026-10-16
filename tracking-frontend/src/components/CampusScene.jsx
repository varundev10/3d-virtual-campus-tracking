import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAMPUS_ZONES, locationToScenePoint } from '../lib/campus.js';
import { CAMPUS_MODEL_TRANSFORM, getModelFormat } from '../lib/modelConfig.js';
import { QUALITY_PRESETS, useQuality } from '../lib/quality.js';
import { createAssets } from '../scene/assets.js';
import { applyEnvironment } from '../scene/environment.js';
import { createSky } from '../scene/sky.js';
import { createCloudShadows, createParticles } from '../scene/ambient.js';
import { createDetailKit, createStreetLights } from '../scene/details.js';
import { createLabelSprite, restyleLabel, updateLabelDistance } from '../scene/labels.js';
import Icon from './ui/Icon.jsx';

const ACCENT = '#22d3ee';
const START_CAMERA = new THREE.Vector3(78, 72, 86);
const LABEL_HEIGHT_ABOVE_ROOF = 9;

// Builds one placeholder building (into `buildings`) and its label (into `labels`, which stays
// visible over a loaded Metashape model so locations remain selectable).
function addBuilding(buildings, labels, kit, zone, index, mode) {
  const height = 9 + (index % 3) * 3;
  const size = { width: 16 + (index % 2) * 4, depth: 13 + (index % 3) * 3 };

  const group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);

  // Category colors are tuned for the UI; soften them slightly so large painted walls are not harsh.
  const wallColor = new THREE.Color(zone.color).offsetHSL(0, -0.12, 0.02);
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(size.width, height, size.depth),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.55, metalness: 0.06 }),
  );
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  building.userData.zoneId = zone.id;
  group.add(building);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(size.width + 1.5, 1.4, size.depth + 1.5),
    new THREE.MeshStandardMaterial({ color: '#1e2c44', roughness: 0.35, metalness: 0.3 }),
  );
  roof.position.y = height + 1;
  roof.castShadow = true;
  roof.userData.zoneId = zone.id;
  group.add(roof);

  const details = kit.addBuilding(group, zone, { ...size, height }, index);
  buildings.add(group);

  const label = createLabelSprite(zone, mode);
  label.position.set(zone.x, height + LABEL_HEIGHT_ABOVE_ROOF, zone.z);
  labels.add(label);

  return { building, roof, label, height, group, size, ...details };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh && !child.isSprite && !child.isLine && !child.isPoints) return;
    if (child.geometry && !child.geometry.userData.shared) child.geometry.dispose();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      // Textures, geometry and materials flagged `shared` belong to the scene and are freed at unmount.
      if (!material || material.userData.shared) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture && !value.userData.shared) value.dispose();
      });
      material.dispose();
    });
    // InstancedMesh releases its per-instance buffers here.
    child.dispose?.();
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
  mainRoad.receiveShadow = true;
  group.add(mainRoad);

  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 95), roadMaterial);
  crossRoad.position.set(6, 0.14, 0);
  crossRoad.receiveShadow = true;
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

// A user's live position: a bobbing pin with a pulsing ring (animated in the render loop).
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
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;

  group.add(stem, head, ring);
  group.userData.head = head;
  group.userData.ring = ring;
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
  const [quality] = useQuality();
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const sceneRef = useRef(null);
  const placeholderRef = useRef(null);
  const buildingsRef = useRef(null);
  const labelsRef = useRef(null);
  const zoneObjectsRef = useRef(new Map());
  const animatedRef = useRef([]);
  const modelRef = useRef(null);
  const routeRef = useRef(null);
  const focusRef = useRef(null);
  const cameraGoalRef = useRef(null);
  const viewRef = useRef(null);
  const envRef = useRef(null);
  const modeRef = useRef(mode);
  const qualityRef = useRef(quality);
  const onSelectRef = useRef(onSelectZone);

  // Keep the "latest value" refs current. Declared first so they are set before the effects below run.
  useEffect(() => {
    modeRef.current = mode;
    qualityRef.current = quality;
    onSelectRef.current = onSelectZone;
  });

  useEffect(() => {
    const mount = mountRef.current;
    const markers = markersRef.current;
    const zoneObjects = zoneObjectsRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d1a');
    scene.fog = new THREE.Fog('#070d1a', 120, 340);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.5, 1000);
    camera.position.copy(START_CAMERA);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Neutral tone mapping rolls highlights off without shifting hues, which keeps a textured Metashape
    // model true to its colors.
    renderer.toneMapping = THREE.NeutralToneMapping;
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

    // Lights. Colors and intensities are set per day / night mode by applyEnvironment.
    const hemi = new THREE.HemisphereLight('#d6e8ff', '#0a1424', 1.25);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#e6f0ff', 1.7);
    sun.position.set(40, 90, 35);
    sun.castShadow = true;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.5;
    scene.add(sun);

    const rim = new THREE.DirectionalLight('#67e8f9', 0.9);
    rim.position.set(-60, 40, -70);
    scene.add(rim);

    // Atmosphere and ambient life.
    const assets = createAssets();
    const sky = createSky();
    scene.add(sky.group);

    // Land that continues past the campus plane and fades into the horizon through the fog.
    const farGround = new THREE.Mesh(
      new THREE.CircleGeometry(420, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#07101d' }),
    );
    farGround.position.y = -0.2;
    farGround.renderOrder = 5; // after the campus plane, so the GPU skips the pixels it already covers
    farGround.raycast = () => {};
    scene.add(farGround);

    const particles = createParticles();
    scene.add(particles.points);
    const clouds = createCloudShadows(assets);
    scene.add(clouds.group);
    const kit = createDetailKit(assets);

    const placeholder = createPlaceholderCampus();
    placeholderRef.current = placeholder.group;
    buildingsRef.current = placeholder.buildings;
    scene.add(placeholder.group);

    const labels = new THREE.Group();
    labels.name = 'location-labels';
    labelsRef.current = labels;
    scene.add(labels);

    const ctx = {
      scene,
      sky,
      farGround,
      ground: placeholder.ground,
      grid: placeholder.grid,
      road: placeholder.road,
      hemi,
      sun,
      rim,
      particles,
      clouds,
      kit,
      assets,
      streetLights: null,
      zoneObjects,
      applyQuality: null,
    };
    envRef.current = ctx;

    // Quality presets switch optional effects on and off in place; nothing is rebuilt.
    let pixelRatio = 1;
    let envTexture = null;
    ctx.applyQuality = (preset) => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      sun.castShadow = preset.shadows;
      if (sun.shadow.mapSize.x !== preset.shadowMapSize) {
        sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      particles.setCount(preset.particles);
      sky.setStarCount(preset.stars);
      clouds.setEnabled(preset.cloudShadows);
      if (preset.environmentMap) {
        if (!envTexture) {
          const generator = new THREE.PMREMGenerator(renderer);
          const room = new RoomEnvironment();
          envTexture = generator.fromScene(room, 0.04).texture;
          room.dispose?.();
          generator.dispose();
        }
        scene.environment = envTexture;
      } else {
        scene.environment = null;
      }
    };
    applyEnvironment(ctx, modeRef.current);
    ctx.applyQuality(QUALITY_PRESETS[qualityRef.current]);

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

    // Reduced motion: pins and particles stay put, clouds stop drifting.
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let motion = motionQuery?.matches ? 0 : 1;
    const handleMotion = (event) => {
      motion = event.matches ? 0 : 1;
    };
    motionQuery?.addEventListener('change', handleMotion);

    // Label textures drawn before the web font finished loading used a fallback face; redraw them once it is in.
    let disposed = false;
    document.fonts?.load('600 46px "Space Grotesk"').then(() => {
      if (disposed) return;
      zoneObjects.forEach((entry) => restyleLabel(entry.label, entry.zone, { mode: modeRef.current, selected: entry.selected }));
    }).catch(() => {});

    let frame;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;

      markers.forEach((marker) => {
        const { head, ring } = marker.userData;
        marker.position.y = Math.sin(elapsed * 2.4 + marker.position.x) * 0.35 * motion;
        marker.rotation.y += 0.72 * delta * motion;
        const k = motion ? (((elapsed * 0.7 + marker.position.x * 0.05) % 1) + 1) % 1 : 0.3;
        ring.scale.setScalar(0.85 + k * 0.9);
        ring.material.opacity = (1 - k) * 0.75;
        head.material.emissiveIntensity = 0.6 + 0.25 * Math.sin(elapsed * 3 + marker.position.x) * motion;
      });

      kit.animatePins(animatedRef.current, elapsed, motion);
      animatedRef.current.forEach((entry) => {
        updateLabelDistance(entry.label, entry.selected, camera.position.distanceTo(entry.label.position));
      });

      const effectsTime = motion ? elapsed : 0;
      particles.update(effectsTime, pixelRatio);
      sky.update(camera, effectsTime, pixelRatio);
      if (motion) clouds.update(delta);

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
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      motionQuery?.removeEventListener('change', handleMotion);
      renderer.domElement.removeEventListener('pointerdown', handleDown);
      renderer.domElement.removeEventListener('pointerup', handleUp);
      renderer.domElement.removeEventListener('pointermove', handleMove);
      controls.dispose();
      viewRef.current = null;
      envRef.current = null;
      if (modelRef.current) disposeObject(modelRef.current);
      disposeObject(placeholder.group);
      disposeObject(labels);
      ctx.streetLights?.dispose();
      sky.dispose();
      particles.dispose();
      clouds.dispose();
      kit.dispose();
      assets.dispose();
      farGround.geometry.dispose();
      farGround.material.dispose();
      envTexture?.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      // Release the GPU context right away; navigating between pages would otherwise pile up live contexts.
      renderer.forceContextLoss();
      mount.removeChild(renderer.domElement);
      markers.clear();
      zoneObjects.clear();
      animatedRef.current = [];
    };
  }, []);

  // Rebuild buildings, labels and street lights whenever the location list changes.
  useEffect(() => {
    const ctx = envRef.current;
    const buildings = buildingsRef.current;
    const labels = labelsRef.current;
    if (!ctx || !buildings || !labels) return;

    clearGroup(buildings);
    clearGroup(labels);
    zoneObjectsRef.current.clear();
    if (ctx.streetLights) {
      placeholderRef.current.remove(ctx.streetLights.group);
      ctx.streetLights.dispose();
      ctx.streetLights = null;
    }

    const footprints = [];
    zones.forEach((zone, index) => {
      const objects = addBuilding(buildings, labels, ctx.kit, zone, index, modeRef.current);
      // Built unselected; the highlight effect below restyles the selected zone, if any.
      zoneObjectsRef.current.set(zone.id, { ...objects, zone, selected: false });
      footprints.push({ x: zone.x, z: zone.z, ...objects.size });
    });
    ctx.streetLights = createStreetLights(ctx.assets, footprints);
    placeholderRef.current.add(ctx.streetLights.group);
    animatedRef.current = [...zoneObjectsRef.current.values()];
    applyEnvironment(ctx, modeRef.current);
  }, [zones]);

  // Day / night: restyle in place. Camera, controls and selection are untouched.
  useEffect(() => {
    const ctx = envRef.current;
    if (!ctx) return;
    applyEnvironment(ctx, mode);
    zoneObjectsRef.current.forEach((entry) => {
      restyleLabel(entry.label, entry.zone, { mode, selected: entry.selected });
    });
  }, [mode]);

  useEffect(() => {
    envRef.current?.applyQuality(QUALITY_PRESETS[quality]);
  }, [quality]);

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
      restyleLabel(sprite, zone, { mode: modeRef.current, selected });
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
