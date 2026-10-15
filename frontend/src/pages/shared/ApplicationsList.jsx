import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { APP_LABEL, POLL_MS, fmtDateTime } from '../../lib/format.js';

// Used by officers (only their services) and by the administrator (everything)
export default function ApplicationsList({ role }) {
  const base = role === 'ADMIN' ? '/admin/applications' : '/officer/applications';
  const [f, setF] = useState({ status: '', officeId: '', serviceId: '' });
  const query = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
  const { data, error, loading } = usePolling(() => api.get(`${base}${query ? `?${query}` : ''}`), POLL_MS, [query, base]);
  const offices = usePolling(() => (role === 'ADMIN' ? api.get('/admin/offices') : Promise.resolve(null)), 0);
  const services = usePolling(() => (role === 'ADMIN' ? api.get('/admin/services') : Promise.resolve(null)), 0);

  return (
    <div>
      <PageHeader title="Applications" subtitle={role === 'ADMIN' ? 'All document applications in the system' : 'Applications for the services you handle'} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input max-w-52" aria-label="Filter by status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All statuses</option>{Object.entries(APP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {role === 'ADMIN' && <>
          <select className="input max-w-64" aria-label="Filter by office" value={f.officeId} onChange={(e) => setF({ ...f, officeId: e.target.value })}>
            <option value="">All offices</option>{offices.data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className="input max-w-64" aria-label="Filter by service" value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
            <option value="">All services</option>{services.data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </>}
      </div>
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.applications.length === 0 && <EmptyState title="No applications found" />}
      {data && data.applications.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="th">Application ID</th><th className="th">Citizen</th><th className="th">Service</th><th className="th">Office</th><th className="th">Status</th><th className="th">Updated</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.applications.map((a) => (
                <tr key={a.id}>
                  <td className="td font-bold">{a.applicationCode}</td><td className="td">{a.citizen?.name}</td><td className="td">{a.service.name}</td><td className="td">{a.office.name}</td>
                  <td className="td"><StatusBadge kind="app" status={a.status} /></td><td className="td">{fmtDateTime(a.updatedAt)}</td>
                  <td className="td">{role === 'OFFICER' && <Link to={`/officer/applications/${a.id}`} className="font-semibold text-brand-700 hover:underline">Open</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
