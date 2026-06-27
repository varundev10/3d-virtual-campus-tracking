import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { CAMPUS_ZONES, locationToScenePoint } from '../lib/campus.js';
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
  campusModelUrl,
  onModelStatus,
}) {
  const mountRef = useRef(null);
  const markersRef = useRef(new Map());
  const sceneRef = useRef(null);
  const placeholderRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe8ed');
    scene.fog = new THREE.Fog('#dfe8ed', 90, 190);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(78, 72, 86);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

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
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      markersRef.current.forEach((marker) => {
        marker.position.y = Math.sin(elapsed * 2.4 + marker.position.x) * 0.35;
        marker.rotation.y += 0.012;
      });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
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
          if (response.ok) loadModel();
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
      marker.position.x = point.x;
      marker.position.z = point.z;
    });
  }, [currentPosition, locations]);

  return <div ref={mountRef} className="campus-scene" aria-label="3D campus model" />;
}
