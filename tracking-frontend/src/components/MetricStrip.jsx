// Compact row of live status values, e.g. [{ label: 'WebSocket', value: 'connected' }].
export default function MetricStrip({ items, label = 'Campus status metrics' }) {
  return (
    <section className="metric-strip" aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className="metric">
          <span>{item.label}</span>
          <strong className={item.tone ? `tone-${item.tone}` : undefined}>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
