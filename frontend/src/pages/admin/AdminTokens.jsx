import { useState } from 'react';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { POLL_MS, TOKEN_LABEL, fmtTime, todayIST } from '../../lib/format.js';

export default function AdminTokens() {
  const [f, setF] = useState({ date: todayIST(), officeId: '', serviceId: '', status: '' });
  const q = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
  const { data, error, loading } = usePolling(() => api.get(`/admin/tokens?${q}`), POLL_MS, [q]);
  const offices = usePolling(() => api.get('/admin/offices'), 0);
  const services = usePolling(() => api.get('/admin/services'), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <PageHeader title="Token queues" subtitle={`Monitor every token. Refreshes every ${POLL_MS / 1000} seconds`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" className="input max-w-44" aria-label="Date" value={f.date} onChange={set('date')} />
        <select className="input max-w-64" aria-label="Office" value={f.officeId} onChange={set('officeId')}><option value="">All offices</option>{offices.data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <select className="input max-w-64" aria-label="Service" value={f.serviceId} onChange={set('serviceId')}><option value="">All services</option>{services.data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input max-w-44" aria-label="Status" value={f.status} onChange={set('status')}><option value="">All statuses</option>{Object.entries(TOKEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.tokens.length === 0 && <EmptyState title="No tokens match these filters" />}
      {data && data.tokens.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="th">Token</th><th className="th">Citizen</th><th className="th">Service</th><th className="th">Office</th><th className="th">Slot</th><th className="th">Officer</th><th className="th">Called</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.tokens.map((t) => (
                <tr key={t.id}><td className="td font-bold">{t.tokenNumber}{t.isVerified && <span className="ml-1 text-xs text-emerald-700">verified</span>}</td><td className="td">{t.citizen}</td><td className="td">{t.service}</td><td className="td">{t.office}</td>
                  <td className="td">{t.slotTime || 'Virtual'}</td><td className="td">{t.officer || '-'}</td><td className="td">{fmtTime(t.calledAt)}</td><td className="td"><StatusBadge status={t.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
