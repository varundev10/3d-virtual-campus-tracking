const classrooms = ['A-204', 'B-112', 'LAB-3', 'LIB-HALL'];

export default function OperationsPanel({
  users,
  selectedUserId,
  roleView,
  trackingState,
  backendState,
  socketState,
  onSelectUser,
  onRoleView,
  onStartTracking,
  onStopTracking,
  onSeedDemoUsers,
  onMarkAttendance,
}) {
  const activeUser = users.find((user) => String(user.id) === String(selectedUserId));

  return (
    <div className="ops-panel">
      <section className="control-group">
        <div className="section-title">
          <h2>Operator</h2>
          <span>{backendState}</span>
        </div>
        <label>
          User
          <select value={selectedUserId} onChange={(event) => onSelectUser(event.target.value)}>
            <option value="">No backend users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.role}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-action" type="button" onClick={onSeedDemoUsers}>
          Create demo users
        </button>
      </section>

      <section className="control-group">
        <div className="section-title">
          <h2>Access View</h2>
          <span>{activeUser?.role ?? 'none'}</span>
        </div>
        <div className="segmented">
          {['STUDENT', 'FACULTY', 'ADMIN'].map((role) => (
            <button
              key={role}
              type="button"
              className={roleView === role ? 'active' : ''}
              onClick={() => onRoleView(role)}
            >
              {role}
            </button>
          ))}
        </div>
      </section>

      <section className="control-group">
        <div className="section-title">
          <h2>GPS Session</h2>
          <span>{trackingState}</span>
        </div>
        <div className="button-row">
          <button className="primary-action" type="button" onClick={onStartTracking}>
            Start
          </button>
          <button className="secondary-action" type="button" onClick={onStopTracking}>
            Stop
          </button>
        </div>
        <div className="connection-stack">
          <span>API: {backendState}</span>
          <span>Feed: {socketState}</span>
        </div>
      </section>

      <section className="control-group">
        <div className="section-title">
          <h2>Attendance</h2>
          <span>Manual sync</span>
        </div>
        <div className="classroom-grid">
          {classrooms.map((classroom) => (
            <button
              key={classroom}
              type="button"
              onClick={() => onMarkAttendance('PRESENT', classroom)}
            >
              {classroom}
            </button>
          ))}
        </div>
        <button
          className="danger-action"
          type="button"
          onClick={() => onMarkAttendance('BUNKED', 'A-204')}
        >
          Mark bunk A-204
        </button>
      </section>
    </div>
  );
}
