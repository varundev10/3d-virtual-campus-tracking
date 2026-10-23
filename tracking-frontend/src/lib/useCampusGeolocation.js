import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { isLikelyInsideCampus } from './campus.js';

const MIN_POST_INTERVAL_MS = 5000;

function initialStatus() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return 'idle';
}

/**
 * Wraps the browser Geolocation API. Location is only requested after start() is called
 * (an explicit user action). Positions are sent to the backend only while `share` is true,
 * the device is online, and the position is inside the campus geofence.
 */
export function useCampusGeolocation({ share, floorLevel = 0 }) {
  const [status, setStatus] = useState(initialStatus);
  const [position, setPosition] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [sync, setSync] = useState({ state: 'idle', message: null, at: null });
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const watchId = useRef(null);
  const lastPostAt = useRef(0);
  const shareRef = useRef(share);
  shareRef.current = share;
  const floorRef = useRef(floorLevel);
  useEffect(() => {
    floorRef.current = floorLevel;
  }, [floorLevel]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const clearWatch = () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const sendPosition = useCallback(async (coords) => {
    if (!shareRef.current) return;
    if (!coords.insideCampus) {
      setSync({ state: 'paused', message: 'Not shared: you are outside the campus boundary.', at: null });
      return;
    }
    if (navigator.onLine === false) {
      setSync({ state: 'offline', message: 'Not shared: you are offline.', at: null });
      return;
    }
    const now = Date.now();
    if (now - lastPostAt.current < MIN_POST_INTERVAL_MS) return;
    lastPostAt.current = now;
    try {
      await api.postLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        floorLevel: floorRef.current,
        source: 'GPS',
      });
      setSync({ state: 'saved', message: null, at: new Date() });
    } catch (error) {
      setSync({ state: 'error', message: error.message, at: null });
    }
  }, []);

  const start = useCallback(() => {
    const base = initialStatus();
    if (base !== 'idle') {
      setStatus(base);
      return;
    }
    clearWatch();
    setErrorMessage(null);
    setStatus('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      (result) => {
        const coords = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          timestamp: result.timestamp,
        };
        coords.insideCampus = isLikelyInsideCampus(coords.latitude, coords.longitude);
        setPosition(coords);
        setErrorMessage(null);
        setStatus(coords.insideCampus ? 'tracking' : 'outside');
        sendPosition(coords);
      },
      (error) => {
        setErrorMessage(error.message || null);
        if (error.code === error.PERMISSION_DENIED) {
          clearWatch();
          setPosition(null);
          setStatus('denied');
        } else if (error.code === error.TIMEOUT) {
          setStatus('timeout');
        } else {
          setStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, [sendPosition]);

  const stop = useCallback(() => {
    clearWatch();
    setPosition(null);
    setStatus(initialStatus());
    setSync({ state: 'idle', message: null, at: null });
  }, []);

  // When sharing is switched on, send the position we already have instead of waiting for
  // the next fix (a stationary device may not report again for a long time).
  const positionRef = useRef(null);
  positionRef.current = position;
  useEffect(() => {
    if (!share) {
      setSync({ state: 'idle', message: null, at: null });
      return;
    }
    lastPostAt.current = 0;
    if (positionRef.current) sendPosition(positionRef.current);
  }, [share, sendPosition]);

  useEffect(() => () => clearWatch(), []);

  // A watch is running in every state except these.
  const active = !['idle', 'unsupported', 'insecure', 'denied'].includes(status);

  return { status, position, errorMessage, sync, online, active, start, stop };
}
