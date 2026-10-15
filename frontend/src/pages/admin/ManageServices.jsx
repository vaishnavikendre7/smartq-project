import { useState } from 'react';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';

function ServiceForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...initial, description: initial.description || '' } : { name: '', code: '', description: '', avgMinutes: 10 });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const body = { name: f.name, code: f.code, description: f.description, avgMinutes: Number(f.avgMinutes) };
    try { if (initial) await api.put(`/admin/services/${initial.id}`, body); else await api.post('/admin/services', body); onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial ? 'Edit service' : 'Add service'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Alert>{error}</Alert>
        <Field label="Service name"><input className="input" required minLength={3} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Token code" hint="2 to 5 capital letters used in token numbers, e.g. INC gives INC-001"><input className="input uppercase" required minLength={2} maxLength={5} pattern="[A-Za-z]{2,5}" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Average minutes per person" hint="Used for the waiting-time estimate until real data exists"><input type="number" min={1} max={240} className="input" required value={f.avgMinutes} onChange={(e) => setF({ ...f, avgMinutes: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows={3} maxLength={2000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save service'}</button></div>
      </form>
    </Modal>
  );
}

function Checklist({ service, reload, setMsg }) {
  const [name, setName] = useState('');
  const add = async (e) => {
    e.preventDefault();
    try { await api.post(`/admin/services/${service.id}/documents`, { name }); setName(''); reload(); } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  const del = async (id) => { try { await api.del(`/admin/documents/${id}`); reload(); } catch (err) { setMsg({ type: 'error', text: err.message }); } };
  return (
    <div>
      <ul className="mb-3 space-y-1">
        {service.documents.map((d) => <li key={d.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5 text-sm">{d.name}<button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => del(d.id)}>Remove</button></li>)}
        {service.documents.length === 0 && <li className="text-sm text-slate-500">No documents in the checklist yet.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={add}><input className="input" required minLength={2} placeholder="Add required document" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary">Add</button></form>
    </div>
  );
}

export default function ManageServices() {
  const { data, error, loading, reload } = usePolling(() => api.get('/admin/services'), 0);
  const [form, setForm] = useState(null);       // null | 'new' | service
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const toggle = async (s) => {
    try { await api.patch(`/admin/services/${s.id}/active`, { isActive: !s.isActive }); setMsg({ type: 'success', text: `${s.name} ${s.isActive ? 'deactivated' : 'activated'}.` }); reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };
  return (
    <div>
      <PageHeader title="Manage services" subtitle="Document services and their required-document checklists" actions={<button className="btn-primary" onClick={() => setForm('new')}>Add service</button>} />
      <div className="mb-4 space-y-3"><Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert><Alert>{error}</Alert></div>
      {loading && <Spinner />}
      {data && data.services.length === 0 && <EmptyState title="No services yet" />}
      <div className="space-y-3">
        {data?.services.map((s) => (
          <div key={s.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{s.name} <span className="ml-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-800">{s.code}</span> {!s.isActive && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Inactive</span>}</h2>
                <p className="text-sm text-slate-600">{s.description || 'No description'}</p>
                <p className="text-xs text-slate-500">About {s.avgMinutes} min per person | {s.documents.length} required documents</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline btn-sm" onClick={() => setForm(s)}>Edit</button>
                <button className="btn-outline btn-sm" onClick={() => toggle(s)}>{s.isActive ? 'Deactivate' : 'Activate'}</button>
                <button className="btn-primary btn-sm" onClick={() => setOpenId(openId === s.id ? null : s.id)}>{openId === s.id ? 'Hide checklist' : 'Checklist'}</button>
              </div>
            </div>
            {openId === s.id && <div className="mt-4 border-t border-slate-100 pt-4"><Checklist service={s} reload={reload} setMsg={setMsg} /></div>}
          </div>
        ))}
      </div>
      {form && <ServiceForm initial={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); setMsg({ type: 'success', text: 'Service saved. Add it to an office from the Offices page.' }); reload(); }} />}
    </div>
  );
}
