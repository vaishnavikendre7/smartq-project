import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import TokenCard from '../../components/TokenCard.jsx';
import { POLL_MS, fmtDate } from '../../lib/format.js';

export default function MyTokens() {
  const { data, error, loading } = usePolling(() => api.get('/citizen/tokens'), POLL_MS);
  const [tab, setTab] = useState('current');
  return (
    <div>
      <PageHeader title="My tokens" subtitle={`Active tokens refresh every ${POLL_MS / 1000} seconds`} actions={<Link to="/citizen/book" className="btn-primary">Book a token</Link>} />
      <div className="mb-5 flex gap-2" role="tablist">
        <button role="tab" aria-selected={tab === 'current'} className={tab === 'current' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setTab('current')}>Current ({data?.current.length ?? 0})</button>
        <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setTab('history')}>History ({data?.history.length ?? 0})</button>
      </div>
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && tab === 'current' && (data.current.length === 0
        ? <EmptyState title="No active tokens" action={<Link to="/citizen/book" className="btn-primary">Book a token</Link>} />
        : <div className="grid gap-4 md:grid-cols-2">{data.current.map((t) => <TokenCard key={t.id} token={t} />)}</div>)}
      {data && tab === 'history' && (data.history.length === 0
        ? <EmptyState title="No previous tokens yet" />
        : (
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr><th className="th">Token</th><th className="th">Service</th><th className="th">Office</th><th className="th">Date</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.history.map((t) => (
                  <tr key={t.id}>
                    <td className="td font-bold">{t.tokenNumber}</td><td className="td">{t.service.name}</td><td className="td">{t.office.name}</td>
                    <td className="td">{fmtDate(t.tokenDate)}{t.slotTime ? ` ${t.slotTime}` : ''}</td><td className="td"><StatusBadge status={t.status} /></td>
                    <td className="td"><Link className="text-brand-700 hover:underline" to={`/citizen/tokens/${t.id}`}>Details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
