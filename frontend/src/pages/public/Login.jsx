import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Field } from '../../components/ui.jsx';
import { dashboardPath } from '../../lib/format.js';

const ROLES = [
  { value: 'CITIZEN', label: 'Citizen' },
  { value: 'OFFICER', label: 'Officer' },
  { value: 'ADMIN', label: 'Admin' }
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('CITIZEN');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const user = await login(form.email, form.password, role);
      const wanted = location.state?.from;
      navigate(wanted && wanted.startsWith(dashboardPath(user.role)) ? wanted : dashboardPath(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Choose your role, then enter your email and password.</p>
        <form onSubmit={submit} className="space-y-4">
          <Alert>{error}</Alert>

          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setRole(r.value); setError(''); }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  role === r.value
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Field label="Email"><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in...' : `Log in as ${ROLES.find((r) => r.value === role).label}`}</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">New citizen? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link></p>
      </div>
    </div>
  );
}