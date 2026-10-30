import { useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { SelectField, TextField } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/useAsync.js';
import { WEEKDAYS, formatClock, titleCase } from '../../lib/format.js';

const TABS = [
  { id: 'departments', label: 'Departments' },
  { id: 'classrooms', label: 'Classrooms' },
  { id: 'timetable', label: 'Timetable' },
];

// Shared by the three editors: shows the server's field errors, or its message when there are none.
function describeError(error) {
  const fields = error.fieldErrors ?? {};
  return { ...fields, form: Object.keys(fields).length ? null : error.message };
}

function FormModal({ open, title, formId, busy, submitLabel = 'Save', onClose, children }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </>
      )}
    >
      {children}
    </Modal>
  );
}

// ---- Departments ----

// Mounted only while editing (department is null when adding), so its form starts from the props.
function DepartmentModal({ department, onClose, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({ code: department?.code ?? '', name: department?.name ?? '', headUserId: department?.headUserId ?? '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const faculty = useAsync(() => (department ? api.getUsers({ role: 'FACULTY' }) : Promise.resolve([])), [department?.id]);
  const members = (faculty.data ?? []).filter((u) => u.departmentId === department?.id);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(values.code.trim())) next.code = 'Use 2-20 letters, digits, "-" or "_"';
    if (!values.name.trim()) next.name = 'Name is required';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.saveDepartment(department?.id, {
        code: values.code.trim(),
        name: values.name.trim(),
        headUserId: values.headUserId ? Number(values.headUserId) : null,
      });
      toast.success(department ? 'Department updated' : 'Department created');
      onSaved();
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal open title={department ? `Edit ${department.name}` : 'Add department'} formId="dept-form" busy={busy} onClose={onClose}>
      <form id="dept-form" className="form-stack" onSubmit={submit} noValidate>
        <TextField id="dp-code" label="Code" value={values.code} maxLength={20} error={errors.code}
          onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} hint="Short and unique, for example CSE." />
        <TextField id="dp-name" label="Name" value={values.name} maxLength={150} error={errors.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        {department && (
          <SelectField id="dp-head" label="Head of department" value={values.headUserId} error={errors.headUserId}
            hint={members.length === 0 ? 'Add a faculty member to this department first (Users), then choose them here.' : 'Heads run every class in the department and see all its alerts.'}
            onChange={(e) => setValues((v) => ({ ...v, headUserId: e.target.value }))}>
            <option value="">No head assigned</option>
            {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectField>
        )}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      </form>
    </FormModal>
  );
}

function DepartmentsTab() {
  const toast = useToast();
  const departments = useAsync(() => api.getAdminDepartments(), []);
  const [editing, setEditing] = useState(undefined);
  const [removing, setRemoving] = useState(null);

  const remove = async () => {
    try {
      await api.deleteDepartment(removing.id);
      toast.success(`${removing.name} deleted`);
      departments.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="card" aria-labelledby="dept-title">
      <header className="card-header">
        <div>
          <h2 id="dept-title">Departments</h2>
          <p>Students follow their department&apos;s timetable; faculty see their department&apos;s students.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}><Icon name="plus" size={16} /> Add department</button>
      </header>
      {departments.loading && !departments.data && <Spinner label="Loading departments" />}
      {departments.error && <ErrorState message={departments.error.message} onRetry={departments.reload} />}
      {departments.data && departments.data.length === 0 && (
        <EmptyState icon="building" title="No departments yet">Create one, then assign students and faculty to it in Users.</EmptyState>
      )}
      {departments.data?.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Department</th><th scope="col">Head</th>
                <th scope="col" className="num">Students</th><th scope="col" className="num">Faculty</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {departments.data.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong><br /><small className="muted mono">{d.code}</small></td>
                  <td>{d.headName ?? <span className="muted">Not assigned</span>}</td>
                  <td className="num">{d.students}</td>
                  <td className="num">{d.faculty}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(d)}>Edit<span className="sr-only"> {d.name}</span></button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(d)}>Delete<span className="sr-only"> {d.name}</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <DepartmentModal key={editing?.id ?? 'new'} department={editing} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); departments.reload(); }} />
      )}
      <ConfirmDialog open={Boolean(removing)} title={`Delete ${removing?.name}?`}
        message="Only empty departments can be deleted. Move its people, classrooms and classes elsewhere first."
        confirmLabel="Delete" onConfirm={remove} onCancel={() => setRemoving(null)} />
    </section>
  );
}

// ---- Classrooms ----

