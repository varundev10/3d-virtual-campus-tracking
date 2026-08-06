import { useEffect, useMemo, useState } from 'react';
import { Activity, DoorOpen, Radio, Users } from 'lucide-react';
import AppShell from '../../components/layout/AppShell.jsx';
import Panel from '../../components/Panel.jsx';
import StatCard from '../../components/StatCard.jsx';
import ActivityFeed from '../../components/ActivityFeed.jsx';
import AttendanceHistory from '../../components/AttendanceHistory.jsx';
import CampusScene from '../../components/CampusScene.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import { useCampusData } from '../../hooks/useCampusData.js';
import { api } from '../../lib/api.js';
import { DEFAULT_CAMPUS_MODEL_URL } from '../../lib/modelConfig.js';

export default function TeacherDashboard() {
  const { users, classrooms, liveLocations, backendState, socketState, activity, addActivity } = useCampusData('Teacher');
  const [modelStatus, setModelStatus] = useState({ state: 'loading', label: 'Loading model' });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassroomCode, setSelectedClassroomCode] = useState('');
  const [attendance, setAttendance] = useState([]);

  const students = useMemo(() => users.filter((u) => u.role === 'STUDENT'), [users]);

  useEffect(() => {
    if (!selectedStudentId && students[0]) setSelectedStudentId(String(students[0].id));
  }, [students, selectedStudentId]);

  useEffect(() => {
    if (!selectedClassroomCode && classrooms[0]) setSelectedClassroomCode(classrooms[0].code);
  }, [classrooms, selectedClassroomCode]);

  useEffect(() => {
    if (!selectedStudentId) return;
    api.getAttendance(selectedStudentId).then(setAttendance).catch(() => setAttendance([]));
  }, [selectedStudentId]);

  const markAttendance = async (status) => {
    if (!selectedStudentId || !selectedClassroomCode) return;

    try {
      const record = await api.markAttendance(status, selectedStudentId, selectedClassroomCode);
      setAttendance((items) => [record, ...items]);
      const student = students.find((s) => String(s.id) === String(selectedStudentId));
      addActivity('ATTENDANCE', `${student?.name ?? 'Student'} marked ${status} in ${selectedClassroomCode}`);
    } catch (error) {
      addActivity('ATTENDANCE', `Attendance failed: ${error.message}`);
    }
  };

  return (
    <AppShell
      title="Teacher console"
      subtitle="Live view of your assigned classrooms"
      statusItems={[
        { label: 'API', value: backendState, tone: backendState === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300' },
        { label: 'Feed', value: socketState, tone: socketState === 'connected' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300' },
      ]}
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Department roster" value={users.length} tone="text-emerald-600" />
        <StatCard icon={DoorOpen} label="Your classrooms" value={classrooms.length} tone="text-sky-600" />
        <StatCard icon={Radio} label="Live feed" value={socketState} tone="text-violet-600" />
        <StatCard icon={Activity} label="Backend" value={backendState} tone="text-amber-600" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="3D Campus Model"
          subtitle="Live positions of your department"
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

        <Panel title="Mark attendance" subtitle="For a classroom you're assigned to">
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Classroom
              <select
                value={selectedClassroomCode}
                onChange={(event) => setSelectedClassroomCode(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                {classrooms.length === 0 && <option value="">No classrooms assigned</option>}
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.code}>{classroom.code} · {classroom.building}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Student
              <select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                {students.length === 0 && <option value="">No students in department</option>}
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.name}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => markAttendance('PRESENT')}
                disabled={!selectedStudentId || !selectedClassroomCode}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark present
              </button>
              <button
                type="button"
                onClick={() => markAttendance('BUNKED')}
                disabled={!selectedStudentId || !selectedClassroomCode}
                className="flex-1 rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Report bunk
              </button>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <Panel title="OSM Geofence View" subtitle="Live positions on campus" className="h-80 lg:col-span-1">
          <CampusMap locations={liveLocations} currentPosition={null} />
        </Panel>

        <Panel title="Selected student" subtitle="Recent attendance">
          <AttendanceHistory records={attendance} />
        </Panel>

        <Panel title="Live activity" subtitle="Attendance & feed events">
          <ActivityFeed activity={activity} />
        </Panel>
      </section>
    </AppShell>
  );
}
