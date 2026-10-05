import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import {
  CAMPUS_ELEVATION,
  CAMPUS_FLOOR_HEIGHT_METERS,
  CAMPUS_ZONES,
  UCER_CENTER,
  locationToScenePoint,
} from '../lib/campus.js';
import { CAMPUS_MODEL_TRANSFORM, getModelFormat } from '../lib/modelConfig.js';

function createLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(16, 24, 32, 0.82)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f7fbff';
  context.font = '600 24px Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  return new THREE.CanvasTexture(canvas);
}

function addBuilding(parent, zone, height, size) {
  const group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);

  const geometry = new THREE.BoxGeometry(size.width, height, size.depth);
  const material = new THREE.MeshStandardMaterial({
    color: zone.color,
    roughness: 0.58,
    metalness: 0.08,
  });
  const building = new THREE.Mesh(geometry, material);
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(size.width + 1.5, 1.4, size.depth + 1.5),
    new THREE.MeshStandardMaterial({ color: '#f4f1e7', roughness: 0.5 }),
  );
  roof.position.y = height + 1;
  roof.castShadow = true;
  group.add(roof);

  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createLabelTexture(zone.id),
      transparent: true,
    }),
  );
  label.scale.set(18, 4.5, 1);
  label.position.set(0, height + 6, 0);
  group.add(label);

  parent.add(group);
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
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

function createPlaceholderCampus() {
  const group = new THREE.Group();
  group.name = 'placeholder-campus';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 120),
    new THREE.MeshStandardMaterial({ color: '#bfd3c1', roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#53636b', roughness: 0.86 });
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(150, 0.18, 7), roadMaterial);
  mainRoad.position.set(0, 0.12, 0);
  group.add(mainRoad);

  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 95), roadMaterial);
  crossRoad.position.set(6, 0.14, 0);
  group.add(crossRoad);

  CAMPUS_ZONES.forEach((zone, index) => {
    addBuilding(group, zone, 9 + (index % 3) * 3, {
      width: 16 + (index % 2) * 4,
      depth: 13 + (index % 3) * 3,
    });
  });

  const geofenceShape = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-72, 0.45, -50),
      new THREE.Vector3(66, 0.45, -48),
      new THREE.Vector3(74, 0.45, 42),
      new THREE.Vector3(-58, 0.45, 52),
    ]),
    new THREE.LineBasicMaterial({ color: '#e94f37', linewidth: 2 }),
  );
  group.add(geofenceShape);

  return group;
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
      child.material = new THREE.MeshStandardMaterial({ color: '#b7c8ba', roughness: 0.82 });
    }
  });
}

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

