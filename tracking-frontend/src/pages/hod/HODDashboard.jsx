import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Radio, UserPlus, Users } from 'lucide-react';
import AppShell from '../../components/layout/AppShell.jsx';
import Panel from '../../components/Panel.jsx';
import StatCard from '../../components/StatCard.jsx';
import ActivityFeed from '../../components/ActivityFeed.jsx';
import AttendanceHistory from '../../components/AttendanceHistory.jsx';
import CampusScene from '../../components/CampusScene.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import { useCampusData } from '../../hooks/useCampusData.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';

export default function HODDashboard() {
  const { user } = useAuth();
  const { users, classrooms, liveLocations, backendState, socketState, activity, addActivity, refresh } = useCampusData('HOD');
  const [modelStatus, setModelStatus] = useState({ state: 'loading', label: 'Loading model' });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' });
  const [memberError, setMemberError] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  const students = useMemo(() => users.filter((u) => u.role === 'STUDENT'), [users]);
  const teachers = useMemo(() => users.filter((u) => u.role === 'TEACHER'), [users]);

  useEffect(() => {
    if (!selectedUserId && users[0]) setSelectedUserId(String(users[0].id));
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    api.getAttendance(selectedUserId).then(setAttendance).catch(() => setAttendance([]));
  }, [selectedUserId]);

  useEffect(() => {
    api.getAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, [activity]);

  const handleCreateMember = async (event) => {
    event.preventDefault();
    setMemberError('');
    setMemberSubmitting(true);

    try {
      await api.createUser(memberForm);
      addActivity('BACKEND', `${memberForm.role === 'TEACHER' ? 'Teacher' : 'Student'} account created for ${memberForm.name}`);
      setMemberForm({ name: '', email: '', password: '', role: 'STUDENT' });
      refresh();
    } catch (error) {
      setMemberError(error.message);
    } finally {
      setMemberSubmitting(false);
    }
  };

  return (
    <AppShell
      title={`${user.department?.name ?? 'Department'} overview`}
      subtitle="HOD dashboard · full department visibility"
      statusItems={[
        { label: 'API', value: backendState, tone: backendState === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300' },
        { label: 'Feed', value: socketState, tone: socketState === 'connected' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300' },
      ]}
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Students" value={students.length} tone="text-violet-600" />
        <StatCard icon={Users} label="Teachers" value={teachers.length} tone="text-emerald-600" />
        <StatCard icon={Radio} label="Live feed" value={socketState} tone="text-sky-600" />
        <StatCard icon={AlertTriangle} label="Open alerts" value={alerts.length} tone="text-amber-600" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="3D Campus Model"
          subtitle="Every tracked member of your department"
          className="h-[420px] xl:h-[560px]"
          bodyClassName="h-full"
          actions={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{modelStatus.label}</span>}
        >
          <CampusScene
            locations={liveLocations}
            currentPosition={null}
            campusModelUrl={DEFAULT_CAMPUS_MODEL_URL}
            onModelStatus={setModelStatus}
          />
        </Panel>

        <Panel title="Add department member" subtitle="Provision a Student or Teacher login">
          <form className="flex flex-col gap-3 px-4 py-4 sm:px-5" onSubmit={handleCreateMember}>
            <input
              required
              placeholder="Full name"
              value={memberForm.name}
              onChange={(event) => setMemberForm((f) => ({ ...f, name: event.target.value }))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={memberForm.email}
              onChange={(event) => setMemberForm((f) => ({ ...f, email: event.target.value }))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <input
              required
              type="password"
              placeholder="Temporary password"
              value={memberForm.password}
              onChange={(event) => setMemberForm((f) => ({ ...f, password: event.target.value }))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <select
              value={memberForm.role}
              onChange={(event) => setMemberForm((f) => ({ ...f, role: event.target.value }))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
            </select>

            {memberError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{memberError}</p>}

            <button
              type="submit"
              disabled={memberSubmitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              <UserPlus size={15} />
              {memberSubmitting ? 'Adding…' : 'Add member'}
            </button>
          </form>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="OSM Geofence View" subtitle="Department-wide live positions" className="h-80">
          <CampusMap locations={liveLocations} currentPosition={null} />
        </Panel>

        <Panel
          title="Roster & attendance"
          subtitle="Select a member to view their history"
          actions={(
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-violet-500"
            >
              {users.map((member) => (
                <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
              ))}
            </select>
          )}
        >
          <AttendanceHistory records={attendance} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Alerts" subtitle="Bunk detections and anomalies across the department">
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 py-3 sm:px-5">
            {alerts.length === 0 && <p className="text-sm text-slate-400">No alerts raised.</p>}
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate">{alert.message}</p>
                  <p className="text-xs text-amber-600">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Live activity" subtitle="Backend & department events">
          <ActivityFeed activity={activity} />
        </Panel>
      </section>
    </AppShell>
  );
}
