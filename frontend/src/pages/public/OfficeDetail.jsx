import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, PageHeader, Spinner } from '../../components/ui.jsx';

export default function OfficeDetail() {
  const { id } = useParams();
  const { data, error, loading } = usePolling(() => api.get(`/public/offices/${id}/services`), 0, [id]);
  return (
    <div>
      <Link to="/offices" className="text-sm text-brand-700 hover:underline">&larr; All offices</Link>
      {loading && <Spinner />}
      <Alert>{error}</Alert>
      {data && (
        <>
          <PageHeader title={data.office.name} subtitle={`${data.office.address} | ${data.office.openTime} - ${data.office.closeTime}`} />
          <div className="grid gap-4 md:grid-cols-2">
            {data.services.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">{s.name}</h2>
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">{s.code}</span>
                </div>
                {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
                <p className="mt-2 text-xs text-slate-500">Department: {s.department || '-'} | About {s.avgMinutes} min per person</p>
                <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Documents required</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{s.documents.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
