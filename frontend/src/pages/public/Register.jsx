import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Field } from '../../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      navigate('/citizen', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Create citizen account</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Only your name, email, phone and a password are needed.</p>
        <form onSubmit={submit} className="space-y-4">
          <Alert>{error}</Alert>
          <Field label="Full name"><input className="input" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Mobile number" hint="10-digit Indian mobile number"><input className="input" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          <Field label="Password" hint="At least 8 characters with letters and numbers"><input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><input className="input" type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account...' : 'Register'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
      </div>
    </div>
  );
}
