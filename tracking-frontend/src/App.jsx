import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CampusScene from './components/CampusScene.jsx';
import CampusMap from './components/CampusMap.jsx';
import MetricStrip from './components/MetricStrip.jsx';
import OperationsPanel from './components/OperationsPanel.jsx';
import ActivityFeed from './components/ActivityFeed.jsx';
import { api } from './lib/api.js';
import { connectLiveLocations } from './lib/liveLocations.js';
import { isLikelyInsideCampus } from './lib/campus.js';
import { DEFAULT_CAMPUS_MODEL_URL } from './lib/modelConfig.js';

const DEMO_USERS = [
  { name: 'Aarav Singh', email: 'aarav.singh@ucer.edu', role: 'STUDENT' },
  { name: 'Nisha Verma', email: 'nisha.verma@ucer.edu', role: 'FACULTY' },
  { name: 'Campus Admin', email: 'admin@ucer.edu', role: 'ADMIN' },
];

const initialLog = [
  {
    id: 'boot',
    type: 'SYSTEM',
    message: 'Campus operations console ready',
    time: new Date().toLocaleTimeString(),
  },
];

export default function App() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleView, setRoleView] = useState('ADMIN');
  const [liveLocations, setLiveLocations] = useState({});
  const [currentPosition, setCurrentPosition] = useState(null);
  const [trackingState, setTrackingState] = useState('idle');
  const [floorLevel, setFloorLevel] = useState(0);
  const [socketState, setSocketState] = useState('connecting');
  const [backendState, setBackendState] = useState('checking');
  const [campusModelUrl, setCampusModelUrl] = useState(DEFAULT_CAMPUS_MODEL_URL);
  const [modelStatus, setModelStatus] = useState({
    state: 'loading',
    label: 'Loading model',
    detail: DEFAULT_CAMPUS_MODEL_URL,
  });
  const [attendance, setAttendance] = useState([]);
  const [activity, setActivity] = useState(initialLog);
  const watchId = useRef(null);
  const uploadedModelUrl = useRef(null);

  const addActivity = useCallback((type, message) => {
    setActivity((items) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        time: new Date().toLocaleTimeString(),
      },
      ...items,
    ].slice(0, 18));
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) ?? null,
    [selectedUserId, users],
  );

  const visibleLocations = useMemo(() => {
    if (roleView === 'ADMIN') return liveLocations;
    if (!selectedUser) return {};

    return Object.fromEntries(
      Object.entries(liveLocations).filter(([, ping]) => {
        if (roleView === 'STUDENT') return String(ping.userId) === String(selectedUser.id);
        if (roleView === 'FACULTY') return ping.source === 'GPS' || String(ping.userId) === String(selectedUser.id);
        return true;
      }),
    );
  }, [liveLocations, roleView, selectedUser]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
      setSelectedUserId((current) => current || data[0]?.id || '');
      setBackendState('online');
      addActivity('BACKEND', `Loaded ${data.length} backend users`);
    } catch (error) {
      setBackendState('offline');
      addActivity('BACKEND', `Backend unavailable: ${error.message}`);
    }
  }, [addActivity]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const disconnect = connectLiveLocations(
      (ping) => {
        if (!ping.userId || ping.latitude == null || ping.longitude == null) return;
        if (!isLikelyInsideCampus(ping.latitude, ping.longitude)) return;
        setLiveLocations((items) => ({
          ...items,
          [ping.userId]: ping,
        }));
        addActivity('LIVE', `User ${ping.userId} position update received`);
      },
      setSocketState,
    );

    return disconnect;
  }, [addActivity]);

  useEffect(() => {
    if (!selectedUser) return;

    api.getRecentLocations(selectedUser.id)
      .then((pings) => {
        const latestInsideCampus = pings.find((ping) =>
          isLikelyInsideCampus(ping.latitude, ping.longitude));
        if (latestInsideCampus) {
          setLiveLocations((items) => ({
            ...items,
            [selectedUser.id]: latestInsideCampus,
          }));
        }
      })
      .catch(() => {});

    api.getAttendance(selectedUser.id)
      .then(setAttendance)
      .catch(() => setAttendance([]));
  }, [selectedUser]);

  const seedDemoUsers = async () => {
    try {
      const created = [];
      for (const user of DEMO_USERS) {
        created.push(await api.createUser(user));
      }
      setUsers(created);
      setSelectedUserId(created[0]?.id || '');
      setBackendState('online');
      addActivity('BACKEND', 'Demo users created in backend');
    } catch (error) {
      addActivity('BACKEND', `Could not create demo users: ${error.message}`);
    }
  };

  const stopTracking = useCallback((reason = 'Tracking stopped') => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTrackingState('idle');
    addActivity('GPS', reason);
  }, [addActivity]);

  const startTracking = () => {
    if (!selectedUser) {
      addActivity('GPS', 'Select or create a backend user first');
      return;
    }

    if (!navigator.geolocation) {
      setTrackingState('blocked');
      addActivity('GPS', 'Browser geolocation is not available');
      return;
    }

    setTrackingState('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const ping = {
          userId: selectedUser.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          floorLevel,
          source: 'GPS',
        };

        const insideCampus = isLikelyInsideCampus(ping.latitude, ping.longitude);
        if (!insideCampus) {
          if (watchId.current != null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
          }
          setCurrentPosition(null);
          setLiveLocations((items) => {
            const next = { ...items };
            delete next[selectedUser.id];
            return next;
          });
          setTrackingState('outside');
          addActivity('GPS', 'Outside campus boundary; tracking stopped without sending this location');
          return;
        }

        setCurrentPosition({ ...ping, insideCampus: true });
        setLiveLocations((items) => ({ ...items, [selectedUser.id]: ping }));
        setTrackingState('tracking');

        try {
          await api.postLocation(ping);
          setBackendState('online');
        } catch (error) {
          setBackendState('offline');
          addActivity('BACKEND', `Location not saved: ${error.message}`);
        }
      },
      (error) => {
        setTrackingState('blocked');
        addActivity('GPS', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  };

  const markAttendance = async (status, classroomId) => {
    if (!selectedUser) return;

    try {
      const record = await api.markAttendance(status, selectedUser.id, classroomId);
      setAttendance((items) => [record, ...items]);
      addActivity('ATTENDANCE', `${selectedUser.name} marked ${status} in ${classroomId}`);
    } catch (error) {
      addActivity('ATTENDANCE', `Attendance failed: ${error.message}`);
    }
  };

  const handleCampusModelFile = (file) => {
    if (!file) return;

    if (uploadedModelUrl.current) {
      URL.revokeObjectURL(uploadedModelUrl.current);
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedModelUrl.current = objectUrl;
    setCampusModelUrl(objectUrl);
    addActivity('MODEL', `Previewing ${file.name}`);
  };

  useEffect(() => () => stopTracking('Tracking watcher released'), [stopTracking]);

  useEffect(() => () => {
    if (uploadedModelUrl.current) {
      URL.revokeObjectURL(uploadedModelUrl.current);
    }
  }, []);

  return (
    <main className="app-shell">
      <aside className="left-rail">
        <div className="brand-lockup">
          <span className="brand-mark">UC</span>
          <div>
            <h1>UCER Smart Campus</h1>
            <p>Live GPS operations</p>
          </div>
        </div>

        <OperationsPanel
          users={users}
          selectedUserId={selectedUserId}
          floorLevel={floorLevel}
          roleView={roleView}
          trackingState={trackingState}
          backendState={backendState}
          socketState={socketState}
          onSelectUser={setSelectedUserId}
          onFloorLevel={setFloorLevel}
          onRoleView={setRoleView}
          onStartTracking={startTracking}
          onStopTracking={() => stopTracking()}
          onSeedDemoUsers={seedDemoUsers}
          onMarkAttendance={markAttendance}
          modelStatus={modelStatus}
          onCampusModelFile={handleCampusModelFile}
        />
      </aside>

      <section className="workspace">
        <MetricStrip
          visibleCount={Object.keys(visibleLocations).length}
          socketState={socketState}
          backendState={backendState}
          trackingState={trackingState}
          attendanceCount={attendance.length}
        />

        <section className="main-grid">
          <div className="scene-panel">
            <div className="panel-heading">
              <div>
                <h2>3D Campus Model</h2>
                <p>Geo-aligned operational view with live pins</p>
              </div>
              <div className="chip-stack">
                <span className="status-chip">{roleView}</span>
                <span className={`status-chip ${modelStatus.state}`}>{modelStatus.label}</span>
              </div>
            </div>
            <CampusScene
              locations={visibleLocations}
              currentPosition={currentPosition}
              selectedUserId={selectedUserId}
              floorLevel={floorLevel}
              campusModelUrl={campusModelUrl}
              onModelStatus={setModelStatus}
            />
          </div>

          <div className="map-panel">
            <div className="panel-heading">
              <div>
                <h2>OSM Geofence View</h2>
                <p>Campus boundary and recent location stream</p>
              </div>
              <span className={`status-chip ${socketState}`}>{socketState}</span>
            </div>
            <CampusMap locations={visibleLocations} currentPosition={currentPosition} />
          </div>

          <ActivityFeed activity={activity} attendance={attendance} />
        </section>
      </section>
    </main>
  );
}
