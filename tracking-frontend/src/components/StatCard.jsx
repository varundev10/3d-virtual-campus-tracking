export default function StatCard({ icon: Icon, label, value, tone = 'text-slate-900' }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {Icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100">
          <Icon size={17} className={tone} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`truncate text-base font-bold capitalize ${tone}`}>{value}</p>
      </div>
    </div>
  );
}
