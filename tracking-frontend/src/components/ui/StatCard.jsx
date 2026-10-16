import Icon from './Icon.jsx';

export default function StatCard({ icon, label, value, hint }) {
  return (
    <article className="stat-card">
      <div className="stat-card-head">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon"><Icon name={icon} size={18} /></span>}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <p className="stat-hint">{hint}</p>}
    </article>
  );
}
