import { useState } from 'react';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';

const BLANK = { name: '', address: '', phone: '', openTime: '10:00', closeTime: '17:00', slotMinutes: 30, slotCapacity: 3, dailyTokenLimit: 300 };

function OfficeForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...initial, phone: initial.phone || '' } : BLANK);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const body = { ...f, slotMinutes: Number(f.slotMinutes), slotCapacity: Number(f.slotCapacity), dailyTokenLimit: Number(f.dailyTokenLimit) };
    try { if (initial) await api.put(`/admin/offices/${initial.id}`, body); else await api.post('/admin/offices', body); onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial ? 'Edit office' : 'Add office'} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Alert>{error}</Alert></div>
        <div className="sm:col-span-2"><Field label="Office name"><input className="input" required minLength={3} value={f.name} onChange={set('name')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Address"><input className="input" required minLength={5} value={f.address} onChange={set('address')} /></Field></div>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <span />
        <Field label="Opening time"><input type="time" className="input" required value={f.openTime} onChange={set('openTime')} /></Field>
        <Field label="Closing time"><input type="time" className="input" required value={f.closeTime} onChange={set('closeTime')} /></Field>
        <Field label="Appointment slot length (minutes)"><input type="number" min={5} max={120} className="input" required value={f.slotMinutes} onChange={set('slotMinutes')} /></Field>
        <Field label="People allowed per slot (per service)"><input type="number" min={1} className="input" required value={f.slotCapacity} onChange={set('slotCapacity')} /></Field>
        <Field label="Daily token limit (whole office)"><input type="number" min={1} className="input" required value={f.dailyTokenLimit} onChange={set('dailyTokenLimit')} /></Field>
        <div className="flex items-end justify-end gap-2 sm:col-span-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save office'}</button></div>
      </form>
    </Modal>
  );
}

