import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui.jsx';
import { fmtDateTime } from '../../lib/format.js';

export default function Logs() {
  const { data, error, loading } = usePolling(() => api.get('/admin/logs?limit=200'), 20000);
  return (
    <div>
      <PageHeader title="System activity log" subtitle="The latest 200 important actions" />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.logs.length === 0 && <EmptyState title="No activity yet" />}
      {data && data.logs.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="th">Time</th><th className="th">User</th><th className="th">Action</th><th className="th">Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.logs.map((l) => <tr key={l.id}><td className="td whitespace-nowrap">{fmtDateTime(l.createdAt)}</td><td className="td">{l.user}</td><td className="td font-mono text-xs">{l.action}</td><td className="td">{l.details}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
