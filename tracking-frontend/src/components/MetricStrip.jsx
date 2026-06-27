const labels = {
  idle: 'Idle',
  requesting: 'Requesting',
  tracking: 'Tracking',
  outside: 'Outside',
  blocked: 'Blocked',
};

export default function MetricStrip({
  visibleCount,
  socketState,
  backendState,
  trackingState,
  attendanceCount,
}) {
  return (
    <section className="metric-strip" aria-label="Campus status metrics">
      <div className="metric">
        <span>Visible users</span>
        <strong>{visibleCount}</strong>
      </div>
      <div className="metric">
        <span>WebSocket</span>
        <strong>{socketState}</strong>
      </div>
      <div className="metric">
        <span>Backend</span>
        <strong>{backendState}</strong>
      </div>
      <div className="metric">
        <span>GPS</span>
        <strong>{labels[trackingState] ?? trackingState}</strong>
      </div>
      <div className="metric">
        <span>Attendance rows</span>
        <strong>{attendanceCount}</strong>
      </div>
    </section>
  );
}
