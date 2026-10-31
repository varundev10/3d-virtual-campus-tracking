import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDate, titleCase } from '../lib/format.js';
import { TextField } from './ui/Field.jsx';
import { useToast } from './ui/Toast.jsx';

export function AccountSummary({ user, brief = false }) {
  return (
    <dl className="detail-list">
      {!brief && <div><dt>Name</dt><dd>{user.name}</dd></div>}
      {!brief && <div><dt>Email</dt><dd>{user.email}</dd></div>}
      {!brief && <div><dt>Role</dt><dd><span className={`badge badge-role-${user.role.toLowerCase()}`}>{titleCase(user.role)}</span></dd></div>}
      {user.role !== 'ADMIN' && (
        <div>
          <dt>Department</dt>
          <dd>
            {user.departmentName ?? 'Not assigned'}
            {user.headOfDepartment && <span className="badge badge-good">Head of department</span>}
          </dd>
        </div>
      )}
      <div><dt>Status</dt><dd>{user.active ? 'Active' : 'Deactivated'}</dd></div>
      <div><dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd></div>
      <div><dt>User ID</dt><dd>{user.id}</dd></div>
    </dl>
  );
}

export function ProfileNameForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setUser(await api.updateMe({ name: name.trim() }));
      toast.success('Profile updated');
    } catch (err) {
      setError(err.fieldErrors?.name ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <TextField id="profile-name" label="Display name" value={name} maxLength={120}
        onChange={(e) => setName(e.target.value)} error={error} autoComplete="name" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={saving || name.trim() === user.name}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const toast = useToast();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!values.currentPassword) next.currentPassword = 'Enter your current password';
    if (values.newPassword.length < 8 || values.newPassword.length > 72) next.newPassword = 'Password must be 8-72 characters';
    if (values.confirm !== values.newPassword) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api.changePassword(values.currentPassword, values.newPassword);
      setValues({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      setErrors(err.status === 400 && !Object.keys(err.fieldErrors).length
        ? { currentPassword: err.message }
        : { ...err.fieldErrors, form: Object.keys(err.fieldErrors).length ? null : err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <TextField id="pw-current" type="password" label="Current password" autoComplete="current-password"
        value={values.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
      <TextField id="pw-new" type="password" label="New password" autoComplete="new-password" hint="8-72 characters"
        value={values.newPassword} onChange={set('newPassword')} error={errors.newPassword} />
      <TextField id="pw-confirm" type="password" label="Confirm new password" autoComplete="new-password"
        value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Change password'}</button>
      </div>
    </form>
  );
}