function OfficeCard({ office, allServices, reload, setMsg }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [depName, setDepName] = useState('');
  const [rename, setRename] = useState(null);
  const [svc, setSvc] = useState({ serviceId: '', departmentId: '', dailyLimit: 100 });
  const [confirm, setConfirm] = useState(null);

  const act = async (fn, ok) => { try { await fn(); setMsg({ type: 'success', text: ok }); reload(); } catch (e) { setMsg({ type: 'error', text: e.message }); } };
  const offeredIds = new Set(office.officeServices.map((o) => o.serviceId));

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{office.name} {!office.isActive && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>}</h2>
          <p className="text-sm text-slate-600">{office.address}</p>
          <p className="text-xs text-slate-500">{office.openTime} - {office.closeTime} | {office.slotMinutes}-min slots x {office.slotCapacity} people | limit {office.dailyTokenLimit}/day</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline btn-sm" onClick={() => setEdit(true)}>Edit</button>
          <button className="btn-outline btn-sm" onClick={() => setConfirm({ title: office.isActive ? 'Deactivate office?' : 'Activate office?', message: office.isActive ? 'Citizens will no longer see or book this office.' : 'The office becomes visible to citizens again.', run: () => act(() => api.patch(`/admin/offices/${office.id}/active`, { isActive: !office.isActive }), 'Office updated.') })}>{office.isActive ? 'Deactivate' : 'Activate'}</button>
          <button className="btn-primary btn-sm" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'Departments and services'}</button>
        </div>
      </div>

      {open && (
        <div className="mt-5 grid gap-6 border-t border-slate-100 pt-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-bold">Departments</h3>
            <ul className="mb-3 space-y-2">
              {office.departments.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {rename?.id === d.id ? (
                    <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); act(() => api.put(`/admin/departments/${d.id}`, { name: rename.name }), 'Department renamed.'); setRename(null); }}>
                      <input className="input py-1" value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} required minLength={2} /><button className="btn-primary btn-sm">Save</button>
                    </form>
                  ) : <span>{d.name}</span>}
                  <span className="flex gap-2">
                    <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setRename({ id: d.id, name: d.name })}>Rename</button>
                    <button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setConfirm({ title: 'Delete department?', message: `Delete "${d.name}"? This only works if no service or officer uses it.`, run: () => act(() => api.del(`/admin/departments/${d.id}`), 'Department deleted.') })}>Delete</button>
                  </span>
                </li>
              ))}
              {office.departments.length === 0 && <p className="text-sm text-slate-500">No departments yet.</p>}
            </ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => api.post('/admin/departments', { officeId: office.id, name: depName }), 'Department added.'); setDepName(''); }}>
              <input className="input" placeholder="New department name" required minLength={2} value={depName} onChange={(e) => setDepName(e.target.value)} /><button className="btn-primary">Add</button>
            </form>
          </div>

          <div>
            <h3 className="mb-2 font-bold">Services offered here</h3>
            <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr><th className="th">Service</th><th className="th">Department</th><th className="th">Limit/day</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {office.officeServices.map((o) => (
                    <tr key={o.id}>
                      <td className="td">{o.service.name}{!o.service.isActive && <span className="ml-1 text-xs text-red-600">(service inactive)</span>}</td><td className="td">{o.department?.name || '-'}</td><td className="td">{o.dailyLimit}</td>
                      <td className="td"><button className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`} onClick={() => act(() => api.put('/admin/office-services', { officeId: office.id, serviceId: o.serviceId, departmentId: o.departmentId, isAvailable: !o.isAvailable, dailyLimit: o.dailyLimit }), 'Availability changed.')}>{o.isAvailable ? 'Available' : 'Paused'}</button></td>
                      <td className="td"><button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setConfirm({ title: 'Remove service from office?', message: `${o.service.name} will no longer be offered at this office.`, run: () => act(() => api.del(`/admin/office-services/${o.id}`), 'Service removed from office.') })}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {office.officeServices.length === 0 && <p className="p-3 text-sm text-slate-500">No services offered yet.</p>}
            </div>
            <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); act(() => api.put('/admin/office-services', { officeId: office.id, serviceId: Number(svc.serviceId), departmentId: Number(svc.departmentId), dailyLimit: Number(svc.dailyLimit) }), 'Service saved for this office.'); setSvc({ serviceId: '', departmentId: '', dailyLimit: 100 }); }}>
              <select className="input sm:col-span-2" required value={svc.serviceId} onChange={(e) => setSvc({ ...svc, serviceId: e.target.value })}>
                <option value="">Add a service...</option>{allServices.filter((s) => !offeredIds.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input" required value={svc.departmentId} onChange={(e) => setSvc({ ...svc, departmentId: e.target.value })}>
                <option value="">Department</option>{office.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input className="input" type="number" min={1} required aria-label="Daily limit" title="Daily token limit" value={svc.dailyLimit} onChange={(e) => setSvc({ ...svc, dailyLimit: e.target.value })} />
              <button className="btn-primary sm:col-span-4">Offer service at this office</button>
            </form>
          </div>
        </div>
      )}
      {edit && <OfficeForm initial={office} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); setMsg({ type: 'success', text: 'Office saved.' }); reload(); }} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} danger onConfirm={() => { confirm.run(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

export default function ManageOffices() {
  const { data, error, loading, reload } = usePolling(() => api.get('/admin/offices'), 0);
  const services = usePolling(() => api.get('/admin/services'), 0);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  return (
    <div>
      <PageHeader title="Manage offices" subtitle="Offices, working hours, appointment slots, departments and the services each office offers" actions={<button className="btn-primary" onClick={() => setAdding(true)}>Add office</button>} />
      <div className="mb-4 space-y-3"><Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert><Alert>{error}</Alert></div>
      {loading && <Spinner />}
      {data && data.offices.length === 0 && <EmptyState title="No offices yet" />}
      <div className="space-y-4">{data?.offices.map((o) => <OfficeCard key={o.id} office={o} allServices={services.data?.services || []} reload={reload} setMsg={setMsg} />)}</div>
      {adding && <OfficeForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setMsg({ type: 'success', text: 'Office added. Now add departments and services to it.' }); reload(); }} />}
    </div>
  );
}
