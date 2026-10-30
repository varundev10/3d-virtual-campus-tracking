import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import {
  CAMPUS_ELEVATION,
  CAMPUS_FLOOR_HEIGHT_METERS,
  UCER_CENTER,
  buildingSize,
  locationToPlaceholderPoint,
  locationToScenePoint,
} from '../lib/campus.js';
import { CAMPUS_ZONES } from '../lib/locationCategories.js';
import {
  CAMPUS_MODEL_TRANSFORM,
  CESIUM_ION_ACCESS_TOKEN,
  CESIUM_ION_ASSET_ID,
  getModelFormat,
} from '../lib/modelConfig.js';
import { QUALITY_PRESETS, useQuality } from '../lib/quality.js';
import { createAssets } from '../scene/assets.js';
import { PALETTES, applyEnvironment, applyMarkerPalette } from '../scene/environment.js';
import { createSky } from '../scene/sky.js';
import { createCloudShadows, createParticles } from '../scene/ambient.js';
import { createDetailKit, createStreetLights } from '../scene/details.js';
import { createGreenery, createPlaza } from '../scene/greenery.js';
import {
  LABEL_FONT, createLabelSprite, restyleLabel, updateLabelDistance,
} from '../scene/labels.js';
import {
  INTRO_MAX_DISTANCE, INTRO_SECONDS, NORMAL_FOV, applyIntroPose,
} from '../scene/introCamera.js';
import { createCameraDirector } from '../scene/cameraDirector.js';
import { createOutline, updateEntryVisuals } from '../scene/interaction.js';
import {
  ROUTE_Y, createRouteVisual, routeFramePose, updateRouteVisual,
} from '../scene/route.js';
import { isWebGLAvailable } from '../scene/webgl.js';
import Icon from './ui/Icon.jsx';
import SceneUnavailable from './SceneUnavailable.jsx';

const START_CAMERA = new THREE.Vector3(78, 72, 86);
const ORIGIN = new THREE.Vector3(0, 0, 0);
const LABEL_HEIGHT_ABOVE_ROOF = 9;

// Two camera frames. The streamed Metashape tiles are true size (metres), roughly five times the placeholder
// campus, so they get their own overview pose, zoom limit, and fog / intro scale. Positions are projected to match.
const PLACEHOLDER_FRAME = { start: START_CAMERA, maxDistance: 220, scale: 1 };
const TILES_FRAME = { start: new THREE.Vector3(0, 360, 470), maxDistance: 1800, scale: 5 };

// Camera moves. Seconds are per move; reduced motion makes every move instant.
const FLIGHT = { select: 1.5, overview: 1.5, zoom: 0.45, intro: 1.2, fov: 0.6 };
const SELECT_FOV = 40;
const IDLE_SECONDS = 12;
const IDLE_ROTATE_SPEED = 0.35;
const SHOWCASE_ROTATE_SPEED = 0.8;
const START_AZIMUTH = Math.atan2(START_CAMERA.x, START_CAMERA.z);
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function flyToOverview(director, motion, start) {
  director.flyTo({
    position: start, target: ORIGIN, fov: NORMAL_FOV, duration: motion ? FLIGHT.overview : 0,
  });
}

// Where the camera should end up when `entry` is selected: close enough to read the building, looking at its
// middle, and turned a little from where it is now so the move arcs instead of just dollying in. The turn is
// toward a per-building viewing angle but never more than ~35 degrees, so selecting never spins the view around.
function selectionPose(entry, camera, orbitTarget) {
  const center = new THREE.Vector3(entry.zone.x, entry.height * 0.45, entry.zone.z);
  const current = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbitTarget));
  let hash = 0;
  for (let i = 0; i < entry.zone.id.length; i += 1) hash = (hash * 31 + entry.zone.id.charCodeAt(i)) >>> 0;
  const preferred = START_AZIMUTH + 0.5 * (((hash % 1000) / 1000) - 0.5);
  let turn = wrapAngle(preferred - current.theta);
  if (Math.abs(turn) < 0.25) turn = turn < 0 ? -0.25 : 0.25; // always arc a little
  turn = THREE.MathUtils.clamp(turn, -0.6, 0.6);
  // Far enough that the building reads as a place on the campus (neighbours and roads stay in view), not a close-up.
  const radius = THREE.MathUtils.clamp(Math.max(entry.size.width, entry.size.depth) * 3 + entry.height * 1.4, 60, 92);
  const phi = THREE.MathUtils.clamp(current.phi, 0.8, 1.2);
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, current.theta + turn));
  return { position: center.clone().add(offset), target: center, fov: SELECT_FOV };
}

