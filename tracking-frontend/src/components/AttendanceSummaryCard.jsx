import { formatNumber, formatPercent } from '../lib/format.js';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A ring that fills to the percentage, with the required percentage marked by a tick.
function Ring({ percent, required, low }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const tick = (required / 100) * 2 * Math.PI;
  return (
    <div className={`att-ring ${low ? 'is-low' : ''}`} role="img" aria-label={`${formatPercent(percent)} attendance, ${formatPercent(required)} required`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="att-ring-track" cx="60" cy="60" r={RADIUS} />
        <circle className="att-ring-fill" cx="60" cy="60" r={RADIUS}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)} />
        <line className="att-ring-tick" x1="60" y1="8" x2="60" y2="20" transform={`rotate(${(tick * 180) / Math.PI} 60 60)`} />
      </svg>
      <strong>{formatPercent(percent)}</strong>
    </div>
  );
}

// Overall and per-subject attendance against the required percentage. Each bar carries its figures as text,
// so nothing depends on colour alone.
export default function AttendanceSummaryCard({ summary, titleId = 'att-summary-title', days }) {
  const required = summary.thresholdPercent;
  const low = summary.total > 0 && summary.overallPercent < required;

  return (
    <section className="card" aria-labelledby={titleId}>
      <header className="card-header">
        <div>
          <h2 id={titleId}>Attendance</h2>
          {days && <p>Timetabled classes over the last {days} days.</p>}
        </div>
        {summary.total > 0 && (
          <span className={`badge ${low ? 'badge-status-bunked' : 'badge-good'}`}>
            {low ? `Below ${formatPercent(required)}` : `Meets ${formatPercent(required)}`}
          </span>
        )}
      </header>

      {summary.total === 0 ? (
        <p className="muted">No timetabled classes have been recorded yet. Your percentage appears after your first class.</p>
      ) : (
        <>
          <div className="att-hero">
            <Ring percent={summary.overallPercent} required={required} low={low} />
            <dl className="att-counts">
              <div><dt>Present</dt><dd>{formatNumber(summary.present)}</dd></div>
              <div><dt>Absent</dt><dd>{formatNumber(summary.absent)}</dd></div>
              <div><dt>Bunked</dt><dd>{formatNumber(summary.bunked)}</dd></div>
              <div><dt>Classes</dt><dd>{formatNumber(summary.total)}</dd></div>
            </dl>
          </div>
          {summary.subjects.length > 0 && (
            <ul className="att-meter" aria-label="Attendance by subject">
              {summary.subjects.map((s) => {
                const subjectLow = s.percent < required;
                return (
                  <li key={s.subject}>
                    <span className="att-meter-label">{s.subject}</span>
                    <span className={`att-meter-value ${subjectLow ? 'is-low' : ''}`}>
                      {formatPercent(s.percent)} <small>({s.present}/{s.total})</small>
                    </span>
                    <span className="att-meter-track">
                      <span className={`att-meter-fill ${subjectLow ? 'is-low' : ''}`} style={{ width: `${Math.max(2, s.percent)}%` }} />
                      <span className="att-meter-mark" style={{ left: `${required}%` }} title={`Required: ${formatPercent(required)}`} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
