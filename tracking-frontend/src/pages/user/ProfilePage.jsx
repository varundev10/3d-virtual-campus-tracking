import { AccountSummary, ChangePasswordForm, ProfileNameForm } from '../../components/AccountForms.jsx';
import { useAuth } from '../../lib/auth.jsx';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="page-stack narrow">
      <h1 className="page-title">My profile</h1>
      <section className="card" aria-labelledby="acct-title">
        <header className="card-header"><h2 id="acct-title">Account</h2></header>
        <AccountSummary user={user} />
        <p className="muted small">Your role is managed by campus administration.</p>
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
