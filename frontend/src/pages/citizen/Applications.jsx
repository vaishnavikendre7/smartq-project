import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { POLL_MS, fmtDateTime } from '../../lib/format.js';

export default function Applications() {
  const { data, error, loading } = usePolling(() => api.get('/citizen/applications'), POLL_MS);
  return (
    <div>
      <PageHeader title="My applications" subtitle="Document applications and their progress" actions={<Link to="/citizen/applications/new" className="btn-primary">New application</Link>} />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.applications.length === 0 && <EmptyState title="You have not submitted any application" action={<Link to="/citizen/applications/new" className="btn-primary">Submit an application</Link>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.applications.map((a) => (
          <Link key={a.id} to={`/citizen/applications/${a.id}`} className="card hover:border-brand-500">
            <div className="flex items-start justify-between gap-2"><h2 className="font-bold">{a.service.name}</h2><StatusBadge kind="app" status={a.status} /></div>
            <p className="mt-1 text-sm font-semibold text-brand-800">{a.applicationCode}</p>
            <p className="text-sm text-slate-500">{a.office.name}</p>
            <p className="mt-1 text-xs text-slate-400">Submitted {fmtDateTime(a.createdAt)} | Updated {fmtDateTime(a.updatedAt)}</p>
            {a.remark && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">Latest note: {a.remark}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
