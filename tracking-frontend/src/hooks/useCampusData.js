import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { connectLiveLocations } from '../lib/liveLocations.js';
import { useAuth } from '../context/AuthContext.jsx';

const initialLog = (label) => [
  {
    id: 'boot',
    type: 'SYSTEM',
    message: `${label} dashboard ready`,
    time: new Date().toLocaleTimeString(),
  },
];

// Shared data layer for the three role dashboards: loads the (already role-scoped) user
// roster and classroom list from the backend, and subscribes to the live GPS feed. The
// backend still broadcasts every ping on one topic (see plan's noted limitation), so this
// hook filters incoming pings down to the ids the REST API actually returned for this role.
export function useCampusData(label) {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [liveLocations, setLiveLocations] = useState({});
  const [backendState, setBackendState] = useState('checking');
  const [socketState, setSocketState] = useState('connecting');
  const [activity, setActivity] = useState(() => initialLog(label));
  const visibleIdsRef = useRef(new Set());

  const addActivity = useCallback((type, message) => {
    setActivity((items) => [
      { id: `${Date.now()}-${Math.random()}`, type, message, time: new Date().toLocaleTimeString() },
      ...items,
    ].slice(0, 20));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [userList, classroomList] = await Promise.all([api.getUsers(), api.getClassrooms()]);
      setUsers(userList);
      setClassrooms(classroomList);
      visibleIdsRef.current = new Set(userList.map((u) => String(u.id)));
      setBackendState('online');
    } catch (error) {
      setBackendState('offline');
      addActivity('BACKEND', `Backend unavailable: ${error.message}`);
    }
  }, [addActivity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const disconnect = connectLiveLocations(
      (ping) => {
        if (!ping.userId || ping.latitude == null || ping.longitude == null) return;
        if (!visibleIdsRef.current.has(String(ping.userId))) return;

        setLiveLocations((items) => ({ ...items, [ping.userId]: ping }));
        addActivity('LIVE', `Position update received for user ${ping.userId}`);
      },
      setSocketState,
      token,
    );

    return disconnect;
  }, [addActivity, token]);

  const visibleLocations = useMemo(() => {
    const ids = new Set(users.map((u) => String(u.id)));
    return Object.fromEntries(Object.entries(liveLocations).filter(([id]) => ids.has(String(id))));
  }, [liveLocations, users]);

  return {
    users,
    classrooms,
    liveLocations: visibleLocations,
    backendState,
    socketState,
    activity,
    addActivity,
    refresh,
    setLiveLocations,
  };
}