// Builds one placeholder building (into `buildings`) and its label (into `labels`, which stays
// visible over a loaded Metashape model so locations remain selectable).
function addBuilding(buildings, labels, kit, zone, index, mode) {
  const { height, ...size } = buildingSize(index);

  const group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);

  // Walls are matte (clay-model look); the category colour lives on the pin above the roof.
  const wallColor = new THREE.Color((PALETTES[mode] ?? PALETTES.night).wall);
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(size.width, height, size.depth),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, metalness: 0 }),
  );
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  building.userData.zoneId = zone.id;
  group.add(building);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(size.width + 1.5, 1.4, size.depth + 1.5),
    new THREE.MeshStandardMaterial({ color: (PALETTES[mode] ?? PALETTES.night).roof, roughness: 0.5, metalness: 0.15 }),
  );
  roof.position.y = height + 1;
  roof.castShadow = true;
  roof.userData.zoneId = zone.id;
  group.add(roof);

  // Hover / selection: base colors that the per-frame tint scales, and an edge outline revealed on hover.
  building.material.userData.base = wallColor.clone();
  roof.material.userData.base = roof.material.color.clone();
  const outline = createOutline(size.width, size.depth, height);
  group.add(outline.group);

  const details = kit.addBuilding(group, zone, { ...size, height }, index);
  buildings.add(group);

  const label = createLabelSprite(zone, mode);
  label.position.set(zone.x, height + LABEL_HEIGHT_ABOVE_ROOF, zone.z);
  labels.add(label);

  return {
    building,
    roof,
    label,
    labelY: label.position.y,
    height,
    group,
    size,
    outline,
    // Eased interaction state (see scene/interaction.js). `*Target` values are set by hover / selection.
    hover: 0, select: 0, dim: 0, hoverTarget: 0, dimTarget: 0, atRest: true,
    ...details,
  };
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
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Blueprint grid over the ground plane, squashed to the ground's 170 x 120 footprint.
  const grid = new THREE.GridHelper(170, 34, '#FF2DA8', '#2a2a2a');
  grid.scale.z = 120 / 170;
  grid.position.y = 0.04;
  grid.material.transparent = true;
  grid.material.opacity = 0.7;
  group.add(grid);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#070707', roughness: 0.85, metalness: 0.05 });
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(150, 0.18, 7), roadMaterial);
  mainRoad.position.set(0, 0.12, 0);
  mainRoad.receiveShadow = true;
  group.add(mainRoad);

  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 95), roadMaterial);
  crossRoad.position.set(6, 0.14, 0);
  crossRoad.receiveShadow = true;
  group.add(crossRoad);

  // The roundabout where the two roads cross; the trees are placed around it (see scene/greenery.js).
  const plaza = createPlaza();
  group.add(plaza);

  const buildings = new THREE.Group();
  buildings.name = 'placeholder-buildings';
  group.add(buildings);

  // The campus boundary as a dashed site line.
  const geofenceShape = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-72, 0.45, -50),
      new THREE.Vector3(66, 0.45, -48),
      new THREE.Vector3(74, 0.45, 42),
      new THREE.Vector3(-58, 0.45, 52),
    ]),
    new THREE.LineDashedMaterial({ color: '#D4FF3F', dashSize: 3, gapSize: 2 }),
  );
  geofenceShape.computeLineDistances();
  group.add(geofenceShape);

  return { group, buildings, ground, grid, road: roadMaterial, plaza, geofence: geofenceShape };
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
      child.material = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.85 });
    }
  });
}

// 3D Tiles are positioned in Earth-centred coordinates. This is the transform into the scene's own frame: x east,
// y up, z south, origin at UCER_CENTER on the campus ground (see lib/campus.js).
function geodeticToEcef(latitude, longitude, height) {
  const semiMajorAxis = 6378137;
  const eccentricitySquared = 6.69437999014e-3;
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const primeVerticalRadius = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * sinLat * sinLat);

  return new THREE.Vector3(
    (primeVerticalRadius + height) * cosLat * Math.cos(lon),
    (primeVerticalRadius + height) * cosLat * Math.sin(lon),
    (primeVerticalRadius * (1 - eccentricitySquared) + height) * sinLat,
  );
}

function createEcefToCampusFrame() {
  const latitude = THREE.MathUtils.degToRad(UCER_CENTER.lat);
  const longitude = THREE.MathUtils.degToRad(UCER_CENTER.lng);
  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  const sinLon = Math.sin(longitude);
  const cosLon = Math.cos(longitude);
  const origin = geodeticToEcef(UCER_CENTER.lat, UCER_CENTER.lng, CAMPUS_ELEVATION);
  const east = new THREE.Vector3(-sinLon, cosLon, 0);
  const north = new THREE.Vector3(-sinLat * cosLon, -sinLat * sinLon, cosLat);
  const up = new THREE.Vector3(cosLat * cosLon, cosLat * sinLon, sinLat);
  const south = north.negate();

  return new THREE.Matrix4().set(
    east.x, east.y, east.z, -east.dot(origin),
    up.x, up.y, up.z, -up.dot(origin),
    south.x, south.y, south.z, -south.dot(origin),
    0, 0, 0, 1,
  );
}

// A user's live position: a bobbing pin with a pulsing ring (animated in the render loop). Its colours come from
// the scene palette (see applyMarkerPalette), so it follows day / night like everything else.
function createPin(isCurrent, mode) {
  const color = (PALETTES[mode] ?? PALETTES.night).marker[isCurrent ? 'current' : 'other'];
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 5, 16),
    new THREE.MeshStandardMaterial({ color: '#6e6e6e', metalness: 0.2, roughness: 0.55 }),
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
  group.userData.stem = stem;
  group.userData.isCurrent = isCurrent;
  applyMarkerPalette(group, PALETTES[mode] ?? PALETTES.night);
  return group;
}

