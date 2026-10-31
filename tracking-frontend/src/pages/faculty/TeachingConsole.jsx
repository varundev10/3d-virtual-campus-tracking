import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import WeekTimetable from '../../components/WeekTimetable.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { SelectField, TextField } from '../../components/ui/Field.jsx';
import { AsyncBlock, EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { formatClock, formatDateTime, formatNumber, isoDate, titleCase, WEEKDAYS } from '../../lib/format.js';

const STATUSES = ['PRESENT', 'ABSENT', 'BUNKED'];
const LIVE_REFRESH_MS = 20_000;
const STATE_TONE = { LIVE: 'badge-good', UPCOMING: 'badge-muted', ENDED: 'badge-muted' };

// The last few dates a weekly session actually met, newest first (today counts if it is that weekday).
function recentDates(dayOfWeek, count = 6) {
  const target = WEEKDAYS.indexOf(dayOfWeek);
  const dates = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < 7 * count && dates.length < count; i += 1) {
    if ((cursor.getDay() + 6) % 7 === target) dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

// Mounted only while a student is being marked, so its form starts from that student's current mark.
function MarkModal({ target, sessionId, date, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(target.status ?? 'PRESENT');
  const [note, setNote] = useState(target.note ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmBunk, setConfirmBunk] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.markSessionAttendance(sessionId, { userId: target.userId, date, status, note: note.trim() || undefined });
      toast.success(`${target.name} marked ${status.toLowerCase()}`);
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
      setConfirmBunk(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (status === 'BUNKED' && target.status !== 'BUNKED') setConfirmBunk(true);
    else save();
  };

  return (
    <>
      <Modal
        open
        title={`Mark ${target.name}`}
        onClose={onClose}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="mark-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        )}
      >
        <form id="mark-form" className="form-stack" onSubmit={submit} noValidate>
          {target.method === 'AUTO' && (
            <p className="muted small">Recorded automatically from their location. Saving replaces it with your mark.</p>
          )}
          <SelectField id="mk-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </SelectField>
          <TextField id="mk-note" label="Note (optional)" value={note} maxLength={255}
            hint="For example: phone had no signal, or on a college errand." onChange={(e) => setNote(e.target.value)} />
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmBunk}
        title="Mark as bunked?"
        message={`This records ${target.name} as BUNKED and raises a bunk alert for the department.`}
        confirmLabel="Mark bunked"
        onConfirm={save}
        onCancel={() => setConfirmBunk(false)}
      />
    </>
  );
}

function RosterPanel({ session, onChanged }) {
  const dates = useMemo(() => recentDates(session.dayOfWeek), [session.dayOfWeek]);
  const [date, setDate] = useState(dates[0]);
  const [marking, setMarking] = useState(null);
  const [query, setQuery] = useState('');
  const roster = useAsync(() => api.getRoster(session.id, date), [session.id, date]);
  const reload = roster.reload;

  const live = roster.data?.live;
  useEffect(() => {
    if (!live) return undefined;
    const id = window.setInterval(reload, LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [live, reload]);

  const saved = () => {
    setMarking(null);
    reload();
    onChanged();
  };

  const entries = (roster.data?.entries ?? []).filter((e) => !query.trim()
    || e.name.toLowerCase().includes(query.trim().toLowerCase()) || e.email.toLowerCase().includes(query.trim().toLowerCase()));
  const count = (status) => (roster.data?.entries ?? []).filter((e) => e.status === status).length;
  const pending = (roster.data?.entries ?? []).filter((e) => !e.status).length;

  return (
    <section className="card" aria-labelledby="roster-title">
      <header className="card-header">
        <div>
          <h2 id="roster-title">{session.subject}</h2>
          <p>{session.classroomCode} · {titleCase(session.dayOfWeek)} {formatClock(session.startTime)}–{formatClock(session.endTime)} · {session.departmentName}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={roster.loading}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      </header>

      <div className="toolbar">
        <SelectField id="roster-date" label="Class date" value={date} onChange={(e) => setDate(e.target.value)}>
          {dates.map((d) => <option key={d} value={d}>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
        </SelectField>
        <div className="search-input">
          <Icon name="search" />
          <input type="search" placeholder="Filter students" aria-label="Filter students" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {roster.data && (
          <p className="roster-counts" aria-live="polite">
            <span className="badge badge-good">{count('PRESENT')} present</span>
            <span className="badge badge-muted">{count('ABSENT')} absent</span>
            <span className="badge badge-status-bunked">{count('BUNKED')} bunked</span>
            {pending > 0 && <span className="badge badge-warning">{pending} pending</span>}
            {live && <span className="status-chip online">Live</span>}
          </p>
        )}
      </div>

      {roster.loading && !roster.data && <Spinner label="Loading roster" />}
      {roster.error && <ErrorState title="Could not load the roster" message={roster.error.message} onRetry={reload} />}
      {roster.data && roster.data.entries.length === 0 && (
        <EmptyState icon="users" title="No students on this roster">Students appear here once they are added to {session.departmentName}.</EmptyState>
      )}
      {roster.data && roster.data.entries.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Status</th>
                <th scope="col">Source</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.userId}>
                  <td>
                    <strong>{e.name}</strong>
                    {e.inRoomNow && <span className="in-room" title="Their latest position is inside the classroom"> in room</span>}
                    <br /><small className="muted">{e.email}</small>
                  </td>
                  <td>
                    {e.status
                      ? <span className={`badge badge-status-${e.status.toLowerCase()}`}>{titleCase(e.status)}</span>
                      : <span className="badge badge-warning">{roster.data.finalized ? 'Unmarked' : 'Pending'}</span>}
                  </td>
                  <td className="small">
                    {e.status ? (
                      <>
                        {e.method === 'AUTO' ? 'Automatic' : 'Marked by staff'}
                        <br /><span className="muted">{formatDateTime(e.checkTime)}</span>
                        {e.note && <><br /><span className="muted">“{e.note}”</span></>}
                      </>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMarking(e)}>
                      {e.status ? 'Change' : 'Mark'}<span className="sr-only"> {e.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {marking && <MarkModal key={marking.userId} target={marking} sessionId={session.id} date={date} onClose={() => setMarking(null)} onSaved={saved} />}
    </section>
  );
}

export default function TeachingConsole() {
  const { user } = useAuth();
  const overview = useAsync(() => api.getFacultyOverview(), []);
  const sessions = useAsync(() => api.getFacultySessions(), []);
  const [selectedId, setSelectedId] = useState(null);

  const today = overview.data?.sessions ?? [];
  const all = sessions.data ?? [];
  const selected = all.find((s) => s.id === selectedId) ?? (today[0] ? all.find((s) => s.id === today[0].session.id) : all[0]) ?? null;
  const refreshOverview = overview.reload;

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1 className="page-title">Teaching</h1>
          <p className="muted">{overview.data?.departmentName ?? user.departmentName ?? 'No department assigned'}
            {overview.data?.headOfDepartment && <span className="badge badge-good">Head of department</span>}
          </p>
        </div>
      </header>

      <AsyncBlock resource={overview} loadingLabel="Loading your day">
        {(o) => (
          <>
            <div className="stat-grid">
              <StatCard tone="brand" icon="clock" label="Classes today" value={formatNumber(o.sessions.length)}
                hint={o.sessions.filter((s) => s.state === 'LIVE').length ? `${o.sessions.filter((s) => s.state === 'LIVE').length} in progress` : titleCase(o.dayOfWeek)} />
              <StatCard icon="users" label="Students" value={formatNumber(o.students)} hint="In your department" />
              <StatCard icon="alert" label="Open alerts" value={formatNumber(o.openAlerts)} hint="Bunks and off-schedule classes" />
            </div>

            <section className="card" aria-labelledby="today-sessions-title">
              <header className="card-header"><h2 id="today-sessions-title">Today&apos;s classes</h2></header>
              {o.sessions.length === 0 ? (
                <EmptyState icon="clock" title="You have no classes today">Your timetable is below.</EmptyState>
              ) : (
                <ul className="session-cards">
                  {o.sessions.map((s) => (
                    <li key={s.session.id} className={selected?.id === s.session.id ? 'is-selected' : ''}>
                      <div>
                        <span className={`badge ${STATE_TONE[s.state]}`}>{titleCase(s.state)}</span>
                        <strong>{s.session.subject}</strong>
                        <small>{s.session.classroomCode} · {formatClock(s.session.startTime)}–{formatClock(s.session.endTime)}</small>
                      </div>
                      <p className="session-tally">
                        <span>{s.present}/{s.expected} present</span>
                        {s.bunked > 0 && <span className="is-bad">{s.bunked} bunked</span>}
                        {s.pending > 0 && <span className="muted">{s.pending} pending</span>}
                      </p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedId(s.session.id)}>Open roster</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </AsyncBlock>

      {selected && <RosterPanel key={selected.id} session={selected} onChanged={refreshOverview} />}

      <section className="card" aria-labelledby="my-timetable-title">
        <header className="card-header"><h2 id="my-timetable-title">{overview.data?.headOfDepartment ? 'Department timetable' : 'My timetable'}</h2></header>
        <AsyncBlock resource={sessions} loadingLabel="Loading timetable">
          {(data) => (
            <>
              <WeekTimetable sessions={data.filter((s) => s.active)} today={overview.data?.dayOfWeek} showDepartment />
              {data.length > 1 && (
                <div className="chip-row" role="group" aria-label="Pick a class to take attendance">
                  {data.filter((s) => s.active).map((s) => (
                    <button key={s.id} type="button" className={`chip ${selected?.id === s.id ? 'active' : ''}`} onClick={() => setSelectedId(s.id)}>
                      {titleCase(s.dayOfWeek).slice(0, 3)} {formatClock(s.startTime)} · {s.subject}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </AsyncBlock>
      </section>
    </div>
  );
}