// Mounted only while editing (classroom is null when adding), so its form starts from the props.
function ClassroomModal({ classroom, onClose, onSaved, departments, places }) {
  const toast = useToast();
  const [values, setValues] = useState(() => (classroom ? {
    code: classroom.code, name: classroom.name, locationCode: classroom.locationCode ?? '',
    latitude: String(classroom.latitude), longitude: String(classroom.longitude), radiusMeters: String(classroom.radiusMeters),
    floorLevel: classroom.floorLevel ?? '', capacity: classroom.capacity ?? '', departmentId: classroom.departmentId ?? '',
  } : { code: '', name: '', locationCode: '', latitude: '', longitude: '', radiusMeters: '25', floorLevel: '', capacity: '', departmentId: '' }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const pickPlace = (e) => {
    const place = places.find((p) => p.code === e.target.value);
    setValues((v) => ({
      ...v,
      locationCode: e.target.value,
      // Choosing a building fills the room's coordinates from it; they can still be fine-tuned afterwards.
      ...(place ? { latitude: String(place.latitude), longitude: String(place.longitude) } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(values.code.trim())) next.code = 'Use letters, digits, "-" or "_" (max 32)';
    if (!values.name.trim()) next.name = 'Name is required';
    if (values.latitude === '' || Number.isNaN(Number(values.latitude))) next.latitude = 'Enter the latitude, or choose a campus location';
    if (values.longitude === '' || Number.isNaN(Number(values.longitude))) next.longitude = 'Enter the longitude, or choose a campus location';
    setErrors(next);
    if (Object.keys(next).length) return;
    const optional = (value) => (value === '' ? null : Number(value));
    setBusy(true);
    try {
      await api.saveClassroom(classroom?.id, {
        code: values.code.trim(),
        name: values.name.trim(),
        locationCode: values.locationCode || null,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        radiusMeters: optional(values.radiusMeters),
        floorLevel: optional(values.floorLevel),
        capacity: optional(values.capacity),
        departmentId: optional(values.departmentId),
      });
      toast.success(classroom ? 'Classroom updated' : 'Classroom created');
      onSaved();
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal open title={classroom ? `Edit ${classroom.code}` : 'Add classroom'} formId="room-form" busy={busy} onClose={onClose}>
      <form id="room-form" className="form-stack" onSubmit={submit} noValidate>
        <div className="field-pair">
          <TextField id="cr-code" label="Code" value={values.code} maxLength={32} error={errors.code} onChange={set('code')} hint="For example A-204." />
          <TextField id="cr-name" label="Name" value={values.name} maxLength={120} error={errors.name} onChange={set('name')} />
        </div>
        <SelectField id="cr-place" label="Building" value={values.locationCode} onChange={pickPlace} error={errors.locationCode}
          hint="Picking one fills in its coordinates. Fine-tune them below for the exact room.">
          <option value="">Not linked to a building</option>
          {places.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </SelectField>
        <div className="field-pair">
          <TextField id="cr-lat" label="Latitude" inputMode="decimal" value={values.latitude} error={errors.latitude} onChange={set('latitude')} />
          <TextField id="cr-lng" label="Longitude" inputMode="decimal" value={values.longitude} error={errors.longitude} onChange={set('longitude')} />
        </div>
        <div className="field-pair">
          <TextField id="cr-radius" label="Radius (m)" inputMode="numeric" value={values.radiusMeters} error={errors.radiusMeters} onChange={set('radiusMeters')}
            hint="A position this close counts as inside the room (5-200)." />
          <TextField id="cr-floor" label="Floor" inputMode="numeric" value={values.floorLevel} error={errors.floorLevel} onChange={set('floorLevel')}
            hint="0 is ground. Leave empty to accept any floor." />
        </div>
        <div className="field-pair">
          <TextField id="cr-cap" label="Capacity" inputMode="numeric" value={values.capacity} error={errors.capacity} onChange={set('capacity')} />
          <SelectField id="cr-dept" label="Owned by department" value={values.departmentId} onChange={set('departmentId')} error={errors.departmentId}>
            <option value="">Shared / none</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        </div>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      </form>
    </FormModal>
  );
}

function ClassroomsTab() {
  const toast = useToast();
  const rooms = useAsync(() => api.getClassrooms(), []);
  const departments = useAsync(() => api.getAdminDepartments(), []);
  const places = useAsync(() => api.getCampusLocations(), []);
  const [editing, setEditing] = useState(undefined);
  const [removing, setRemoving] = useState(null);

  const remove = async () => {
    try {
      await api.deleteClassroom(removing.id);
      toast.success(`${removing.code} deleted`);
      rooms.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="card" aria-labelledby="rooms-title">
      <header className="card-header">
        <div>
          <h2 id="rooms-title">Classrooms</h2>
          <p>A student is marked present when their position is within the radius of the room (and on its floor).</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}><Icon name="plus" size={16} /> Add classroom</button>
      </header>
      {rooms.loading && !rooms.data && <Spinner label="Loading classrooms" />}
      {rooms.error && <ErrorState message={rooms.error.message} onRetry={rooms.reload} />}
      {rooms.data && rooms.data.length === 0 && (
        <EmptyState icon="building" title="No classrooms yet">Add the rooms classes are held in, with their position on campus.</EmptyState>
      )}
      {rooms.data?.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Room</th><th scope="col">Building</th><th scope="col">Department</th>
                <th scope="col" className="num">Radius</th><th scope="col" className="num">Floor</th><th scope="col" className="num">Capacity</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rooms.data.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.code}</strong><br /><small className="muted">{r.name}</small></td>
                  <td>{r.locationCode ?? <span className="muted">—</span>}</td>
                  <td>{r.departmentName ?? <span className="muted">Shared</span>}</td>
                  <td className="num">{r.radiusMeters} m</td>
                  <td className="num">{r.floorLevel ?? 'any'}</td>
                  <td className="num">{r.capacity ?? '—'}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>Edit<span className="sr-only"> {r.code}</span></button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(r)}>Delete<span className="sr-only"> {r.code}</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <ClassroomModal key={editing?.id ?? 'new'} classroom={editing} departments={departments.data ?? []} places={places.data ?? []}
          onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); rooms.reload(); }} />
      )}
      <ConfirmDialog open={Boolean(removing)} title={`Delete ${removing?.code}?`}
        message="A classroom used by the timetable cannot be deleted. Attendance already recorded keeps its classroom code."
        confirmLabel="Delete" onConfirm={remove} onCancel={() => setRemoving(null)} />
    </section>
  );
}

// ---- Timetable ----

// Mounted only while editing (session is null when adding), so its form starts from the props.
function SessionModal({ session, onClose, onSaved, departments, rooms, faculty, defaultDepartmentId }) {
  const toast = useToast();
  const [values, setValues] = useState(() => (session ? {
    subject: session.subject, departmentId: session.departmentId, classroomId: session.classroomId, facultyId: session.facultyId ?? '',
    dayOfWeek: session.dayOfWeek, startTime: formatClock(session.startTime), endTime: formatClock(session.endTime), active: session.active,
  } : {
    subject: '', departmentId: defaultDepartmentId ?? '', classroomId: '', facultyId: '', dayOfWeek: 'MONDAY',
    startTime: '10:00', endTime: '11:00', active: true,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const staff = faculty.filter((u) => !values.departmentId || u.departmentId === Number(values.departmentId) || String(u.id) === String(values.facultyId));

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!values.subject.trim()) next.subject = 'Subject is required';
    if (!values.departmentId) next.departmentId = 'Choose a department';
    if (!values.classroomId) next.classroomId = 'Choose a classroom';
    if (!values.startTime || !values.endTime) next.endTime = 'Set the start and end time';
    else if (values.endTime <= values.startTime) next.endTime = 'The end time must be after the start time';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.saveSession(session?.id, {
        subject: values.subject.trim(),
        departmentId: Number(values.departmentId),
        classroomId: Number(values.classroomId),
        facultyId: values.facultyId ? Number(values.facultyId) : null,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        active: values.active,
      });
      toast.success(session ? 'Class updated' : 'Class added to the timetable');
      onSaved();
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal open title={session ? `Edit ${session.subject}` : 'Add class'} formId="session-form" busy={busy} onClose={onClose}>
      <form id="session-form" className="form-stack" onSubmit={submit} noValidate>
        <TextField id="ss-subject" label="Subject" value={values.subject} maxLength={120} error={errors.subject} onChange={set('subject')} />
        <div className="field-pair">
          <SelectField id="ss-dept" label="Department" value={values.departmentId} error={errors.departmentId} onChange={set('departmentId')}>
            <option value="">Choose…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <SelectField id="ss-room" label="Classroom" value={values.classroomId} error={errors.classroomId} onChange={set('classroomId')}>
            <option value="">Choose…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
          </SelectField>
        </div>
        <SelectField id="ss-faculty" label="Faculty" value={values.facultyId} error={errors.facultyId} onChange={set('facultyId')}
          hint="Without a faculty member, off-schedule alerts are not raised for this class.">
          <option value="">Not assigned</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </SelectField>
        <div className="field-pair">
          <SelectField id="ss-day" label="Day" value={values.dayOfWeek} error={errors.dayOfWeek} onChange={set('dayOfWeek')}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}
          </SelectField>
          <label className="field check">
            <input type="checkbox" checked={values.active} onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))} />
            <span>Active (paused classes are not tracked)</span>
          </label>
        </div>
        <div className="field-pair">
          <TextField id="ss-start" type="time" label="Starts" value={values.startTime} error={errors.startTime} onChange={set('startTime')} />
          <TextField id="ss-end" type="time" label="Ends" value={values.endTime} error={errors.endTime} onChange={set('endTime')} />
        </div>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      </form>
    </FormModal>
  );
}

