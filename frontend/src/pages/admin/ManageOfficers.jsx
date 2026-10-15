import { useState } from 'react';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';

function OfficerForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { name: initial.name, phone: initial.phone, isActive: initial.isActive, canHandleComplaints: initial.canHandleComplaints, password: '' }
    : { name: '', email: '', phone: '', password: '', canHandleComplaints: false });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { if (initial) await api.patch(`/admin/officers/${initial.id}`, f); else await api.post('/admin/officers', f); onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial ? 'Edit officer' : 'Create officer account'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Alert>{error}</Alert>
        <Field label="Full name"><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {!initial && <Field label="Email (used to log in)"><input type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>}
        <Field label="Mobile number"><input className="input" required pattern="[6-9][0-9]{9}" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label={initial ? 'New password (leave empty to keep the old one)' : 'Password'} hint="At least 8 characters with letters and numbers"><input type="password" className="input" required={!initial} minLength={initial ? undefined : 8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.canHandleComplaints} onChange={(e) => setF({ ...f, canHandleComplaints: e.target.checked })} />Allow this officer to respond to complaints of their office</label>
        {initial && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Account is active</label>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

function AssignForm({ officer, offices, onClose, onSaved }) {
  const [officeId, setOfficeId] = useState(''); const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const office = offices.find((o) => String(o.id) === officeId);
  const save = async (e) => {
    e.preventDefault();
    try { await api.post(`/admin/officers/${officer.id}/assignments`, { officeId: Number(officeId), departmentId: Number(departmentId) }); onSaved(); }
    catch (err) { setError(err.message); }
  };
  return (
    <Modal title={`Assign ${officer.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Alert>{error}</Alert>
        <Field label="Office"><select className="input" required value={officeId} onChange={(e) => { setOfficeId(e.target.value); setDepartmentId(''); }}><option value="">Select office</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Department" hint="The officer will handle the queues of every service in this department"><select className="input" required disabled={!office} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Select department</option>{office?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary">Assign</button></div>
      </form>
    </Modal>
  );
}

export default function ManageOfficers() {
  const { data, error, loading, reload } = usePolling(() => api.get('/admin/officers'), 0);
  const offices = usePolling(() => api.get('/admin/offices'), 0);
  const [modal, setModal] = useState(null); // { type: 'create' | 'edit' | 'assign', officer }
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const done = (text) => { setModal(null); setMsg({ type: 'success', text }); reload(); };

  return (
    <div>
      <PageHeader title="Manage officers" subtitle="Only administrators can create officer accounts and assign them to offices" actions={<button className="btn-primary" onClick={() => setModal({ type: 'create' })}>Create officer</button>} />
      <div className="mb-4 space-y-3"><Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert><Alert>{error}</Alert></div>
      {loading && <Spinner />}
      {data && data.officers.length === 0 && <EmptyState title="No officers yet" />}
      {data && data.officers.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="th">Officer</th><th className="th">Assigned to</th><th className="th">Complaints</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.officers.map((o) => (
                <tr key={o.id}>
                  <td className="td"><p className="font-semibold">{o.name}</p><p className="text-xs text-slate-500">{o.email} | {o.phone}</p></td>
                  <td className="td">
                    <div className="flex flex-wrap gap-2">
                      {o.assignments.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-900">
                          {a.office.name} - {a.department.name}
                          <button aria-label="Remove assignment" className="font-bold text-red-600" onClick={() => setConfirm({ message: `Remove ${o.name} from ${a.department.name}?`, run: async () => { await api.del(`/admin/assignments/${a.id}`); done('Assignment removed.'); } })}>x</button>
                        </span>
                      ))}
                      {o.assignments.length === 0 && <span className="text-xs text-amber-700">Not assigned</span>}
                    </div>
                  </td>
                  <td className="td">{o.canHandleComplaints ? 'Allowed' : 'No'}</td>
                  <td className="td"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{o.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td className="td"><div className="flex gap-2"><button className="btn-outline btn-sm" onClick={() => setModal({ type: 'assign', officer: o })}>Assign</button><button className="btn-outline btn-sm" onClick={() => setModal({ type: 'edit', officer: o })}>Edit</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal?.type === 'create' && <OfficerForm onClose={() => setModal(null)} onSaved={() => done('Officer account created. Now assign them to an office and department.')} />}
      {modal?.type === 'edit' && <OfficerForm initial={modal.officer} onClose={() => setModal(null)} onSaved={() => done('Officer updated.')} />}
      {modal?.type === 'assign' && <AssignForm officer={modal.officer} offices={offices.data?.offices || []} onClose={() => setModal(null)} onSaved={() => done('Officer assigned.')} />}
      {confirm && <ConfirmDialog title="Please confirm" danger message={confirm.message} onConfirm={async () => { try { await confirm.run(); } catch (e) { setMsg({ type: 'error', text: e.message }); } setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
