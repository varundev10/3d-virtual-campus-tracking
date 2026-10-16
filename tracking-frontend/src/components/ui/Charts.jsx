import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatNumber } from '../../lib/format.js';

function niceMax(value) {
  if (value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * exponent;
}

function DataTable({ rows, labelHeader, valueHeader }) {
  return (
    <table className="data-table compact">
      <thead>
        <tr><th scope="col">{labelHeader}</th><th scope="col" className="num">{valueHeader}</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}><td>{row.label}</td><td className="num">{formatNumber(row.value)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartCard({ title, subtitle, rows, labelHeader, valueHeader, empty, children }) {
  const [showTable, setShowTable] = useState(false);
  const hasData = rows.some((row) => row.value > 0);
  return (
    <section className="card chart-card">
      <header className="card-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {hasData && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            <Icon name={showTable ? 'chart' : 'table'} size={16} /> {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </header>
      {!hasData ? (
        <p className="chart-empty">{empty}</p>
      ) : showTable ? (
        <DataTable rows={rows} labelHeader={labelHeader} valueHeader={valueHeader} />
      ) : children}
    </section>
  );
}

// Single-series column chart (e.g. pings per day). One hue, no legend: the card title names the series.
export function ColumnChart({ rows, valueLabel }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const [width, setWidth] = useState(640);

  // Render at the container's real pixel width so text stays at its intended size.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const height = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 40 };
  const max = niceMax(Math.max(...rows.map((r) => r.value)));
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const band = plotW / rows.length;
  const barW = Math.min(24, band * 0.7);
  // Counts are whole numbers, so only show a midpoint tick when it is one.
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const labelEvery = Math.ceil(rows.length / Math.max(2, Math.floor(plotW / 70)));

  return (
    <div className="column-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${valueLabel} column chart`}>
        {ticks.map((t) => {
          const y = pad.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="chart-tick">{formatNumber(t)}</text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const h = (row.value / max) * plotH;
          const x = pad.left + i * band + (band - barW) / 2;
          const y = pad.top + plotH - h;
          const r = Math.min(4, h);
          return (
            <g key={row.label}>
              {h > 0 && (
                <path
                  className="chart-bar"
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                />
              )}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={plotH}
                className="chart-hit"
                onMouseEnter={() => setHover({ i, x: pad.left + i * band + band / 2, y })}
              />
              {i % labelEvery === 0 && (
                <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle" className="chart-tick">{row.short ?? row.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: `${(hover.x / width) * 100}%`, top: `${(hover.y / height) * 100}%` }}>
          <strong>{formatNumber(rows[hover.i].value)}</strong> {valueLabel}
          <span>{rows[hover.i].label}</span>
        </div>
      )}
    </div>
  );
}

// Horizontal bars for a categorical breakdown; every bar carries its label and value as text.
export function BarList({ rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="bar-list">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${formatNumber(row.value)}`}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </span>
          <span className="bar-value">{formatNumber(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}
