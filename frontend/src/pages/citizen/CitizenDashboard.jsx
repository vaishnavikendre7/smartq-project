import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, EmptyState, PageHeader, Spinner, StatCard, StatusBadge } from '../../components/ui.jsx';
import TokenCard from '../../components/TokenCard.jsx';
import { POLL_MS, fmtDateTime } from '../../lib/format.js';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const tokens = usePolling(() => api.get('/citizen/tokens'), POLL_MS);
  const apps = usePolling(() => api.get('/citizen/applications'), POLL_MS);
  const notes = usePolling(() => api.get('/citizen/notifications'), POLL_MS);

  const current = tokens.data?.current || [];
  const openApps = (apps.data?.applications || []).filter((a) => !['APPROVED', 'REJECTED'].includes(a.status));

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Your visits and applications at a glance"
        actions={<Link to="/citizen/book" className="btn-primary">Book a token</Link>} />
      <Alert>{tokens.error || apps.error}</Alert>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active tokens" value={current.length} tone="blue" />
        <StatCard label="Open applications" value={openApps.length} tone="amber" />
        <StatCard label="Unread notifications" value={notes.data?.unread ?? 0} tone="red" hint={<Link className="text-brand-700 underline" to="/citizen/notifications">Open notifications</Link>} />
      </div>

      <h2 className="mb-3 text-lg font-bold">Current tokens</h2>
      {tokens.loading && <Spinner />}
      {tokens.data && current.length === 0 && (
        <EmptyState title="You have no active token" text="Choose an office and a service to get your token."
          action={<Link to="/citizen/book" className="btn-primary">Book a token</Link>} />
      )}
      <div className="grid gap-4 md:grid-cols-2">{current.map((t) => <TokenCard key={t.id} token={t} />)}</div>

      <h2 className="mb-3 mt-10 text-lg font-bold">Recent applications</h2>
      {apps.data && apps.data.applications.length === 0 && (
        <EmptyState title="No applications yet" action={<Link to="/citizen/applications/new" className="btn-outline">Submit an application</Link>} />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {(apps.data?.applications || []).slice(0, 4).map((a) => (
          <Link key={a.id} to={`/citizen/applications/${a.id}`} className="card hover:border-brand-500">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{a.service.name}</p><StatusBadge kind="app" status={a.status} />
            </div>
            <p className="text-sm text-slate-500">{a.applicationCode} | {a.office.name}</p>
            <p className="text-xs text-slate-400">Updated {fmtDateTime(a.updatedAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
