import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui.jsx';

// Builds "service -> list of offices that offer it" from the real office data
async function loadAll() {
  const { offices } = await api.get('/public/offices');
  const map = new Map();
  for (const o of offices) {
    const r = await api.get(`/public/offices/${o.id}/services`);
    for (const s of r.services) {
      if (!map.has(s.id)) map.set(s.id, { ...s, offices: [] });
      map.get(s.id).offices.push({ id: o.id, name: o.name });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Services() {
  const { data, error, loading } = usePolling(loadAll, 0);
  return (
    <div>
      <PageHeader title="Available services" subtitle="Each service is offered only at the offices listed under it" />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.length === 0 && <EmptyState title="No services available" />}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((s) => (
          <div key={s.id} className="card">
            <h2 className="font-bold">{s.name}</h2>
            {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Offered at</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {s.offices.map((o) => <Link key={o.id} to={`/offices/${o.id}`} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100">{o.name}</Link>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
