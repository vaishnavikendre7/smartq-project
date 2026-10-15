import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui.jsx';
import { POLL_MS, fmtTime } from '../../lib/format.js';

function Chooser() {
  const { data, error, loading } = usePolling(() => api.get('/public/offices'), 0);
  return (
    <div>
      <PageHeader title="Live queue display" subtitle="Choose an office to show its Now Serving screen" />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      <div className="grid gap-4 md:grid-cols-3">
        {data?.offices.map((o) => (
          <Link key={o.id} to={`/display/${o.id}`} className="card hover:border-brand-500">
            <p className="font-bold">{o.name}</p><p className="text-sm text-slate-500">{o.address}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Display() {
  const { officeId } = useParams();
  if (!officeId) return <Chooser />;
  return <Screen officeId={officeId} />;
}

function Screen({ officeId }) {
  const { data, error, loading } = usePolling(() => api.get(`/public/display/${officeId}`), POLL_MS, [officeId]);
  return (
    <div>
      <Link to="/display" className="text-sm text-brand-700 hover:underline">&larr; Other offices</Link>
      {loading && <Spinner />}
      <Alert>{error}</Alert>
      {data && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-brand-900 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{data.office.name}</h1>
            <p className="text-sm text-blue-200">Updated {fmtTime(data.updatedAt)} (refreshes every {POLL_MS / 1000}s)</p>
          </div>
          {data.queues.length === 0 && <div className="mt-6"><EmptyState title="No services at this office" /></div>}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {data.queues.map((q) => (
              <div key={q.serviceId} className="rounded-xl bg-white/10 p-5">
                <h2 className="text-lg font-bold text-white">{q.serviceName}</h2>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-200">Now serving</p>
                {q.nowServing.length === 0 ? <p className="text-2xl font-bold text-blue-100">-</p> : (
                  <div className="flex flex-wrap gap-3">
                    {q.nowServing.map((t) => <span key={t.tokenNumber} className="rounded-lg bg-emerald-500 px-4 py-2 text-3xl font-extrabold">{t.tokenNumber}</span>)}
                  </div>
                )}
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-200">Next in line ({q.waitingCount} waiting)</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {q.next.length === 0 ? <span className="text-blue-100">No one waiting</span> : q.next.map((n) => <span key={n} className="rounded-md bg-white/20 px-3 py-1 text-lg font-bold">{n}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
