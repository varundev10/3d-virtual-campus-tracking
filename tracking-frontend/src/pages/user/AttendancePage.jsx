import { useState } from 'react';
import AlertsPanel from '../../components/AlertsPanel.jsx';
import AttendanceSummaryCard from '../../components/AttendanceSummaryCard.jsx';
import WeekTimetable from '../../components/WeekTimetable.jsx';
import { AsyncBlock, EmptyState } from '../../components/ui/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { Link } from '../../lib/router.jsx';
import { formatClock, formatDateTime, titleCase } from '../../lib/format.js';

const PERIODS = [30, 90, 180];

function TodayCard({ schedule }) {
  const today = schedule.sessions.filter((s) => s.dayOfWeek === schedule.dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const recordFor = (id) => schedule.todayRecords.find((r) => r.sessionId === id);

  return (
    <section className="card" aria-labelledby="today-title">
      <header className="card-header">
        <div>
          <h2 id="today-title">Today</h2>
          <p>{titleCase(schedule.dayOfWeek)} · campus time ({schedule.timezone}). Attendance is recorded automatically when you are in the classroom with location on.</p>
        </div>
      </header>
      {today.length === 0 ? (
        <EmptyState icon="clock" title="No classes today">Enjoy the free day, or explore the campus.</EmptyState>
      ) : (
        <ul className="today-list">
          {today.map((s) => {
            const record = recordFor(s.id);
            const state = nowMinutes < minutes(s.startTime) ? 'Upcoming' : nowMinutes <= minutes(s.endTime) ? 'In progress' : 'Finished';
            return (
              <li key={s.id}>
                <span className="mono">{formatClock(s.startTime)}–{formatClock(s.endTime)}</span>
                <div>
                  <strong>{s.subject}</strong>
                  <small>{s.classroomCode}{s.facultyName ? ` · ${s.facultyName}` : ''}</small>
                </div>
                {record ? (
                  <span className={`badge badge-status-${record.status.toLowerCase()}`} title={record.method === 'AUTO' ? 'Recorded automatically from your location' : 'Marked by faculty'}>
                    {titleCase(record.status)}
                  </span>
                ) : (
                  <span className="badge badge-muted">{state}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function History({ userId }) {
  const records = useAsync(() => api.getAttendance(userId), [userId]);
  return (
    <section className="card" aria-labelledby="history-title">
      <header className="card-header"><h2 id="history-title">Recent attendance</h2></header>
      <AsyncBlock resource={records} loadingLabel="Loading attendance">
        {(data) => {
          const rows = [...data].sort((a, b) => new Date(b.checkTime) - new Date(a.checkTime)).slice(0, 10);
          return rows.length === 0 ? (
            <EmptyState icon="clock" title="No attendance records">Records appear here once attendance is recorded.</EmptyState>
          ) : (
            <ul className="timeline">
              {rows.map((r) => (
                <li key={r.id}>
                  <strong>{r.classroomId}</strong>
                  <span>
                    <span className={`badge badge-status-${r.status.toLowerCase()}`}>{titleCase(r.status)}</span>
                    {' · '}{formatDateTime(r.checkTime)}
                    {r.method === 'AUTO' ? ' · automatic' : ' · marked by staff'}
                    {r.note ? ` · “${r.note}”` : ''}
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </AsyncBlock>
    </section>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [days, setDays] = useState(90);
  const schedule = useAsync(() => api.getMySchedule(), []);
  const summary = useAsync(() => api.getMyAttendanceSummary(days), [days]);

  return (
    <div className="page-stack">
      <header className="page-head">
        <h1 className="page-title">My attendance</h1>
        <div className="segmented-control" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} type="button" className={days === p ? 'active' : ''} aria-pressed={days === p} onClick={() => setDays(p)}>{p} days</button>
          ))}
        </div>
      </header>

      {!user.departmentId && (
        <p className="form-notice" role="status">
          You are not in a department yet, so there is no timetable to track. Ask campus administration to assign your department
          {' '}(it can also be chosen when registering). <Link to="/app/profile">Check your profile</Link>.
        </p>
      )}

      <div className="grid-2">
        <AsyncBlock resource={summary} loadingLabel="Loading attendance summary">
          {(data) => <AttendanceSummaryCard summary={data} days={days} />}
        </AsyncBlock>
        <AsyncBlock resource={schedule} loadingLabel="Loading today's classes">
          {(data) => <TodayCard schedule={data} />}
        </AsyncBlock>
      </div>

      <section className="card" aria-labelledby="week-title">
        <header className="card-header">
          <div>
            <h2 id="week-title">Weekly timetable</h2>
            {user.departmentName && <p>{user.departmentName}</p>}
          </div>
        </header>
        <AsyncBlock resource={schedule} loadingLabel="Loading timetable">
          {(data) => (
            <WeekTimetable
              sessions={data.sessions}
              today={data.dayOfWeek}
              todayRecords={data.todayRecords}
              emptyText={user.departmentId ? 'No classes have been timetabled for your department yet.' : 'Join a department to see its timetable.'}
            />
          )}
        </AsyncBlock>
      </section>

      <div className="grid-2">
        <History userId={user.id} />
        <AlertsPanel title="Alerts about me" subtitle="Raised when a class was skipped or a position looked impossible." pageSize={5} />
      </div>
    </div>
  );
}
