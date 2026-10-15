import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { COMPLAINT_LABEL, fmtDateTime } from '../../lib/format.js';

export default function StaffComplaints({ base }) {
  const [status, setStatus] = useState('');
  const { data, error, loading } = usePolling(() => api.get(`/staff/complaints${status ? `?status=${status}` : ''}`), 15000, [status]);
  return (
    <div>
      <PageHeader title="Complaints" subtitle="Read and respond to citizen complaints" />
      <select className="input mb-4 max-w-52" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>{Object.entries(COMPLAINT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <Alert type={error.includes('not enabled') ? 'warn' : 'error'}>{error}</Alert>
      {loading && <Spinner />}
      {data && data.complaints.length === 0 && <EmptyState title="No complaints found" />}
      {data && data.complaints.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="th">ID</th><th className="th">Subject</th><th className="th">Citizen</th><th className="th">Office</th><th className="th">Status</th><th className="th">Date</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.complaints.map((c) => (
                <tr key={c.id}><td className="td font-bold">{c.complaintCode}</td><td className="td">{c.subject}</td><td className="td">{c.citizen}</td><td className="td">{c.office || '-'}</td>
                  <td className="td"><StatusBadge kind="complaint" status={c.status} /></td><td className="td">{fmtDateTime(c.createdAt)}</td>
                  <td className="td"><Link to={`${base}/${c.id}`} className="font-semibold text-brand-700 hover:underline">Open</Link></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
