import { useState } from 'react';
import { SelectField, TextField } from '../../components/ui/Field.jsx';
import Icon from '../../components/ui/Icon.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import LazyCampusScene from '../../components/LazyCampusScene.jsx';
import Marquee from '../../components/fx/Marquee.jsx';
import Motif from '../../components/fx/Motif.jsx';
import Scramble from '../../components/fx/Scramble.jsx';
import SplitText from '../../components/fx/SplitText.jsx';
import TextBadge from '../../components/fx/TextBadge.jsx';
import { api } from '../../lib/api.js';
import { homePathFor, isAdmin, useAuth } from '../../lib/auth.jsx';
import { Link, useRouter } from '../../lib/router.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { UCER_CENTER } from '../../lib/campus.js';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import { useQuality } from '../../lib/quality.js';
import { useSceneMode } from '../../lib/sceneMode.js';
import { isWebGLAvailable } from '../../scene/webgl.js';
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

// The campus, turning slowly in a frame: in the plate beside the form on wide screens, at the bottom of the page on
// narrow ones. Decorative, so it is left out without WebGL and on devices the quality setting already treats as weak;
// for visitors who prefer reduced motion the same model is shown, but it does not turn.
function CampusViewport({ compact = false }) {
  const [mode] = useSceneMode();
  return (
    <figure className={`auth-viewport${compact ? ' is-compact' : ''}`}>
      <LazyCampusScene showcase showControls={false} mode={mode} label="The campus as a 3D model, turning slowly" />
      <figcaption className="viewport-readout">
        <span>UCER Prayagraj</span>
        <span className="mono">{UCER_CENTER.lat.toFixed(4)}°N {UCER_CENTER.lng.toFixed(4)}°E</span>
      </figcaption>
    </figure>
  );
}

// Everything the ticker says is already said on this page or by the product: nothing is invented.
const MARQUEE_ITEMS = [
  'Explore the 3D campus',
  'Find buildings, labs and the library',
  'Location shared only with your consent',
  'Only on campus',
  'UCER Prayagraj',
];

function AuthFrame({ title, subtitle, children, footer }) {
  useDocumentTitle(title);
  const wide = useMediaQuery('(min-width: 921px)');
  const [webgl] = useState(isWebGLAvailable);
  const [quality] = useQuality();
  const showCampus = webgl && quality !== 'low';
  return (
    <div className="auth-page">
      <section className="auth-aside contours" aria-hidden="true">
        <div className="brand-lockup">
          <span className="brand-mark">UC</span>
          <div>
            <strong className="brand-name">UCER Smart Campus</strong>
            <p>3D virtual campus &amp; tracking</p>
          </div>
        </div>
        <div className="auth-hero">
          <div className="auth-kicker"><Motif size={14} /><Scramble text="UCER Prayagraj · 3D campus" /></div>
          <SplitText as="h2" text={'Your campus, in\nthree dimensions.'} mark="three" />
          <p>Every building, lab and the library on the UCER campus, and your location shared only when you choose to.</p>
        </div>
        {wide && showCampus && <CampusViewport />}
        <ul className="auth-points">
          <li><Icon name="cube" /> Explore a 3D model of the campus</li>
          <li><Icon name="search" /> Find buildings, labs and the library</li>
          <li><Icon name="shield" /> Location is shared only with your consent, and only on campus</li>
        </ul>
        <Marquee items={MARQUEE_ITEMS} tone="brand" label="UCER Smart Campus" />
      </section>
      <main className="auth-main" id="main">
        {wide && <TextBadge className="auth-badge" text={'Explore\u00A0\u2022\u00A0UCER\u00A0\u2022\u00A0Campus\u00A0\u2022\u00A0'} />}
        <ThemeToggle className="auth-theme" />
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
      {!wide && showCampus && <CampusViewport compact />}
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
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '', departmentId: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  // Public list; if it cannot load, registration still works and an admin assigns the department later.
  const departments = useAsync(() => api.getDepartments().catch(() => []), []);

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
      const user = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        ...(values.departmentId ? { departmentId: Number(values.departmentId) } : {}),
      });
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
        {(departments.data ?? []).length > 0 && (
          <SelectField id="reg-dept" label="Department" value={values.departmentId} onChange={set('departmentId')} error={errors.departmentId}
            hint="Sets which timetable your attendance is tracked against.">
            <option value="">Choose later</option>
            {departments.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        )}
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
