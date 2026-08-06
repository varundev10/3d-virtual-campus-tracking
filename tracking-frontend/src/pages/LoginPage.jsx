import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, LocateFixed, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth, roleHomePath } from '../context/AuthContext.jsx';

const HIGHLIGHTS = [
  { icon: LocateFixed, text: 'Live GPS positions on a photorealistic 3D campus model' },
  { icon: ShieldCheck, text: 'Geofenced tracking - nothing is recorded outside campus' },
  { icon: GraduationCap, text: 'Automated, GPS-based attendance for every classroom' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      const target = location.state?.from ?? roleHomePath(user.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row">
      <section className="relative flex-1 flex flex-col justify-between overflow-hidden px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.25),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.2),transparent_40%)]" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-400 font-black text-slate-900">
            UC
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">UCER Smart Campus</p>
            <p className="text-xs text-slate-400">Real-time GPS operations</p>
          </div>
        </div>

        <div className="relative mt-12 max-w-lg lg:mt-0">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            One live view of every student, teacher, and department.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
            Drone-mapped 3D campus, GPS-based attendance, and role-scoped dashboards for
            students, teachers, and heads of department.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-200">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon size={16} className="text-teal-300" />
                </span>
                <span className="leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-xs text-slate-500 lg:mt-0">
          UCER, Prayagraj &middot; AKTU-affiliated
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-6 py-10 text-slate-900 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use your campus account to reach your dashboard.
          </p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Email
              <span className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@ucer.edu"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Password
              <span className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                />
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-600">Demo logins (seeded on first backend run)</p>
            <p className="mt-1">Student: aarav.singh@ucer.edu / Student@1234</p>
            <p>Teacher: nisha.verma@ucer.edu / Teach@1234</p>
            <p>HOD: hod.cse@ucer.edu / Hod@1234</p>
          </div>
        </div>
      </section>
    </main>
  );
}
