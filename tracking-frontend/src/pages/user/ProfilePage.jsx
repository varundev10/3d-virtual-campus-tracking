import { AccountSummary, ChangePasswordForm, ProfileNameForm } from '../../components/AccountForms.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { titleCase } from '../../lib/format.js';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="page-stack narrow">
      <h1 className="page-title">My profile</h1>
      <section className="id-card" aria-labelledby="acct-title">
        <div className="id-card-head is-cobalt contours">
          <span className="id-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          <div className="id-who">
            <h2 id="acct-title">{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <span className={`badge badge-role-${user.role.toLowerCase()}`}>{titleCase(user.role)}</span>
        </div>
        <div className="id-card-body">
          <AccountSummary user={user} brief />
          <p className="muted small">Your role is managed by campus administration.</p>
        </div>
      </section>
      <div className="grid-2">
        <section className="card" aria-labelledby="name-title">
          <header className="card-header"><h2 id="name-title">Edit profile</h2></header>
          <ProfileNameForm />
        </section>
        <section className="card" aria-labelledby="pw-title">
          <header className="card-header"><h2 id="pw-title">Change password</h2></header>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
