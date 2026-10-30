import { useMemo, useState } from 'react';
import AlertsPanel from '../../components/AlertsPanel.jsx';
import Icon from '../../components/ui/Icon.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { formatNumber, formatPercent } from '../../lib/format.js';

// Students of the faculty member's department with their attendance over the last 30 days.
export default function DepartmentPage() {
  const { user } = useAuth();
  const students = useAsync(() => api.getDepartmentStudents(), []);
  const overview = useAsync(() => api.getFacultyOverview(), []);
  const [query, setQuery] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (students.data ?? []).filter((s) => (!onlyLow || s.belowRequired)
      && (!needle || s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle)));
  }, [students.data, query, onlyLow]);

  const below = (students.data ?? []).filter((s) => s.belowRequired).length;
  const required = overview.data?.requiredPercent;

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1 className="page-title">{user.departmentName ?? 'Department'}</h1>
          <p className="muted">Attendance over the last 30 days{required != null && ` · ${formatPercent(required)} required`}.</p>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard tone="brand" icon="users" label="Students" value={formatNumber(students.data?.length ?? 0)} hint="Active in your department" />
        <StatCard icon="alert" label="Below required" value={formatNumber(below)} hint={required != null ? `Under ${formatPercent(required)} attendance` : 'Low attendance'} />
        <StatCard icon="activity" label="Open alerts" value={formatNumber(overview.data?.openAlerts ?? 0)} hint="Bunks and off-schedule classes" />
      </div>

      <section className="card" aria-labelledby="students-title">
        <header className="card-header"><h2 id="students-title">Students</h2></header>
        <div className="toolbar" role="search">
          <div className="search-input">
            <Icon name="search" />
            <input type="search" placeholder="Search name or email" aria-label="Search students" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <label className="inline-label">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Only below required
          </label>
        </div>

        {students.loading && !students.data && <Spinner label="Loading students" />}
        {students.error && <ErrorState title="Could not load students" message={students.error.message} onRetry={students.reload} />}
        {students.data && rows.length === 0 && (
          <EmptyState icon="users" title={students.data.length === 0 ? 'No students yet' : 'No students match'}>
            {students.data.length === 0 ? 'Students appear here once administration adds them to your department.' : 'Clear the search or filter to see everyone.'}
          </EmptyState>
        )}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col" className="num">Attendance</th>
                  <th scope="col" className="num">Classes</th>
                  <th scope="col" className="num">Bunked</th>
                  <th scope="col">Standing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong><br /><small className="muted">{s.email}</small></td>
                    <td className="num">{s.total > 0 ? formatPercent(s.percent) : '—'}</td>
                    <td className="num">{s.total}</td>
                    <td className="num">{s.bunked}</td>
                    <td>
                      {s.total === 0 ? <span className="badge badge-muted">No classes yet</span>
                        : s.belowRequired ? <span className="badge badge-status-bunked">Below required</span>
                          : <span className="badge badge-good">On track</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertsPanel title="Department alerts" subtitle="Bunks, classes missed by faculty and impossible movements." canAcknowledge onChange={overview.reload} />
    </div>
  );
}
