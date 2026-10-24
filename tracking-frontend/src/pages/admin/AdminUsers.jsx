import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { SelectField, TextField } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAsync, useDebouncedValue } from '../../lib/useAsync.js';
import { formatCoordinate } from '../../lib/geo.js';
import { formatDate, formatDateTime, timeAgo, titleCase } from '../../lib/format.js';

const ROLES = ['STUDENT', 'FACULTY', 'ADMIN'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Classroom codes used by the original operations console; campus location codes are added too.
const LEGACY_CLASSROOMS = ['A-204', 'B-112', 'LAB-3', 'LIB-HALL'];

function RoleBadge({ role }) {
  return <span className={`badge badge-role-${role.toLowerCase()}`}>{titleCase(role)}</span>;
}

function StatusBadge({ active }) {
  return <span className={`badge ${active ? 'badge-good' : 'badge-muted'}`}>{active ? 'Active' : 'Deactivated'}</span>;
}

function AddUserModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const empty = { name: '', email: '', role: 'STUDENT', password: '' };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  useEffect(() => {
    if (open) {
      setValues(empty);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!values.name.trim()) next.name = 'Name is required';
    if (!EMAIL_RE.test(values.email.trim())) next.email = 'Enter a valid email address';
    if (values.password && (values.password.length < 8 || values.password.length > 72)) next.password = 'Password must be 8-72 characters';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const created = await api.createUser({
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        ...(values.password ? { password: values.password } : {}),
      });
      toast.success(`Created ${created.name}`);
      onCreated(created);
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors).length ? null : error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add user"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-user-form" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </>
      )}
    >
      <form id="add-user-form" className="form-stack" onSubmit={submit} noValidate>
        <TextField id="nu-name" label="Full name" value={values.name} onChange={set('name')} error={errors.name} maxLength={120} />
        <TextField id="nu-email" type="email" label="Email" value={values.email} onChange={set('email')} error={errors.email} />
        <SelectField id="nu-role" label="Role" value={values.role} onChange={set('role')} error={errors.role}>
          {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </SelectField>
        <TextField id="nu-password" type="password" label="Initial password (optional)" autoComplete="new-password"
          hint="Without a password the user cannot sign in until you set one." value={values.password} onChange={set('password')} error={errors.password} />
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      </form>
    </Modal>
  );
}

