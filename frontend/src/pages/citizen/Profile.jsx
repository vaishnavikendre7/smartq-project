import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Field, PageHeader } from '../../components/ui.jsx';
import { fmtDateTime } from '../../lib/format.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState({ type: 'success', text: '' });

  const saveProfile = async (e) => {
    e.preventDefault();
    try { const r = await api.patch('/auth/profile', form); setUser(r.user); setMsg({ type: 'success', text: 'Profile updated.' }); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  const savePassword = async (e) => {
    e.preventDefault();
    try { await api.patch('/auth/password', pw); setPw({ currentPassword: '', newPassword: '' }); setMsg({ type: 'success', text: 'Password changed.' }); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="My profile" subtitle={`${user.email} | member since ${fmtDateTime(user.createdAt)}`} />
      <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
      <form onSubmit={saveProfile} className="card space-y-4">
        <h2 className="font-bold">Personal details</h2>
        <Field label="Full name"><input className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Mobile number"><input className="input" required pattern="[6-9][0-9]{9}" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn-primary">Save changes</button>
      </form>
      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="font-bold">Change password</h2>
        <Field label="Current password"><input className="input" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters with letters and numbers"><input className="input" type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn-outline">Change password</button>
      </form>
    </div>
  );
}