// Shared default so an omitted `locations` prop does not look like a change on every render.
const NO_LOCATIONS = {};

export default function CampusScene({
  locations = NO_LOCATIONS,
  currentPosition,
  // Which user's pin takes `floorLevel` (the floor they picked); every other pin uses its own last ping's floor.
  selectedUserId,
  floorLevel = 0,
  campusModelUrl,
  onModelStatus,
  zones = CAMPUS_ZONES,
  selectedZoneId = null,
  onSelectZone,
  route = null,
  label = '3D campus model',
  showControls = true,
  mode = 'night',
  // Cinematic intro driven by the page: 'hold' parks the camera at the start of the sweep, 'play' runs it,
  // 'settle' jumps straight to the normal view, 'skip' eases there, 'off' is the normal explorer.
  intro = 'off',
  onReady,
  onIntroEnd,
  // Increment to fly the camera back to the overview of the whole campus.
  overviewSignal = 0,
  // Increment to fly to the currently selected place again (e.g. it was picked a second time from a list).
  refocusSignal = 0,
  // A decorative, non-interactive view: the campus turns slowly on its own and ignores the pointer.
  showcase = false,
}) {
  const [quality] = useQuality();
  // WebGL missing (or the renderer failed to start): show an explanation instead of crashing the page.
  const [unavailable, setUnavailable] = useState(() => !isWebGLAvailable());
  const [contextLost, setContextLost] = useState(false);
  // True once the streamed tiles are showing: positions and the camera then use the true-size frame.
  const [tilesActive, setTilesActive] = useState(false);
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const sceneRef = useRef(null);
  const placeholderRef = useRef(null);
  const buildingsRef = useRef(null);
  const labelsRef = useRef(null);
  const zoneObjectsRef = useRef(new Map());
  const animatedRef = useRef([]);
  const modelRef = useRef(null);
  const tilesRendererRef = useRef(null);
  const tilesFrameRef = useRef(null);
  const frameRef = useRef(PLACEHOLDER_FRAME);
  const routeRef = useRef(null);
  const framedRouteRef = useRef(null);
  const directorRef = useRef(null);
  const motionRef = useRef(1);
  const selectedRef = useRef(selectedZoneId);
  const flownToRef = useRef(null);
  const viewRef = useRef(null);
  const envRef = useRef(null);
  const modeRef = useRef(mode);
  const showcaseRef = useRef(showcase);
  const qualityRef = useRef(quality);
  const onSelectRef = useRef(onSelectZone);
  const onReadyRef = useRef(onReady);
  const onIntroEndRef = useRef(onIntroEnd);
  const introRef = useRef({ state: intro, startedAt: null });

  // Keep the "latest value" refs current. Declared first so they are set before the effects below run.
  useEffect(() => {
    modeRef.current = mode;
    showcaseRef.current = showcase;
    qualityRef.current = quality;
    onSelectRef.current = onSelectZone;
    selectedRef.current = selectedZoneId;
    onReadyRef.current = onReady;
    onIntroEndRef.current = onIntroEnd;
  });

  // The page changes the intro state; the render loop reads it.
  useEffect(() => {
    introRef.current.state = intro;
    if (intro === 'play') introRef.current.startedAt = null;
  }, [intro]);

  // Without WebGL the model never loads; say so rather than leaving the page's status on "Loading model".
  useEffect(() => {
    if (!unavailable) return;
    onModelStatus?.({
      state: 'placeholder', label: '3D unavailable', detail: 'WebGL is not available in this browser.', reason: 'unsupported',
    });
  }, [unavailable, onModelStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined; // WebGL unavailable: the fallback is rendered instead of the canvas
    const markers = markersRef.current;
    const zoneObjects = zoneObjectsRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0B0B');
    scene.fog = new THREE.Fog('#0B0B0B', 120, 340);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.5, 1000);
    camera.position.copy(START_CAMERA);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      // Detection passed but the context could not be created (driver/GPU trouble). Show the fallback
      // rather than letting the exception unmount the whole app.
      queueMicrotask(() => setUnavailable(true));
      return undefined;
    }
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
    controls.autoRotateSpeed = IDLE_ROTATE_SPEED;
    // All camera moves (fly-to, zoom buttons, reset, intro skip) go through one time-based director.
    const director = createCameraDirector(camera, controls);
    directorRef.current = director;
    // Dragging, scrolling or pinching always wins: it ends any move in progress where it stands.
    controls.addEventListener('start', () => director.cancel());
    viewRef.current = { camera, controls };

    // Cinematic intro. While parked or playing, orbit input is off and the distance limit is lifted so the sweep
    // can start farther out than the user is normally allowed to go. Everything runs in the one render loop below.
    const intro = introRef.current;
    const beginIntroControl = () => {
      controls.enabled = false;
      controls.maxDistance = INTRO_MAX_DISTANCE * frameRef.current.scale;
    };
    const settleCamera = () => {
      camera.position.copy(frameRef.current.start);
      controls.target.set(0, 0, 0);
      camera.fov = NORMAL_FOV;
      camera.updateProjectionMatrix();
      controls.enabled = true;
      controls.maxDistance = frameRef.current.maxDistance;
      intro.state = 'off';
    };
    if (intro.state === 'hold' || intro.state === 'play') {
      beginIntroControl();
      applyIntroPose(camera, controls, frameRef.current.start, 0, frameRef.current.scale);
    }

    // Lights. Colors and intensities are set per day / night mode by applyEnvironment.
    const hemi = new THREE.HemisphereLight('#c4c4c4', '#0B0B0B', 0.95);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#ffffff', 1.3);
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

    const rim = new THREE.DirectionalLight('#FF2DA8', 0.8);
    rim.position.set(-60, 40, -70);
    scene.add(rim);

    // Atmosphere and ambient life.
    const assets = createAssets();
    const sky = createSky();
    scene.add(sky.group);

    // Land that continues past the campus plane and fades into the horizon through the fog.
    const farGround = new THREE.Mesh(
      new THREE.CircleGeometry(420, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#0B0B0B' }),
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
      renderer,
      camera,
      sky,
      farGround,
      ground: placeholder.ground,
      grid: placeholder.grid,
      road: placeholder.road,
      plaza: placeholder.plaza,
      geofence: placeholder.geofence,
      markers,
      hemi,
      sun,
      rim,
      particles,
      clouds,
      kit,
      assets,
      streetLights: null,
      greenery: null,
      zoneObjects,
      warmup: 0,
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

    // Pointer handling. A click (not a drag) on a building, pin or label selects it; a click on empty ground clears
    // the selection. Hover is resolved once per frame in the render loop, so it also follows a moving camera.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerAt = { x: 0, y: 0, inside: false };
    let hoveredId = null;
    let downAt = null;
    const pickAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets = [...labels.children];
      if (placeholder.group.visible) targets.push(...placeholder.buildings.children);
      const hit = raycaster.intersectObjects(targets, true).find((h) => h.object.userData.zoneId);
      return hit?.object.userData.zoneId ?? null;
    };
    const clearHover = () => {
      pointerAt.inside = false;
      hoveredId = null;
      renderer.domElement.style.cursor = '';
    };
    const handleDown = (event) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const handleUp = (event) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      if (!onSelectRef.current) return;
      const zoneId = pickAt(event.clientX, event.clientY);
      if (zoneId) onSelectRef.current(zoneId);
      else if (selectedRef.current) onSelectRef.current(null);
    };
    const handleMove = (event) => {
      if (!onSelectRef.current) return;
      if (event.buttons) {
        clearHover(); // dragging the camera, not hovering
        return;
      }
      pointerAt.x = event.clientX;
      pointerAt.y = event.clientY;
      pointerAt.inside = true;
    };
    renderer.domElement.addEventListener('pointerdown', handleDown);
    renderer.domElement.addEventListener('pointerup', handleUp);
    renderer.domElement.addEventListener('pointermove', handleMove);
    renderer.domElement.addEventListener('pointerleave', clearHover);

    // Idle drift: after a while with no input anywhere on the page the camera starts a very slow orbit. Any input,
    // from any device, stops it at once.
    let lastInput = performance.now();
    const markInput = () => {
      lastInput = performance.now();
    };
    const inputEvents = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'];
    inputEvents.forEach((type) => window.addEventListener(type, markInput, { passive: true }));

    // If the browser reclaims the graphics context, say so; three.js restores the scene on its own when it returns.
    const handleContextLost = (event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Reduced motion: pins and particles stay put, clouds stop drifting.
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let motion = motionQuery?.matches ? 0 : 1;
    motionRef.current = motion;
    const handleMotion = (event) => {
      motion = event.matches ? 0 : 1;
      motionRef.current = motion;
    };
    motionQuery?.addEventListener('change', handleMotion);

    // Label textures drawn before the web font finished loading used a fallback face; redraw them once it is in.
    let disposed = false;
    document.fonts?.load(LABEL_FONT).then(() => {
      if (disposed) return;
      zoneObjects.forEach((entry) => restyleLabel(entry.label, entry.zone, { mode: modeRef.current, selected: entry.selected }));
    }).catch(() => {});

    let frame;
    let readyFired = false;
    const clock = new THREE.Clock();
    // Pins rest on the streamed terrain: a ray straight down at each pin's spot, refreshed about once a second.
    const terrainRaycaster = new THREE.Raycaster();
    let lastTerrainSnap = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;

      // Hover: re-resolved every frame while the pointer is over the scene, so it stays right as the camera moves.
      if (pointerAt.inside && intro.state === 'off' && onSelectRef.current) {
        const next = pickAt(pointerAt.x, pointerAt.y);
        if (next !== hoveredId) {
          hoveredId = next;
          renderer.domElement.style.cursor = next ? 'pointer' : '';
        }
      } else if (hoveredId) {
        hoveredId = null;
        renderer.domElement.style.cursor = '';
      }

      markers.forEach((marker) => {
        const { head, ring } = marker.userData;
        marker.position.y = (marker.userData.baseY ?? 0) + Math.sin(elapsed * 2.4 + marker.position.x) * 0.35 * motion;
        marker.rotation.y += 0.72 * delta * motion;
        const k = motion ? (((elapsed * 0.7 + marker.position.x * 0.05) % 1) + 1) % 1 : 0.3;
        ring.scale.setScalar(0.85 + k * 0.9);
        ring.material.opacity = (1 - k) * 0.75;
        head.material.emissiveIntensity = 0.6 + 0.25 * Math.sin(elapsed * 3 + marker.position.x) * motion;
      });

      // One-frame warm-up draw of the (normally hidden) hover outlines; see the zones effect.
      if (ctx.warmup > 0) {
        const done = ctx.warmup === 1;
        ctx.warmup -= 1;
        animatedRef.current.forEach((entry) => {
          if (!entry.atRest) return;
          entry.outline.material.opacity = done ? 0 : 0.003;
          entry.outline.group.visible = !done;
        });
      }

      kit.animatePins(animatedRef.current, elapsed, motion);
      animatedRef.current.forEach((entry) => {
        entry.hoverTarget = entry.zone.id === hoveredId ? 1 : 0;
        updateEntryVisuals(entry, delta, elapsed, motion);
        updateLabelDistance(entry.label, entry.selected, camera.position.distanceTo(entry.label.position), {
          hover: entry.hover, dim: entry.dim, viewScale: frameRef.current.scale,
        });
      });
      if (routeRef.current) updateRouteVisual(routeRef.current, delta, elapsed, motion, modeRef.current);

      const effectsTime = motion ? elapsed : 0;
      particles.update(effectsTime, pixelRatio);
      sky.update(camera, effectsTime, pixelRatio);
      if (motion) clouds.update(delta);

      if (intro.state === 'hold' || intro.state === 'play') {
        beginIntroControl();
        let progress = 0;
        if (intro.state === 'play') {
          if (intro.startedAt == null) intro.startedAt = elapsed;
          progress = Math.min((elapsed - intro.startedAt) / INTRO_SECONDS, 1);
        }
        applyIntroPose(camera, controls, frameRef.current.start, progress, frameRef.current.scale);
        if (progress >= 1) {
          settleCamera();
          onIntroEndRef.current?.();
        }
      } else if (intro.state === 'settle') {
        settleCamera();
      } else {
        if (intro.state === 'skip') {
          // Ease from wherever the sweep is to the normal view, then hand the controls back.
          intro.state = 'skipping';
          controls.enabled = true;
          director.flyTo({
            position: frameRef.current.start, target: ORIGIN, fov: NORMAL_FOV, duration: motion ? FLIGHT.intro : 0,
          });
        }
        director.update(elapsed);
        if (intro.state === 'skipping' && !director.active) settleCamera();
        const idle = showcaseRef.current || performance.now() - lastInput > IDLE_SECONDS * 1000;
        controls.autoRotateSpeed = showcaseRef.current ? SHOWCASE_ROTATE_SPEED : IDLE_ROTATE_SPEED;
        controls.autoRotate = Boolean(motion) && intro.state === 'off' && !director.active && !document.hidden && idle;
      }
      // The frame time makes the idle drift's speed independent of the display's refresh rate.
      controls.update(delta);
      const tiles = tilesRendererRef.current;
      if (tiles) {
        camera.updateMatrixWorld();
        scene.updateMatrixWorld(true);
        tiles.update();
        if (elapsed - lastTerrainSnap > 0.75) {
          lastTerrainSnap = elapsed;
          terrainRaycaster.ray.direction.set(0, -1, 0);
          terrainRaycaster.far = 5000;
          markers.forEach((marker) => {
            const ground = marker.userData.groundPoint;
            if (!ground) return;
            terrainRaycaster.ray.origin.set(ground.x, 2500, ground.z);
            const hit = terrainRaycaster.intersectObject(tiles.group, true)[0];
            if (hit) {
              marker.userData.groundY = hit.point.y;
              marker.userData.baseY = hit.point.y + marker.userData.floorOffset;
            }
          });
        }
      }
      renderer.render(scene, camera);
      if (!readyFired) {
        readyFired = true;
        onReadyRef.current?.();
      }
    };
    animate();

    const handleResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      tilesRendererRef.current?.setResolutionFromRenderer(camera, renderer);
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
      renderer.domElement.removeEventListener('pointerleave', clearHover);
      inputEvents.forEach((type) => window.removeEventListener(type, markInput));
      directorRef.current = null;
      // Before forceContextLoss below, so releasing our own context is not reported as a loss.
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      viewRef.current = null;
      envRef.current = null;
      if (tilesRendererRef.current) {
        tilesRendererRef.current.dispose();
        tilesRendererRef.current = null;
      }
      if (tilesFrameRef.current) {
        scene.remove(tilesFrameRef.current);
        tilesFrameRef.current = null;
      }
      if (modelRef.current) disposeObject(modelRef.current);
      disposeObject(placeholder.group);
      disposeObject(labels);
      ctx.streetLights?.dispose();
      ctx.greenery?.dispose();
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

  // Switches between the placeholder campus's camera frame and the true-size frame of the streamed tiles: overview
  // pose, zoom limit, clip distance, fog, intro scale, and whether positions are projected true-size.
  const enterFrame = useCallback((next) => {
    frameRef.current = next;
    const tiles = next === TILES_FRAME;
    const view = viewRef.current;
    const ctx = envRef.current;
    if (view) {
      view.camera.far = tiles ? 10000 : 1000;
      view.camera.updateProjectionMatrix();
      // While the intro is parked or playing, the render loop owns the distance limit.
      if (view.controls.enabled) view.controls.maxDistance = next.maxDistance;
    }
    if (ctx) {
      ctx.viewScale = next.scale;
      // The tiles bring their own ground; the placeholder's dark horizon disc would cut through the terrain.
      ctx.farGround.visible = !tiles;
      applyEnvironment(ctx, modeRef.current);
    }
    setTilesActive(tiles);
    // Zones are re-projected for the new frame, so the selection effect flies to the selected place again;
    // with nothing selected, show the whole campus.
    flownToRef.current = null;
    if (directorRef.current && !selectedRef.current && introRef.current.state === 'off') {
      flyToOverview(directorRef.current, motionRef.current, next.start);
    }
  }, []);

  // Where a latitude / longitude lands in the scene: true size around UCER_CENTER once the tiles stream in, else the
  // placeholder campus's compact layout.
  const project = tilesActive ? locationToScenePoint : locationToPlaceholderPoint;
  // Zones built from API locations carry their coordinates, so they follow the active layout. The built-in sample
  // zones have none, belong to the placeholder campus, and stay where they are.
  const displayZones = useMemo(() => {
    if (!tilesActive) return zones;
    return zones.map((zone) => {
      if (zone.latitude == null || zone.longitude == null) return zone;
      const { x, z } = locationToScenePoint(zone.latitude, zone.longitude);
      return { ...zone, x, z };
    });
  }, [zones, tilesActive]);

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
    if (ctx.greenery) {
      placeholderRef.current.remove(ctx.greenery.group);
      ctx.greenery.dispose();
      ctx.greenery = null;
    }

    const footprints = [];
    displayZones.forEach((zone, index) => {
      const objects = addBuilding(buildings, labels, ctx.kit, zone, index, modeRef.current);
      // Built unselected; the highlight effect below restyles the selected zone, if any.
      zoneObjectsRef.current.set(zone.id, { ...objects, zone, selected: false });
      footprints.push({ x: zone.x, z: zone.z, ...objects.size });
    });
    ctx.streetLights = createStreetLights(ctx.assets, footprints);
    placeholderRef.current.add(ctx.streetLights.group);
    ctx.greenery = createGreenery(footprints);
    placeholderRef.current.add(ctx.greenery.group);
    animatedRef.current = [...zoneObjectsRef.current.values()];
    applyEnvironment(ctx, modeRef.current);
    // Warm up the hover outlines so the first hover or selection does not stall on shader work: start building every
    // material's program now, and (see the render loop) draw the hidden outlines once at near-zero opacity, because
    // some drivers only finish building a pipeline on its first draw. compile() rather than compileAsync(): nothing
    // waits on the result, and compileAsync keeps polling the materials from a timer, which throws (uncaught) if
    // they are disposed meanwhile, e.g. by a rebuild of this list or by leaving the page.
    ctx.renderer.compile(ctx.scene, ctx.camera);
    ctx.warmup = 2;
  }, [displayZones]);

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

  // Highlight and focus the selected location. The glow, outline, lift and the dimming of everything else are eased
  // every frame from the flags set here; only the old and new selection get a new label texture.
  useEffect(() => {
    zoneObjectsRef.current.forEach((entry, id) => {
      const selected = id === selectedZoneId;
      if (entry.selected !== selected) {
        entry.selected = selected;
        restyleLabel(entry.label, entry.zone, { mode: modeRef.current, selected });
      }
      entry.dimTarget = selectedZoneId && !selected ? 1 : 0;
    });

    const director = directorRef.current;
    const view = viewRef.current;
    if (!director || !view) return;
    const entry = zoneObjectsRef.current.get(selectedZoneId);
    if (entry) {
      // Fly once per selection; rebuilding the building list must not replay the move.
      if (flownToRef.current === selectedZoneId) return;
      flownToRef.current = selectedZoneId;
      director.flyTo({
        ...selectionPose(entry, view.camera, view.controls.target),
        duration: motionRef.current ? FLIGHT.select : 0,
      });
    } else if (!selectedZoneId && flownToRef.current) {
      // Selection cleared: the camera stays where the user left it; only the field of view settles back.
      flownToRef.current = null;
      director.flyTo({
        position: view.camera.position.clone(),
        target: view.controls.target.clone(),
        fov: NORMAL_FOV,
        duration: motionRef.current ? FLIGHT.fov : 0,
      });
    }
  }, [selectedZoneId, displayZones]);

  // Page-triggered camera moves: "Back to overview", and re-focusing a place that is already selected.
  const overviewSeen = useRef(overviewSignal);
  useEffect(() => {
    if (overviewSeen.current === overviewSignal) return;
    overviewSeen.current = overviewSignal;
    if (!directorRef.current) return;
    flownToRef.current = null;
    flyToOverview(directorRef.current, motionRef.current, frameRef.current.start);
  }, [overviewSignal]);

  const refocusSeen = useRef(refocusSignal);
  useEffect(() => {
    if (refocusSeen.current === refocusSignal) return;
    refocusSeen.current = refocusSignal;
    const entry = zoneObjectsRef.current.get(selectedRef.current);
    const view = viewRef.current;
    if (!entry || !view || !directorRef.current) return;
    flownToRef.current = selectedRef.current;
    directorRef.current.flyTo({
      ...selectionPose(entry, view.camera, view.controls.target),
      duration: motionRef.current ? FLIGHT.select : 0,
    });
  }, [refocusSignal]);

  // Straight-line guidance from the user's position to the destination (see scene/route.js). One visual per
  // destination: it is rebuilt, and its reveal replays, only when the destination changes or the route appears or
  // goes away. Position updates just move its end points (next effect).
  const hasRoute = Boolean(route?.from && route?.to);
  const routeDestination = route?.to?.code ?? null;
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !hasRoute) return undefined;
    const visual = createRouteVisual();
    scene.add(visual.group);
    routeRef.current = visual;
    return () => {
      scene.remove(visual.group);
      disposeObject(visual.group);
      routeRef.current = null;
      framedRouteRef.current = null;
    };
  }, [hasRoute, routeDestination]);

  useEffect(() => {
    const visual = routeRef.current;
    if (!visual || !route?.from || !route?.to) return;
    const from = project(route.from.latitude, route.from.longitude);
    const to = project(route.to.latitude, route.to.longitude);
    visual.from.set(from.x, ROUTE_Y, from.z);
    visual.to.set(to.x, ROUTE_Y, to.z);
    // The ring around the destination clears the building's corners.
    const building = zoneObjectsRef.current.get(route.to.code);
    visual.radius = building ? Math.hypot(building.size.width, building.size.depth) / 2 + 2 : 6;

    // Bring the whole route into view once per destination, so its reveal is seen from the start. Later position
    // updates leave the camera alone, and any drag or scroll by the user ends the move.
    const view = viewRef.current;
    const director = directorRef.current;
    if (!view || !director || framedRouteRef.current === route.to.code) return;
    framedRouteRef.current = route.to.code;
    director.flyTo({
      ...routeFramePose(visual, view.camera, view.controls.target, NORMAL_FOV),
      duration: motionRef.current ? FLIGHT.select : 0,
    });
  }, [route, project]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !campusModelUrl) return;

    let cancelled = false;
    const modelFormat = getModelFormat(campusModelUrl);
    const useCesiumIon = Boolean(CESIUM_ION_ASSET_ID && CESIUM_ION_ACCESS_TOKEN);
    const missingHint = modelFormat === 'tileset'
      ? 'Place the Metashape 3D Tiles export at public/models/ucer-campus-tiles/tileset.json.'
      : 'Place the Metashape export at public/models/ucer-campus.glb.';

    // reason: 'missing' when no model file is installed, 'error' when one exists but could not be used.
    const showFallback = (message, reason = 'error') => {
      if (cancelled) return;
      placeholderRef.current.visible = true;
      onModelStatus?.({
        state: 'placeholder',
        label: 'Placeholder',
        detail: message,
        reason,
      });
    };

    // Real download progress (bytes received / total) while a model file is being fetched.
    const reportProgress = (event) => {
      if (cancelled || !event.lengthComputable || !event.total) return;
      onModelStatus?.({
        state: 'loading',
        label: 'Loading model',
        detail: campusModelUrl,
        progress: Math.min(event.loaded / event.total, 1),
      });
    };

    const removeCurrentModel = () => {
      if (!modelRef.current) return;
      scene.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    };

    // Streamed tiles live in their own East-North-Up frame; dropping them also restores the placeholder's camera frame.
    const removeCurrentTiles = () => {
      if (tilesRendererRef.current) {
        tilesRendererRef.current.dispose();
        tilesRendererRef.current = null;
      }
      if (tilesFrameRef.current) {
        scene.remove(tilesFrameRef.current);
        tilesFrameRef.current = null;
        enterFrame(PLACEHOLDER_FRAME);
      }
    };

    const addModel = (object) => {
      if (cancelled) {
        disposeObject(object);
        return;
      }

      removeCurrentModel();
      removeCurrentTiles();
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
        removeCurrentTiles();
        new GLTFLoader().load(
          campusModelUrl,
          (gltf) => addModel(gltf.scene),
          reportProgress,
          () => showFallback('Could not load GLB/GLTF model. Using placeholder campus.'),
        );
        return;
      }

      if (modelFormat === 'obj') {
        removeCurrentTiles();
        new OBJLoader().load(
          campusModelUrl,
          addModel,
          reportProgress,
          () => showFallback('Could not load OBJ model. Using placeholder campus.'),
        );
        return;
      }

      if (modelFormat === 'tileset') {
        const camera = viewRef.current?.camera;
        const renderer = envRef.current?.renderer;
        if (!camera || !renderer) {
          showFallback('3D viewer is not ready. Reload the page to retry.');
          return;
        }

        removeCurrentModel();
        removeCurrentTiles();
        const tiles = new TilesRenderer(useCesiumIon ? null : campusModelUrl);
        if (useCesiumIon) {
          tiles.registerPlugin(new CesiumIonAuthPlugin({
            apiToken: CESIUM_ION_ACCESS_TOKEN,
            assetId: CESIUM_ION_ASSET_ID,
            autoRefreshToken: true,
          }));
        }
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader }));
        const frame = new THREE.Group();
        frame.name = 'campus-east-north-up-frame';
        frame.matrixAutoUpdate = false;
        frame.matrix.copy(createEcefToCampusFrame());
        frame.add(tiles.group);
        scene.add(frame);
        frame.updateMatrixWorld(true);

        tiles.setCamera(camera);
        tiles.setResolutionFromRenderer(camera, renderer);
        tiles.errorTarget = 4;
        tilesRendererRef.current = tiles;
        tilesFrameRef.current = frame;

        // The placeholder stays until the first tile is in, so the scene is never empty.
        let entered = false;
        const handleFirstTile = () => {
          if (cancelled || entered) return;
          entered = true;
          placeholderRef.current.visible = false;
          enterFrame(TILES_FRAME);
          onModelStatus?.({
            state: 'loaded',
            label: 'Streaming campus',
            detail: '3D Tiles · visible detail streams as you navigate',
          });
        };
        // A failed tile is skipped; a failed tileset (no `tile` on the event) falls back to the placeholder.
        const handleLoadError = (event) => {
          if (event.tile || cancelled) return;
          removeCurrentTiles();
          showFallback(`Could not load campus tiles: ${event.error?.message ?? 'check the tileset files'}`);
        };

        tiles.addEventListener('load-model', handleFirstTile);
        tiles.addEventListener('load-error', handleLoadError);
        return;
      }

      showFallback('Unsupported model format. Use a 3D Tiles tileset, GLB, GLTF, or OBJ.');
    };

    if (campusModelUrl.startsWith('blob:') || useCesiumIon) {
      loadModel();
    } else {
      fetch(campusModelUrl, { method: 'HEAD' })
        .then((response) => {
          const type = response.headers.get('content-type') ?? '';
          // Vite's SPA fallback answers unknown paths with index.html; treat that as missing.
          if (response.ok && !type.includes('text/html')) loadModel();
          else showFallback(missingHint, 'missing');
        })
        .catch(() => showFallback(missingHint, 'missing'));
    }

    return () => {
      cancelled = true;
      removeCurrentTiles();
    };
  }, [campusModelUrl, enterFrame, onModelStatus]);

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
        marker = createPin(String(currentPosition?.userId) === id, modeRef.current);
        scene.add(marker);
        markersRef.current.set(id, marker);
      }

      const point = project(ping.latitude, ping.longitude);
      // Your own pin follows the floor picked on the page; everyone else's comes from their last ping.
      const isSelectedUser = String(selectedUserId) === id || String(currentPosition?.userId) === id;
      const markerFloorLevel = isSelectedUser ? floorLevel : (ping.floorLevel ?? 0);
      // Pins rest on the terrain height the render loop finds (tiles only), raised by the floor they are on.
      if (!tilesActive) marker.userData.groundY = 0;
      marker.userData.groundPoint = { x: point.x, z: point.z };
      marker.userData.floorOffset = Math.max(0, Number(markerFloorLevel) || 0) * CAMPUS_FLOOR_HEIGHT_METERS;
      marker.userData.baseY = (marker.userData.groundY ?? 0) + marker.userData.floorOffset;
      marker.position.x = point.x;
      marker.position.z = point.z;
    });
  }, [currentPosition, floorLevel, locations, project, selectedUserId, tilesActive]);

  // Dolly the camera toward / away from the orbit target, within the OrbitControls limits.
  const zoom = (factor) => {
    const view = viewRef.current;
    if (!view) return;
    const director = directorRef.current;
    if (!director) return;
    const { camera, controls } = view;
    const offset = camera.position.clone().sub(controls.target);
    const length = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    director.flyTo({
      position: controls.target.clone().add(offset.setLength(length)),
      target: controls.target.clone(),
      fov: camera.fov,
      duration: motionRef.current ? FLIGHT.zoom : 0,
    });
  };

  const resetView = () => {
    if (!directorRef.current) return;
    flownToRef.current = null;
    flyToOverview(directorRef.current, motionRef.current, frameRef.current.start);
  };

  if (unavailable) {
    return (
      <div className="campus-scene">
        <SceneUnavailable reason="unsupported" />
      </div>
    );
  }

  return (
    <div className={`campus-scene ${showcase ? 'is-showcase' : ''}`}>
      <div ref={mountRef} className="campus-scene-canvas" role="img" aria-label={label} />
      {contextLost && <SceneUnavailable reason="lost" />}
      {showControls && !contextLost && (
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