function TimetableTab() {
  const toast = useToast();
  const [departmentId, setDepartmentId] = useState('');
  const sessions = useAsync(() => api.getAdminSessions({ departmentId }), [departmentId]);
  const departments = useAsync(() => api.getAdminDepartments(), []);
  const rooms = useAsync(() => api.getClassrooms(), []);
  const faculty = useAsync(() => api.getUsers({ role: 'FACULTY', active: 'true' }), []);
  const [editing, setEditing] = useState(undefined);
  const [removing, setRemoving] = useState(null);

  const rows = useMemo(() => [...(sessions.data ?? [])].sort((a, b) => WEEKDAYS.indexOf(a.dayOfWeek) - WEEKDAYS.indexOf(b.dayOfWeek)
    || a.startTime.localeCompare(b.startTime)), [sessions.data]);

  const remove = async () => {
    try {
      await api.deleteSession(removing.id);
      toast.success(`${removing.subject} removed from the timetable`);
      sessions.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="card" aria-labelledby="tt-title">
      <header className="card-header">
        <div>
          <h2 id="tt-title">Weekly timetable</h2>
          <p>Attendance is tracked for each active class, every week. Pause a class instead of deleting it to keep its history.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}
          disabled={!departments.data?.length || !rooms.data?.length}>
          <Icon name="plus" size={16} /> Add class
        </button>
      </header>
      <div className="toolbar">
        <select className="input" aria-label="Filter by department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {sessions.data && <span className="muted small">{rows.length} class{rows.length === 1 ? '' : 'es'}</span>}
      </div>
      {departments.data && rooms.data && (!departments.data.length || !rooms.data.length) && (
        <p className="form-notice" role="status">Create at least one department and one classroom before adding classes.</p>
      )}
      {sessions.loading && !sessions.data && <Spinner label="Loading timetable" />}
      {sessions.error && <ErrorState message={sessions.error.message} onRetry={sessions.reload} />}
      {sessions.data && rows.length === 0 && <EmptyState icon="clock" title="No classes yet">Add classes to start tracking attendance.</EmptyState>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">When</th><th scope="col">Subject</th><th scope="col">Room</th>
                <th scope="col">Department</th><th scope="col">Faculty</th><th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{titleCase(s.dayOfWeek).slice(0, 3)} {formatClock(s.startTime)}–{formatClock(s.endTime)}</td>
                  <td><strong>{s.subject}</strong></td>
                  <td>{s.classroomCode}</td>
                  <td>{s.departmentName}</td>
                  <td>{s.facultyName ?? <span className="muted">Not assigned</span>}</td>
                  <td><span className={`badge ${s.active ? 'badge-good' : 'badge-muted'}`}>{s.active ? 'Active' : 'Paused'}</span></td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit<span className="sr-only"> {s.subject}</span></button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(s)}>Delete<span className="sr-only"> {s.subject}</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <SessionModal key={editing?.id ?? 'new'} session={editing} departments={departments.data ?? []} rooms={rooms.data ?? []}
          faculty={faculty.data ?? []} defaultDepartmentId={departmentId} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); sessions.reload(); }} />
      )}
      <ConfirmDialog open={Boolean(removing)} title={`Remove ${removing?.subject}?`}
        message="The class leaves the timetable and is no longer tracked. Attendance already recorded is kept."
        confirmLabel="Remove" onConfirm={remove} onCancel={() => setRemoving(null)} />
    </section>
  );
}

export default function AdminAcademics() {
  const [tab, setTab] = useState('departments');
  return (
    <AdminLayout title="Academics">
      <div className="page-stack">
        <div className="segmented-control" role="tablist" aria-label="Academics sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {tab === 'departments' && <DepartmentsTab />}
        {tab === 'classrooms' && <ClassroomsTab />}
        {tab === 'timetable' && <TimetableTab />}
      </div>
    </AdminLayout>
  );
}
