import { useState } from 'react';
import { TextField } from '../../components/ui/Field.jsx';
import Icon from '../../components/ui/Icon.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import { homePathFor, isAdmin, useAuth } from '../../lib/auth.jsx';
import { Link, useRouter } from '../../lib/router.jsx';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only follow ?next= when it points inside the area the verified role may use.
export function postLoginPath(user, next) {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    if (isAdmin(user) && next.startsWith('/admin')) return next;
    if (!isAdmin(user) && next.startsWith('/app')) return next;
  }
  return homePathFor(user);
}

function AuthFrame({ title, subtitle, children, footer }) {
  useDocumentTitle(title);
  return (
    <div className="auth-page">
      <section className="auth-aside" aria-hidden="true">
        <div className="brand-lockup">
          <span className="brand-mark">UC</span>
          <div>
            <strong className="brand-name">UCER Smart Campus</strong>
            <p>3D virtual campus &amp; tracking</p>
          </div>
        </div>
        <div className="auth-hero">
          <p className="eyebrow">Digital twin · live campus</p>
          <h2>Navigate your campus in <em>three dimensions</em>.</h2>
          <p>A spatial view of every building, lab and facility, with consent-based location sharing.</p>
        </div>
        <ul className="auth-points">
          <li><Icon name="cube" /> Explore a 3D model of the campus</li>
          <li><Icon name="search" /> Find buildings, labs and the library</li>
          <li><Icon name="shield" /> Location is shared only with your consent, and only on campus</li>
        </ul>
      </section>
      <main className="auth-main" id="main">
        <ThemeToggle className="auth-theme" />
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login, notice } = useAuth();
  const { navigate, query } = useRouter();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!EMAIL_RE.test(values.email.trim())) next.email = 'Enter a valid email address';
    if (!values.password) next.password = 'Enter your password';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const user = await login(values.email.trim(), values.password);
      navigate(postLoginPath(user, query.get('next')), { replace: true });
    } catch (error) {
      setFormError(error.message);
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Sign in"
      subtitle="Use your campus account. You'll be taken to the view for your role."
      footer={<>New to the campus portal? <Link to="/register">Create a student account</Link></>}
    >
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <form className="form-stack" onSubmit={submit} noValidate>
        <TextField id="login-email" type="email" label="Email" autoComplete="username" autoFocus
          value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} error={errors.email} />
        <TextField id="login-password" type="password" label="Password" autoComplete="current-password"
          value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} error={errors.password} />
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { navigate } = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!values.name.trim()) next.name = 'Enter your name';
    if (!EMAIL_RE.test(values.email.trim())) next.email = 'Enter a valid email address';
    if (values.password.length < 8 || values.password.length > 72) next.password = 'Password must be 8-72 characters';
    if (values.confirm !== values.password) next.confirm = 'Passwords do not match';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const user = await register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      navigate(homePathFor(user), { replace: true });
    } catch (error) {
      setErrors(error.fieldErrors ?? {});
      setFormError(error.message);
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Create account"
      subtitle="Self-registration creates a student account. Staff roles are assigned by campus administration."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        <TextField id="reg-name" label="Full name" autoComplete="name" autoFocus maxLength={120}
          value={values.name} onChange={set('name')} error={errors.name} />
        <TextField id="reg-email" type="email" label="Email" autoComplete="email"
          value={values.email} onChange={set('email')} error={errors.email} />
        <TextField id="reg-password" type="password" label="Password" autoComplete="new-password" hint="8-72 characters"
          value={values.password} onChange={set('password')} error={errors.password} />
        <TextField id="reg-confirm" type="password" label="Confirm password" autoComplete="new-password"
          value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthFrame>
  );
}