function createPin(color = '#e94f37') {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 5, 16),
    new THREE.MeshStandardMaterial({ color: '#1c2a36' }),
  );
  stem.position.y = 2.5;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 24, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22 }),
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
  selectedUserId,
  floorLevel,
  campusModelUrl,
  onModelStatus,
}) {
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const sceneRef = useRef(null);
  const placeholderRef = useRef(null);
  const modelRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const tilesRendererRef = useRef(null);
  const tilesFrameRef = useRef(null);
  const terrainRaycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe8ed');
    scene.fog = new THREE.Fog('#dfe8ed', 700, 1600);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 10000);
    camera.position.set(0, 360, 470);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.minDistance = 35;
    controls.maxDistance = 1800;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();
    controlsRef.current = controls;

    const ambient = new THREE.HemisphereLight('#ffffff', '#8ea4ad', 2.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight('#fff3d0', 3);
    sun.position.set(40, 90, 35);
    sun.castShadow = true;
    scene.add(sun);

    const placeholder = createPlaceholderCampus();
    placeholderRef.current = placeholder;
    scene.add(placeholder);

    let frame;
    const clock = new THREE.Clock();
    let lastTerrainSnap = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      markersRef.current.forEach((marker) => {
        marker.rotation.y = elapsed * 0.7;
      });
      controls.update();
      camera.updateMatrixWorld();
      scene.updateMatrixWorld(true);
      tilesRendererRef.current?.update();
      if (tilesRendererRef.current && elapsed - lastTerrainSnap > 0.75) {
        lastTerrainSnap = elapsed;
        const raycaster = terrainRaycasterRef.current;
        raycaster.ray.direction.set(0, -1, 0);
        raycaster.far = 5000;
        markersRef.current.forEach((marker) => {
          const groundPoint = marker.userData.groundPoint;
          if (!groundPoint) return;
          raycaster.ray.origin.set(groundPoint.x, 2500, groundPoint.z);
          const hits = raycaster.intersectObject(tilesRendererRef.current.group, true);
          if (hits.length) {
            marker.position.y = hits[0].point.y + marker.userData.floorOffset;
            marker.userData.groundResolved = true;
          }
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (tilesRendererRef.current) {
        tilesRendererRef.current.setResolutionFromRenderer(camera, renderer);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      controlsRef.current = null;
      if (tilesRendererRef.current) {
        tilesRendererRef.current.dispose();
        tilesRendererRef.current = null;
      }
      if (tilesFrameRef.current) {
        scene.remove(tilesFrameRef.current);
        tilesFrameRef.current = null;
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      rendererRef.current = null;
      cameraRef.current = null;
      if (modelRef.current) disposeObject(modelRef.current);
      if (placeholderRef.current) disposeObject(placeholderRef.current);
      markersRef.current.clear();
    };
  }, []);

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

    const removeCurrentTiles = () => {
      if (tilesRendererRef.current) {
        tilesRendererRef.current.dispose();
        tilesRendererRef.current = null;
      }
      if (tilesFrameRef.current) {
        scene.remove(tilesFrameRef.current);
        tilesFrameRef.current = null;
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
          undefined,
          () => showFallback('Could not load GLB/GLTF model. Using placeholder campus.'),
        );
        return;
      }

      if (modelFormat === 'obj') {
        removeCurrentTiles();
        new OBJLoader().load(
          campusModelUrl,
          addModel,
          undefined,
          () => showFallback('Could not load OBJ model. Using placeholder campus.'),
        );
        return;
      }

      if (modelFormat === 'tileset') {
        const camera = cameraRef.current;
        const renderer = rendererRef.current;
        if (!camera || !renderer) {
          showFallback('3D viewer is not ready. Reload the page to retry.');
          return;
        }

        removeCurrentModel();
        removeCurrentTiles();
        const tiles = new TilesRenderer(campusModelUrl);
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

        const handleFirstTile = () => {
          if (cancelled) return;
          placeholderRef.current.visible = false;
          onModelStatus?.({
            state: 'loaded',
            label: 'Streaming campus',
            detail: '3D Tiles · visible detail streams as you navigate',
          });
        };
        const handleLoadError = (event) => {
          if (!event.tile) showFallback(`Could not load campus tiles: ${event.error?.message ?? 'check the tileset files'}`);
        };

        tiles.addEventListener('load-model', handleFirstTile);
        tiles.addEventListener('load-error', handleLoadError);
        return;
      }

      showFallback('Unsupported model format. Use a 3D Tiles tileset, GLB, GLTF, or OBJ.');
    };

    if (campusModelUrl.startsWith('blob:')) {
      loadModel();
    } else {
      fetch(campusModelUrl, { method: 'HEAD' })
        .then((response) => {
          if (response.ok) loadModel();
          else showFallback('Place the Metashape export at public/models/ucer-campus.glb.');
        })
        .catch(() => showFallback('Place the Metashape export at public/models/ucer-campus.glb.'));
    }

    return () => {
      cancelled = true;
      removeCurrentTiles();
    };
  }, [campusModelUrl, onModelStatus]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const activeIds = new Set(Object.keys(locations));

    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        scene.remove(marker);
        markersRef.current.delete(id);
      }
    });

    Object.entries(locations).forEach(([id, ping]) => {
      if (ping.latitude == null || ping.longitude == null) return;

      let marker = markersRef.current.get(id);
      if (!marker) {
        marker = createPin(String(currentPosition?.userId) === id ? '#e94f37' : '#2b8cbe');
        scene.add(marker);
        markersRef.current.set(id, marker);
      }

      const point = locationToScenePoint(ping.latitude, ping.longitude);
      const isSelectedUser = String(selectedUserId) === id
        || String(currentPosition?.userId) === id;
      const markerFloorLevel = isSelectedUser ? floorLevel : (ping.floorLevel ?? 0);
      marker.userData.groundPoint = { x: point.x, z: point.z };
      marker.userData.floorOffset = Math.max(0, Number(markerFloorLevel) || 0) * CAMPUS_FLOOR_HEIGHT_METERS;
      if (!marker.userData.groundResolved) {
        marker.position.set(point.x, point.y + marker.userData.floorOffset, point.z);
      } else {
        marker.position.x = point.x;
        marker.position.z = point.z;
      }
    });
  }, [currentPosition, floorLevel, locations, selectedUserId]);

  return <div ref={mountRef} className="campus-scene" aria-label="3D campus model" />;
}
