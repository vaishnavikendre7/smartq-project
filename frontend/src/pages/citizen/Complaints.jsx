import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, Field, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { fmtDateTime } from '../../lib/format.js';

export default function Complaints() {
  const { data, error, loading, reload } = usePolling(() => api.get('/citizen/complaints'), 15000);
  const offices = usePolling(() => api.get('/public/offices'), 0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ officeId: '', subject: '', description: '' });
  const [formError, setFormError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setFormError('');
    try {
      const r = await api.post('/citizen/complaints', { ...form, officeId: form.officeId ? Number(form.officeId) : undefined });
      setOpen(false); setForm({ officeId: '', subject: '', description: '' }); setOk(`Complaint registered. Your Complaint ID is ${r.complaint.complaintCode}.`); reload();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="My complaints" subtitle="Report a problem and follow the response" actions={<button className="btn-primary" onClick={() => setOpen(true)}>New complaint</button>} />
      <div className="space-y-3">
        <Alert type="success" onClose={() => setOk('')}>{ok}</Alert>
        <Alert>{error}</Alert>
      </div>
      {loading && <Spinner />}
      {data && data.complaints.length === 0 && <div className="mt-3"><EmptyState title="You have no complaints" /></div>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {data?.complaints.map((c) => (
          <Link key={c.id} to={`/citizen/complaints/${c.id}`} className="card hover:border-brand-500">
            <div className="flex items-start justify-between gap-2"><h2 className="font-bold">{c.subject}</h2><StatusBadge kind="complaint" status={c.status} /></div>
            <p className="mt-1 text-sm font-semibold text-brand-800">{c.complaintCode}</p>
            <p className="text-xs text-slate-500">{c.office || 'General'} | {fmtDateTime(c.createdAt)}</p>
          </Link>
        ))}
      </div>
      {open && (
        <Modal title="New complaint" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Alert>{formError}</Alert>
            <Field label="Office (optional)">
              <select className="input" value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })}>
                <option value="">Not about a specific office</option>{offices.data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Subject"><input className="input" required minLength={5} maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Describe the problem"><textarea className="input" rows={4} required minLength={10} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Sending...' : 'Submit complaint'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
