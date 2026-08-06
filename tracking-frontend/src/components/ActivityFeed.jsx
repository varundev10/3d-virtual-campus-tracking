const TYPE_STYLES = {
  SYSTEM: 'text-slate-500',
  BACKEND: 'text-amber-600',
  LIVE: 'text-sky-600',
  GPS: 'text-violet-600',
  GEOFENCE: 'text-red-600',
  ATTENDANCE: 'text-emerald-600',
};

export default function ActivityFeed({ activity }) {
  return (
    <div className="flex h-full max-h-80 flex-col gap-2.5 overflow-y-auto px-4 py-3 sm:px-5">
      {activity.length === 0 && (
        <p className="text-sm text-slate-400">No activity yet.</p>
      )}
      {activity.map((item) => (
        <article key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
          <div className="min-w-0">
            <span className={`text-[11px] font-bold uppercase tracking-wide ${TYPE_STYLES[item.type] ?? 'text-slate-500'}`}>
              {item.type}
            </span>
            <p className="mt-0.5 truncate text-sm text-slate-700">{item.message}</p>
          </div>
          <time className="shrink-0 pt-0.5 text-xs text-slate-400">{item.time}</time>
        </article>
      ))}
    </div>
  );
}
