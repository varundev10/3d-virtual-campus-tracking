export default function ActivityFeed({ activity, attendance }) {
  return (
    <section className="feed-panel">
      <div className="panel-heading">
        <div>
          <h2>Live Activity</h2>
          <p>Backend events, GPS state, and attendance updates</p>
        </div>
      </div>

      <div className="feed-list">
        {activity.map((item) => (
          <article key={item.id} className="feed-item">
            <span className="feed-type">{item.type}</span>
            <p>{item.message}</p>
            <time>{item.time}</time>
          </article>
        ))}
      </div>

      <div className="attendance-list">
        <h3>Recent Attendance</h3>
        {attendance.length === 0 ? (
          <p className="empty-copy">No attendance rows loaded for the selected user.</p>
        ) : (
          attendance.slice(0, 5).map((record) => (
            <div key={record.id ?? `${record.userId}-${record.checkTime}`} className="attendance-row">
              <strong>{record.classroomId}</strong>
              <span>{record.status}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
