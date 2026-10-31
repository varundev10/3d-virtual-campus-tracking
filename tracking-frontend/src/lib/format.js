export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function timeAgo(value) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (Number.isNaN(seconds)) return String(value);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return formatDate(value);
}

export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

export function titleCase(value) {
  if (!value) return '';
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isoDate(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function daysAgo(days) {
  return isoDate(Date.now() - days * 86_400_000);
}

export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// "10:00:00" -> "10:00"
export function formatClock(value) {
  return value ? String(value).slice(0, 5) : '—';
}

export function formatPercent(value) {
  return `${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}
