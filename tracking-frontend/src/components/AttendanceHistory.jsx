const STATUS_STYLES = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  BUNKED: 'bg-red-100 text-red-700',
  ABSENT: 'bg-slate-200 text-slate-600',
};

export default function AttendanceHistory({ records, emptyLabel = 'No attendance recorded yet.' }) {
  if (!records.length) {
    return <p className="px-4 py-6 text-center text-sm text-slate-400 sm:px-5">{emptyLabel}</p>;
  }

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3 sm:px-5">
      {records.map((record) => (
        <div
          key={record.id ?? `${record.userId}-${record.checkTime}`}
          className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{record.classroom?.code ?? 'Unknown room'}</p>
            <p className="truncate text-xs text-slate-500">{new Date(record.checkTime).toLocaleString()}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[record.status] ?? 'bg-slate-200 text-slate-600'}`}>
            {record.status}
          </span>
        </div>
      ))}
    </div>
  );
}
