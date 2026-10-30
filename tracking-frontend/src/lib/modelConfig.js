export const DEFAULT_CAMPUS_MODEL_URL =
  import.meta.env.VITE_CAMPUS_MODEL_URL ?? '/models/ucer-campus-tiles/tileset.json';

export const CESIUM_ION_ASSET_ID = import.meta.env.VITE_CESIUM_ION_ASSET_ID ?? '';
export const CESIUM_ION_ACCESS_TOKEN = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN ?? '';

export const CAMPUS_MODEL_TRANSFORM = {
  scale: Number(import.meta.env.VITE_CAMPUS_MODEL_SCALE ?? 1),
  position: {
    x: Number(import.meta.env.VITE_CAMPUS_MODEL_X ?? 0),
    y: Number(import.meta.env.VITE_CAMPUS_MODEL_Y ?? 0),
    z: Number(import.meta.env.VITE_CAMPUS_MODEL_Z ?? 0),
  },
  rotation: {
    x: Number(import.meta.env.VITE_CAMPUS_MODEL_ROTATION_X ?? 0),
    y: Number(import.meta.env.VITE_CAMPUS_MODEL_ROTATION_Y ?? 0),
    z: Number(import.meta.env.VITE_CAMPUS_MODEL_ROTATION_Z ?? 0),
  },
};

export function getModelFormat(url) {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('tileset.json')) return 'tileset';
  if (cleanUrl.endsWith('.glb') || cleanUrl.endsWith('.gltf')) return 'gltf';
  if (cleanUrl.endsWith('.obj')) return 'obj';
  return 'unknown';
}
