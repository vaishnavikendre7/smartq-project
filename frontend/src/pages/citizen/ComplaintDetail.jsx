import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { fmtDateTime } from '../../lib/format.js';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { data, error, loading } = usePolling(() => api.get(`/citizen/complaints/${id}`), 15000, [id]);
  if (loading) return <Spinner />;
  if (error && !data) return <div><Alert>{error}</Alert><Link to="/citizen/complaints" className="mt-4 inline-block text-brand-700 underline">Back</Link></div>;
  const c = data.complaint;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/citizen/complaints" className="text-sm text-brand-700 hover:underline">&larr; My complaints</Link>
      <PageHeader title={c.subject} subtitle={`Complaint ID: ${c.complaintCode}`} actions={<StatusBadge kind="complaint" status={c.status} />} />
      <div className="space-y-4">
        <div className="card"><p className="text-xs text-slate-500">{c.office || 'General'} | {fmtDateTime(c.createdAt)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{c.description}</p></div>
        <h2 className="font-bold">Responses</h2>
        {c.responses.length === 0 && <p className="text-sm text-slate-500">No response yet. We will notify you when there is one.</p>}
        {c.responses.map((r) => (
          <div key={r.id} className="card border-l-4 border-l-brand-600">
            <p className="text-xs text-slate-500">{r.by} | {fmtDateTime(r.at)}</p><p className="mt-1 text-sm">{r.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