function SetPasswordForm({ user }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8 || password.length > 72) {
      setError('Password must be 8-72 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setUserPassword(user.id, password);
      setPassword('');
      toast.success(`Password ${user.hasPassword ? 'reset' : 'set'} for ${user.name}`);
    } catch (err) {
      setError(err.fieldErrors?.password ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <TextField id="set-pw" type="password" label={user.hasPassword ? 'Reset password' : 'Set password'} autoComplete="new-password"
        value={password} onChange={(e) => setPassword(e.target.value)} error={error} hint="8-72 characters. Share it with the user securely." />
      <button type="submit" className="btn btn-secondary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}

function AttendanceSection({ user, classrooms }) {
  const toast = useToast();
  const records = useAsync(() => api.getAttendance(user.id), [user.id]);
  const [classroom, setClassroom] = useState(classrooms[0] ?? '');
  const [confirmBunk, setConfirmBunk] = useState(false);
  const [busy, setBusy] = useState(false);

  const mark = async (status) => {
    setBusy(true);
    try {
      const record = await api.markAttendance(status, user.id, classroom);
      records.setData((rows) => [record, ...(rows ?? [])]);
      toast.success(`${user.name} marked ${status.toLowerCase()} in ${classroom}`);
    } catch (error) {
      toast.error(`Attendance not saved: ${error.message}`);
    } finally {
      setBusy(false);
      setConfirmBunk(false);
    }
  };

  const sorted = [...(records.data ?? [])].sort((a, b) => new Date(b.checkTime) - new Date(a.checkTime));

  return (
    <section className="detail-section" aria-labelledby="att-heading">
      <h3 id="att-heading">Attendance</h3>
      <div className="inline-form">
        <SelectField id="att-classroom" label="Classroom / location" value={classroom} onChange={(e) => setClassroom(e.target.value)}>
          {classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
        <button type="button" className="btn btn-secondary" disabled={busy || !classroom} onClick={() => mark('PRESENT')}>Mark present</button>
        <button type="button" className="btn btn-danger-outline" disabled={busy || !classroom} onClick={() => setConfirmBunk(true)}>Mark bunked</button>
      </div>
      {records.loading && !records.data && <Spinner label="Loading attendance" />}
      {records.error && <ErrorState message={records.error.message} onRetry={records.reload} />}
      {records.data && sorted.length === 0 && <p className="muted">No attendance records.</p>}
      {sorted.length > 0 && (
        <ul className="timeline compact">
          {sorted.slice(0, 8).map((r) => (
            <li key={r.id}>
              <strong>{r.classroomId}</strong>
              <span><span className={`badge badge-status-${r.status.toLowerCase()}`}>{titleCase(r.status)}</span> · {formatDateTime(r.checkTime)}</span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmBunk}
        title="Mark as bunked?"
        message={`This records ${user.name} as BUNKED for ${classroom} and raises a bunk alert. Attendance records cannot be deleted from the app.`}
        confirmLabel="Mark bunked"
        onConfirm={() => mark('BUNKED')}
        onCancel={() => setConfirmBunk(false)}
      />
    </section>
  );
}

function UserDetailModal({ user, onClose, onUpdated, classrooms }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const [role, setRole] = useState(user?.role ?? 'STUDENT');
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const pings = useAsync(() => (user ? api.getRecentLocations(user.id) : Promise.resolve([])), [user?.id]);

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  if (!user) return <Modal open={false} title="" onClose={onClose} />;
  const isSelf = user.id === me.id;

  const apply = async (changes, message) => {
    setSaving(true);
    try {
      const updated = await api.updateUser(user.id, changes);
      onUpdated(updated);
      toast.success(message);
    } catch (error) {
      toast.error(error.message);
      setRole(user.role);
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  return (
    <Modal open title={user.name} onClose={onClose} size="lg">
      <div className="detail-grid">
        <section className="detail-section">
          <h3>Account</h3>
          <dl className="detail-list two-col">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>User ID</dt><dd>{user.id}</dd></div>
            <div><dt>Role</dt><dd><RoleBadge role={user.role} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge active={user.active} /></dd></div>
            <div><dt>Created</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Can sign in</dt><dd>{user.hasPassword ? 'Yes' : 'No password set'}</dd></div>
          </dl>
        </section>

        <section className="detail-section">
          <h3>Role &amp; access</h3>
          {isSelf && <p className="muted small">You cannot change your own role or deactivate your own account.</p>}
          <div className="inline-form">
            <SelectField id="ud-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf || saving}>
              {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
            </SelectField>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSelf || saving || role === user.role}
              onClick={() => setConfirm({
                title: `Change role to ${titleCase(role)}?`,
                message: role === 'ADMIN'
                  ? `${user.name} will get full administrative access, including user management.`
                  : `${user.name} will become ${titleCase(role)}${user.role === 'ADMIN' ? ' and lose admin access immediately' : ''}.`,
                label: 'Change role',
                tone: role === 'ADMIN' || user.role === 'ADMIN' ? 'danger' : 'primary',
                run: () => apply({ role }, `${user.name} is now ${titleCase(role)}`),
              })}
            >
              Save role
            </button>
          </div>
          <div className="row-actions">
            {user.active ? (
              <button type="button" className="btn btn-danger-outline" disabled={isSelf || saving}
                onClick={() => setConfirm({
                  title: 'Deactivate account?',
                  message: `${user.name} will be signed out everywhere and cannot sign in until reactivated. Their records are kept.`,
                  label: 'Deactivate',
                  tone: 'danger',
                  run: () => apply({ active: false }, `${user.name} deactivated`),
                })}
              >
                Deactivate account
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={saving}
                onClick={() => apply({ active: true }, `${user.name} reactivated`)}
              >
                Reactivate account
              </button>
            )}
          </div>
          <SetPasswordForm user={user} />
        </section>

        <section className="detail-section">
          <h3>Recent location pings</h3>
          {pings.loading && !pings.data && <Spinner label="Loading pings" />}
          {pings.error && <ErrorState message={pings.error.message} onRetry={pings.reload} />}
          {pings.data && pings.data.length === 0 && <p className="muted">No location pings recorded for this user.</p>}
          {pings.data?.length > 0 && (
            <ul className="timeline compact">
              {pings.data.map((p) => (
                <li key={p.id}>
                  <strong>{p.latitude != null ? `${formatCoordinate(p.latitude)}, ${formatCoordinate(p.longitude)}` : p.beaconId ?? p.wifiPointId ?? p.rfidTagId ?? '—'}</strong>
                  <span>{p.source} · <time title={formatDateTime(p.timestamp)}>{timeAgo(p.timestamp)}</time></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AttendanceSection user={user} classrooms={classrooms} />
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        tone={confirm?.tone}
        onConfirm={() => confirm.run()}
        onCancel={() => { setConfirm(null); setRole(user.role); }}
      />
    </Modal>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const q = useDebouncedValue(search);
  const users = useAsync(() => api.getUsers({ q, role, active: status }), [q, role, status]);
  const locations = useAsync(() => api.getCampusLocations(), []);

  const classrooms = useMemo(
    () => [...new Set([...(locations.data ?? []).map((l) => l.code), ...LEGACY_CLASSROOMS])],
    [locations.data],
  );
  const selected = users.data?.find((u) => u.id === selectedId) ?? null;
  const filtered = Boolean(q || role || status);

  return (
    <AdminLayout
      title="Users"
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add user</button>}
    >
      <section className="card">
        <div className="toolbar" role="search">
          <div className="search-input">
            <Icon name="search" />
            <input type="search" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </select>
          <select className="input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
          {users.data && <span className="muted small">{users.data.length} user{users.data.length === 1 ? '' : 's'}</span>}
        </div>

        {users.loading && !users.data && <Spinner label="Loading users" />}
        {users.error && <ErrorState title="Could not load users" message={users.error.message} onRetry={users.reload} />}
        {users.data && users.data.length === 0 && (
          <EmptyState icon="users" title={filtered ? 'No users match these filters' : 'No users yet'}>
            {filtered ? 'Clear the search or filters to see everyone.' : 'Users appear here when they register or are added.'}
          </EmptyState>
        )}
        {users.data?.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Sign-in</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><StatusBadge active={u.active} /></td>
                    <td>{u.hasPassword ? 'Password set' : <span className="muted">No password</span>}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td className="actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(u.id)}>View<span className="sr-only"> {u.name}</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddUserModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          users.reload();
        }}
      />
      <UserDetailModal
        user={selected}
        classrooms={classrooms}
        onClose={() => setSelectedId(null)}
        onUpdated={(updated) => users.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))}
      />
    </AdminLayout>
  );
}
