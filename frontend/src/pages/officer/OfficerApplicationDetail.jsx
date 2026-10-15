import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, ConfirmDialog, Field, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import Timeline from '../../components/Timeline.jsx';
import { fmtDateTime } from '../../lib/format.js';

export default function OfficerApplicationDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = usePolling(() => api.get(`/officer/applications/${id}`), 0, [id]);
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error && !data) return <div><Alert>{error}</Alert><Link to="/officer/applications" className="mt-4 inline-block text-brand-700 underline">Back</Link></div>;
  const a = data.application;
  const final = a.nextStatuses.length === 0;
  const needsReason = status === 'REJECTED' || status === a.status;

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/officer/applications/${id}/status`, { status, remark });
      setMsg({ type: 'success', text: 'Status updated. The citizen has been notified.' }); setStatus(''); setRemark(''); await reload();
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setBusy(false); setConfirm(false); }
  };
  const label = (s) => (s === a.status ? 'Documents incomplete / need correction (stay in this step)' : a.nextStatuses.find((n) => n.value === s)?.label);

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/officer/applications" className="text-sm text-brand-700 hover:underline">&larr; Applications</Link>
      <PageHeader title={`${a.service.name} - ${a.applicationCode}`} subtitle={a.office.name} actions={<StatusBadge kind="app" status={a.status} />} />
      <div className="mb-4"><Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert></div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card"><h2 className="mb-2 font-bold">Submitted details</h2><p className="whitespace-pre-wrap text-sm">{a.details}</p></div>
          <div className="card"><h2 className="mb-5 font-bold">Progress</h2><Timeline status={a.status} history={a.history} /></div>
        </div>
        <div className="space-y-5">
          <div className="card text-sm">
            <h2 className="mb-2 font-bold">Citizen</h2>
            <p className="font-semibold">{a.citizen.name}</p><p>{a.citizen.phone}</p><p className="break-all text-slate-500">{a.citizen.email}</p>
            <p className="mt-2 text-xs text-slate-500">Submitted {fmtDateTime(a.createdAt)}</p>
          </div>
          <div className="card">
            <h2 className="mb-3 font-bold">Update status</h2>
            {final ? <p className="text-sm text-slate-500">This application is {a.statusLabel.toLowerCase()} and can no longer be changed.</p> : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setConfirm(true); }}>
                <Field label="New status">
                  <select className="input" required value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Choose...</option>{a.nextStatuses.map((n) => <option key={n.value} value={n.value}>{label(n.value)}</option>)}
                  </select>
                </Field>
                <Field label={needsReason ? 'Reason (required)' : 'Remark (optional)'}>
                  <textarea className="input" rows={3} maxLength={500} required={needsReason} value={remark} onChange={(e) => setRemark(e.target.value)} />
                </Field>
                <button className="btn-primary w-full" disabled={!status}>Save status</button>
              </form>
            )}
          </div>
          {a.otherApplications.length > 0 && (
            <div className="card text-sm">
              <h2 className="mb-2 font-bold">Citizen&apos;s other applications</h2>
              <ul className="space-y-1">{a.otherApplications.map((o) => <li key={o.applicationCode}>{o.applicationCode} - {o.service} ({o.status})</li>)}</ul>
            </div>
          )}
        </div>
      </div>
      {confirm && <ConfirmDialog title="Save this status change?" danger={status === 'REJECTED'} busy={busy} confirmText="Yes, save"
        message={`Change status to "${label(status)}"? The citizen will be notified${status === 'APPROVED' || status === 'REJECTED' ? ' and this decision cannot be undone' : ''}.`} onConfirm={save} onCancel={() => setConfirm(false)} />}
    </div>
  );
}
