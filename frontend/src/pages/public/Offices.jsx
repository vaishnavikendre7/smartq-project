import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Offices() {
  const { user } = useAuth();
  const { data, error, loading } = usePolling(() => api.get('/public/offices'), 0);
  return (
    <div>
      <PageHeader title="Government offices and service centres" subtitle="Sample offices for the college demonstration" />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.offices.length === 0 && <EmptyState title="No offices available yet" text="The administrator has not added any office." />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.offices.map((o) => (
          <div key={o.id} className="card flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-slate-900">{o.name}</h2>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${o.isOpenNow ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{o.isOpenNow ? 'Open now' : 'Closed'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{o.address}</p>
            {o.phone && <p className="text-sm text-slate-600">Phone: {o.phone}</p>}
            <p className="mt-1 text-sm text-slate-600">Hours: {o.openTime} - {o.closeTime}</p>
            <p className="text-sm text-slate-600">{o.serviceCount} services available</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/offices/${o.id}`} className="btn-outline btn-sm">View services</Link>
              <Link to={`/display/${o.id}`} className="btn-outline btn-sm">Live display</Link>
              <Link to={user?.role === 'CITIZEN' ? `/citizen/book?office=${o.id}` : '/login'} className="btn-primary btn-sm">Book token</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
