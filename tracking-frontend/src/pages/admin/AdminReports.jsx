import { useCallback, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import AlertsPanel from '../../components/AlertsPanel.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { BarList, ChartCard, ColumnChart } from '../../components/ui/Charts.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/useAsync.js';
import { daysAgo, formatDateTime, formatPercent, isoDate, titleCase } from '../../lib/format.js';

const PRESETS = [7, 14, 30, 90];
const STATUSES = ['PRESENT', 'ABSENT', 'BUNKED'];

const toRows = (map, label = titleCase) => Object.entries(map ?? {}).map(([key, value]) => ({ label: label(key), value }));
const asIs = (key) => key; // ping sources are acronyms (GPS, BLE, WIFI, RFID)

function Pager({ data, page, setPage, noun }) {
  return (
    <div className="pager">
      <span className="muted small">{data.totalElements.toLocaleString()} {noun} · page {data.page + 1} of {Math.max(1, data.totalPages)}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

function AttendanceTable({ range, nameFor, users }) {
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [page, setPage] = useState(0);
  const records = useAsync(
    () => api.getAttendanceRecords({ ...range, status, userId, classroomId: classroomId.trim(), page, size: 15 }),
    [range.from, range.to, status, userId, classroomId, page],
  );
  const reset = (setter) => (e) => { setPage(0); setter(e.target.value); };

  return (
    <section className="card" aria-labelledby="att-report-title">
      <header className="card-header"><h2 id="att-report-title">Attendance records</h2></header>
      <div className="toolbar">
        <select className="input" aria-label="Filter by status" value={status} onChange={reset(setStatus)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select className="input" aria-label="Filter by user" value={userId} onChange={reset(setUserId)}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input className="input" type="search" placeholder="Classroom code" aria-label="Filter by classroom code" value={classroomId} onChange={reset(setClassroomId)} />
      </div>
      {records.loading && !records.data && <Spinner label="Loading attendance" />}
      {records.error && <ErrorState message={records.error.message} onRetry={records.reload} />}
      {records.data && records.data.content.length === 0 && <EmptyState icon="clock" title="No attendance records">Nothing recorded for these filters and dates.</EmptyState>}
      {records.data?.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">User</th><th scope="col">Classroom</th><th scope="col">Status</th><th scope="col">Time</th></tr></thead>
              <tbody>
                {records.data.content.map((r) => (
                  <tr key={r.id}>
                    <td>{nameFor(r.userId)}</td>
                    <td className="mono">{r.classroomId}</td>
                    <td><span className={`badge badge-status-${r.status.toLowerCase()}`}>{titleCase(r.status)}</span></td>
                    <td className="small">{formatDateTime(r.checkTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={records.data} page={page} setPage={setPage} noun="records" />
        </>
      )}
    </section>
  );
}

function AttendanceReport({ range }) {
  const [departmentId, setDepartmentId] = useState('');
  const departments = useAsync(() => api.getAdminDepartments(), []);
  const report = useAsync(() => api.getAttendanceReport({ ...range, departmentId }), [range.from, range.to, departmentId]);
  const data = report.data;

  return (
    <section className="card" aria-labelledby="att-dept-title">
      <header className="card-header">
        <div>
          <h2 id="att-dept-title">Attendance by department</h2>
          <p>Timetabled classes only. Absent and bunked both count against a student.</p>
        </div>
        <select className="input" aria-label="Filter by department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </header>
      {report.loading && !data && <Spinner label="Building attendance report" />}
      {report.error && <ErrorState message={report.error.message} onRetry={report.reload} />}
      {data && data.departments.length === 0 && <EmptyState icon="building" title="No departments yet">Create departments in Academics to see attendance by department.</EmptyState>}
      {data && data.departments.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Department</th><th scope="col" className="num">Students</th><th scope="col" className="num">Classes</th>
                  <th scope="col" className="num">Present</th><th scope="col" className="num">Absent</th><th scope="col" className="num">Bunked</th>
                  <th scope="col" className="num">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong><br /><small className="muted mono">{d.code}</small></td>
                    <td className="num">{d.students}</td><td className="num">{d.total}</td>
                    <td className="num">{d.present}</td><td className="num">{d.absent}</td><td className="num">{d.bunked}</td>
                    <td className="num">{d.total > 0 ? formatPercent(d.percent) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="section-title">Below {formatPercent(data.requiredPercent)} ({data.belowRequired.length})</h3>
          {data.belowRequired.length === 0 ? (
            <p className="muted">No student is below the required attendance in this range.</p>
          ) : (
            <ul className="timeline compact">
              {data.belowRequired.map((s) => (
                <li key={s.userId}>
                  <strong>{s.name} · {formatPercent(s.percent)}</strong>
                  <span>{s.departmentName ?? 'No department'} · {s.total} classes · {s.bunked} bunked</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function FootfallCard() {
  const [today] = useState(() => isoDate(Date.now()));
  const [date, setDate] = useState(today);
  const footfall = useAsync(() => api.getFootfall(date), [date]);
  const rows = (footfall.data?.hours ?? []).map((h) => ({
    label: `${String(h.hour).padStart(2, '0')}:00`,
    short: String(h.hour).padStart(2, '0'),
    value: h.people,
  }));

  const hasData = rows.some((r) => r.value > 0);
  const peak = footfall.data?.peakHour;

  return (
    <section className="card chart-card" aria-labelledby="footfall-title">
      <header className="card-header">
        <div>
          <h2 id="footfall-title">Footfall by hour</h2>
          <p>{peak != null ? `Busiest at ${String(peak).padStart(2, '0')}:00 with ${footfall.data.peakPeople} people.` : 'Distinct people seen on campus in each hour.'}</p>
        </div>
        <label className="inline-label">Day
          <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </header>
      {footfall.loading && !footfall.data && <Spinner label="Loading footfall" />}
      {footfall.error && <ErrorState message={footfall.error.message} onRetry={footfall.reload} />}
      {footfall.data && (hasData
        ? <ColumnChart rows={rows} valueLabel="people" />
        : <p className="chart-empty">Nobody shared a position on campus on this day.</p>)}
    </section>
  );
}

export default function AdminReports() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState({ from: daysAgo(13), to: isoDate(Date.now()) });
  const [draft, setDraft] = useState(range);
  const [rangeError, setRangeError] = useState(null);
  const report = useAsync(() => api.getActivityReport(range), [range.from, range.to]);
  const users = useAsync(() => api.getUsers(), []);
  const userMap = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data]);
  const nameFor = useCallback((id) => userMap.get(id)?.name ?? `User ${id}`, [userMap]);

  const applyRange = (next) => {
    if (!next.from || !next.to) return setRangeError('Choose both a start and an end date.');
    if (next.from > next.to) return setRangeError('The start date must be on or before the end date.');
    if ((new Date(next.to) - new Date(next.from)) / 86_400_000 >= 92) return setRangeError('Choose a range of at most 92 days.');
    setRangeError(null);
    setDraft(next);
    setRange(next);
    return null;
  };

  const dayRows = (report.data?.pingsPerDay ?? []).map((d) => {
    const date = new Date(`${d.date}T00:00:00`);
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      short: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      value: d.count,
    };
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.exportAttendance(range);
      toast.success('Attendance exported');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout
      title="Reports"
      actions={(
        <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={exporting}
          title="Download the attendance records in the selected range as a spreadsheet">
          <Icon name="table" size={16} /> {exporting ? 'Exporting…' : 'Export attendance'}
        </button>
      )}
    >
      <div className="page-stack">
        <section className="card">
          <form className="toolbar" onSubmit={(e) => { e.preventDefault(); applyRange(draft); }} noValidate>
            <div className="chip-row" role="group" aria-label="Quick ranges">
              {PRESETS.map((days) => {
                const preset = { from: daysAgo(days - 1), to: isoDate(Date.now()) };
                const active = range.from === preset.from && range.to === preset.to;
                return (
                  <button key={days} type="button" className={`chip ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => applyRange(preset)}>
                    Last {days} days
                  </button>
                );
              })}
            </div>
            <label className="inline-label">From <input className="input" type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} /></label>
            <label className="inline-label">To <input className="input" type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></label>
            <button type="submit" className="btn btn-secondary btn-sm">Apply</button>
          </form>
          {rangeError && <p className="form-error" role="alert">{rangeError}</p>}
        </section>

        {report.loading && !report.data && <Spinner label="Building report" />}
        {report.error && <ErrorState title="Could not load the report" message={report.error.message} onRetry={report.reload} />}
        {report.data && (
          <>
            <ChartCard
              title="Location pings per day"
              subtitle={`${report.data.from} to ${report.data.to}`}
              rows={dayRows}
              labelHeader="Day"
              valueHeader="Pings"
              empty="No location pings were stored in this date range."
            >
              <ColumnChart rows={dayRows} valueLabel="pings" />
            </ChartCard>
            <div className="grid-3">
              <ChartCard title="Pings by source" rows={toRows(report.data.pingsBySource, asIs)} labelHeader="Source" valueHeader="Pings" empty="No pings in this range.">
                <BarList rows={toRows(report.data.pingsBySource, asIs)} />
              </ChartCard>
              <ChartCard title="Attendance by status" rows={toRows(report.data.attendanceByStatus)} labelHeader="Status" valueHeader="Records" empty="No attendance recorded in this range.">
                <BarList rows={toRows(report.data.attendanceByStatus)} />
              </ChartCard>
              <ChartCard title="Alerts by type" rows={toRows(report.data.alertsByType)} labelHeader="Type" valueHeader="Alerts" empty="No alerts in this range.">
                <BarList rows={toRows(report.data.alertsByType)} />
              </ChartCard>
            </div>
          </>
        )}

        <AttendanceReport range={range} />
        <FootfallCard />
        <AttendanceTable range={range} nameFor={nameFor} users={users.data ?? []} />
        <AlertsPanel title="Alerts" subtitle="Everything raised across the campus." canAcknowledge pageSize={10} />
      </div>
    </AdminLayout>
  );
}
