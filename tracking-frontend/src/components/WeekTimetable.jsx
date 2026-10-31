import { EmptyState } from './ui/States.jsx';
import { WEEKDAYS, formatClock, titleCase } from '../lib/format.js';

// The weekly timetable grouped by day. `todayRecords` (optional) marks today's classes with their attendance status.
export default function WeekTimetable({ sessions, today, todayRecords = [], showDepartment = false, emptyText }) {
  if (sessions.length === 0) {
    return (
      <EmptyState icon="clock" title="No classes timetabled">
        {emptyText ?? 'Classes appear here once the timetable is set up.'}
      </EmptyState>
    );
  }

  const statusFor = (sessionId) => todayRecords.find((r) => r.sessionId === sessionId)?.status;
  const days = WEEKDAYS.filter((day) => sessions.some((s) => s.dayOfWeek === day));

  return (
    <div className="week-grid">
      {days.map((day) => (
        <section key={day} className={`week-day ${day === today ? 'is-today' : ''}`} aria-label={titleCase(day)}>
          <h3>{titleCase(day)}{day === today && <span className="badge badge-good">Today</span>}</h3>
          <ul>
            {sessions.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => {
              const status = day === today ? statusFor(s.id) : undefined;
              return (
                <li key={s.id}>
                  <span className="week-time mono">{formatClock(s.startTime)}–{formatClock(s.endTime)}</span>
                  <strong>{s.subject}</strong>
                  <small>
                    {s.classroomCode}
                    {showDepartment ? ` · ${s.departmentName}` : s.facultyName ? ` · ${s.facultyName}` : ''}
                  </small>
                  {status && <span className={`badge badge-status-${status.toLowerCase()}`}>{titleCase(status)}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
