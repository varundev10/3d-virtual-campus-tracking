import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, MapPin, Radio, Satellite } from 'lucide-react';
import AppShell from '../../components/layout/AppShell.jsx';
import Panel from '../../components/Panel.jsx';
import StatCard from '../../components/StatCard.jsx';
import ActivityFeed from '../../components/ActivityFeed.jsx';
import AttendanceHistory from '../../components/AttendanceHistory.jsx';
import CampusScene from '../../components/CampusScene.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCampusData } from '../../hooks/useCampusData.js';
import { api } from '../../lib/api.js';
import { isLikelyInsideCampus } from '../../lib/campus.js';
import { DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';

const TRACKING_LABELS = {
  idle: 'Idle',
  requesting: 'Requesting',
  tracking: 'Tracking',
  outside: 'Outside geofence',
  blocked: 'Blocked',
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const { classrooms, liveLocations, backendState, socketState, activity, addActivity } = useCampusData('Student');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [trackingState, setTrackingState] = useState('idle');
  const [attendance, setAttendance] = useState([]);
  const [modelStatus, setModelStatus] = useState({ state: 'loading', label: 'Loading model' });
  const watchId = useRef(null);

  const loadAttendance = useCallback(() => {
    api.getAttendance(user.id).then(setAttendance).catch(() => setAttendance([]));
  }, [user.id]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const stopTracking = useCallback((reason = 'Tracking stopped') => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTrackingState('idle');
    addActivity('GPS', reason);
  }, [addActivity]);

  useEffect(() => () => stopTracking('Tracking watcher released'), [stopTracking]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setTrackingState('blocked');
      addActivity('GPS', 'Browser geolocation is not available');
      return;
    }

    setTrackingState('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const ping = {
          userId: user.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'GPS',
        };

        const insideCampus = isLikelyInsideCampus(ping.latitude, ping.longitude);
        setCurrentPosition({ ...ping, insideCampus });
        setTrackingState(insideCampus ? 'tracking' : 'outside');

        if (!insideCampus) {
          addActivity('GEOFENCE', 'Current GPS estimate is outside the UCER campus boundary');
        }

        try {
          await api.postLocation(ping);
        } catch (error) {
          addActivity('BACKEND', `Location not saved: ${error.message}`);
        }
      },
      (error) => {
        setTrackingState('blocked');
        addActivity('GPS', error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const markAttendance = async (status, classroomCode) => {
    try {
      const record = await api.markAttendance(status, user.id, classroomCode);
      setAttendance((items) => [record, ...items]);
      addActivity('ATTENDANCE', `Marked ${status} in ${classroomCode}`);
    } catch (error) {
      addActivity('ATTENDANCE', `Attendance failed: ${error.message}`);
    }
  };

  return (
    <AppShell
      title={`Hi, ${user.name.split(' ')[0]}`}
      subtitle="Student dashboard · own live position & attendance"
      statusItems={[
        { label: 'API', value: backendState, tone: backendState === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300' },
        { label: 'Feed', value: socketState, tone: socketState === 'connected' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300' },
      ]}
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Satellite} label="GPS" value={TRACKING_LABELS[trackingState] ?? trackingState} tone="text-sky-600" />
        <StatCard icon={Radio} label="Live feed" value={socketState} tone="text-violet-600" />
        <StatCard icon={Activity} label="Backend" value={backendState} tone="text-emerald-600" />
        <StatCard icon={MapPin} label="Attendance rows" value={attendance.length} tone="text-amber-600" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="3D Campus Model"
          subtitle="Geo-aligned view with your live position"
          className="h-[420px] xl:h-[560px]"
          bodyClassName="h-full"
          actions={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{modelStatus.label}</span>}
        >
          <CampusScene
            locations={liveLocations}
            currentPosition={currentPosition}
            campusModelUrl={DEFAULT_CAMPUS_MODEL_URL}
            onModelStatus={setModelStatus}
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="GPS Session" subtitle="Start tracking to report your live position">
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startTracking}
                  className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Start tracking
                </button>
                <button
                  type="button"
                  onClick={() => stopTracking()}
                  className="flex-1 rounded-lg bg-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Stop
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Tracking automatically stops the moment your device leaves the UCER campus boundary.
              </p>
            </div>
          </Panel>

          <Panel title="Mark attendance" subtitle="Self-report presence in a classroom">
            <div className="grid grid-cols-2 gap-2 px-4 py-4 sm:px-5">
              {classrooms.map((classroom) => (
                <button
                  key={classroom.id}
                  type="button"
                  onClick={() => markAttendance('PRESENT', classroom.code)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  {classroom.code}
                </button>
              ))}
            </div>
            {classrooms[0] && (
              <div className="px-4 pb-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => markAttendance('BUNKED', classrooms[0].code)}
                  className="w-full rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                >
                  Report bunk in {classrooms[0].code}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="OSM Geofence View" subtitle="Campus boundary and your recent position" className="h-80">
          <CampusMap locations={liveLocations} currentPosition={currentPosition} />
        </Panel>

        <Panel title="Attendance history" subtitle="Most recent records">
          <AttendanceHistory records={attendance} />
        </Panel>
      </section>

      <Panel title="Live activity" subtitle="GPS state, backend events">
        <ActivityFeed activity={activity} />
      </Panel>
    </AppShell>
  );
}
