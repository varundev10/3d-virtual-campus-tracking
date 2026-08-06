import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { themeFor } from '../../lib/roleTheme.js';

export default function AppShell({ title, subtitle, statusItems = [], children }) {
  const { user, logout } = useAuth();
  const theme = themeFor(user?.role);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-400 font-black text-slate-900">
            UC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {statusItems.map((item) => (
            <span
              key={item.label}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${item.tone ?? 'bg-white/10 text-slate-200'}`}
            >
              {item.label}: {item.value}
            </span>
          ))}

          <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

          <div className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${theme.chip}`}>
              {(user?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-semibold">{user?.name}</p>
              <p className="text-[11px] text-slate-400">{theme.label}{user?.department ? ` · ${user.department.code}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 p-3 sm:p-5 lg:p-6">
        {children}
      </main>
    </div>
  );
}
