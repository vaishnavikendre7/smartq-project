import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, Field, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { COMPLAINT_LABEL, fmtDateTime } from '../../lib/format.js';

export default function StaffComplaintDetail({ base }) {
  const { id } = useParams();
  const { data, error, loading, reload } = usePolling(() => api.get(`/staff/complaints/${id}`), 0, [id]);
  const [form, setForm] = useState({ message: '', status: 'IN_PROGRESS' });
  const [msg, setMsg] = useState({ type: 'error', text: '' });

  const send = async (e) => {
    e.preventDefault();
    try { await api.post(`/staff/complaints/${id}/respond`, form); setForm({ ...form, message: '' }); setMsg({ type: 'success', text: 'Response sent to the citizen.' }); reload(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  if (loading) return <Spinner />;
  if (error && !data) return <div><Alert>{error}</Alert><Link to={base} className="mt-4 inline-block text-brand-700 underline">Back</Link></div>;
  const c = data.complaint;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to={base} className="text-sm text-brand-700 hover:underline">&larr; Complaints</Link>
      <PageHeader title={c.subject} subtitle={`${c.complaintCode} | ${c.office || 'General'}`} actions={<StatusBadge kind="complaint" status={c.status} />} />
      <div className="space-y-4">
        <div className="card text-sm"><p className="text-xs text-slate-500">{c.citizen.name} | {c.citizen.phone} | {fmtDateTime(c.createdAt)}</p><p className="mt-2 whitespace-pre-wrap">{c.description}</p></div>
        {c.responses.map((r) => <div key={r.id} className="card border-l-4 border-l-brand-600 text-sm"><p className="text-xs text-slate-500">{r.by} | {fmtDateTime(r.at)}</p><p className="mt-1">{r.message}</p></div>)}
        <form onSubmit={send} className="card space-y-3">
          <h2 className="font-bold">Respond</h2>
          <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
          <Field label="Message"><textarea className="input" rows={3} required minLength={3} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <Field label="Set status">
            <select className="input max-w-xs" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(COMPLAINT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <button className="btn-primary">Send response</button>
        </form>
      </div>
    </div>
  );
}
