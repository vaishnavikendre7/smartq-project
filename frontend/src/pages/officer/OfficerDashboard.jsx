import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, ConfirmDialog, EmptyState, PageHeader, Spinner, StatCard, StatusBadge } from '../../components/ui.jsx';
import { POLL_MS, fmtTime } from '../../lib/format.js';

export default function OfficerDashboard() {
  const { data, error, loading, reload } = usePolling(() => api.get('/officer/queue'), POLL_MS);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'complete' | 'skip' }

  const run = async (fn, okText) => {
    setBusy(true); setMsg({ ...msg, text: '' });
    try { await fn(); if (okText) setMsg({ type: 'success', text: okText }); await reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); await reload(); }
    finally { setBusy(false); setConfirm(null); }
  };
  const callNext = () => run(async () => { const r = await api.post('/officer/queue/call-next'); setMsg({ type: 'success', text: `Called ${r.token.tokenNumber} (${r.token.citizen}).` }); });
  const startServing = (t) => run(() => api.patch(`/officer/tokens/${t.id}/serving`), `Serving ${t.tokenNumber}.`);
  const complete = (t) => run(() => api.patch(`/officer/tokens/${t.id}/complete`), `${t.tokenNumber} completed.`);
  const skip = (t) => run(() => api.patch(`/officer/tokens/${t.id}/skip`, { note: 'Citizen did not arrive' }), `${t.tokenNumber} skipped.`);

  if (loading) return <Spinner />;
  if (error && !data) return <Alert>{error}</Alert>;
  const { current, waiting, recent, stats } = data;

  return (
    <div>
      <PageHeader title="Counter queue" subtitle={`${data.assignments.map((a) => `${a.office} - ${a.department}`).join(' | ') || 'No assignment yet'} | Refreshes every ${POLL_MS / 1000}s`}
        actions={<button className="btn-outline" onClick={reload}>Refresh now</button>} />
      {!data.hasServices && <Alert type="warn">No services are assigned to you yet. Please ask the administrator to assign you to an office and department.</Alert>}
      <div className="my-3"><Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert></div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Waiting today" value={stats.WAITING} tone="amber" />
        <StatCard label="In progress" value={stats.CALLED + stats.SERVING} tone="blue" />
        <StatCard label="Completed" value={stats.COMPLETED} tone="green" />
        <StatCard label="Skipped / cancelled" value={stats.SKIPPED + stats.CANCELLED} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="mb-3 font-bold">Current token</h2>
          {!current ? (
            <div>
              <p className="mb-4 text-sm text-slate-500">You are not serving anyone right now.</p>
              <button className="btn-primary w-full py-3 text-base" disabled={busy || !data.hasServices || waiting.length === 0} onClick={callNext}>Call next token</button>
              {waiting.length === 0 && <p className="mt-2 text-xs text-slate-500">No one is waiting.</p>}
            </div>
          ) : (
            <div>
              <p className="text-5xl font-extrabold text-brand-800">{current.tokenNumber}</p>
              <div className="mt-1"><StatusBadge status={current.status} /> {current.isVerified && <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>}</div>
              <dl className="mt-3 space-y-1 text-sm">
                <div><dt className="inline text-slate-500">Citizen: </dt><dd className="inline font-semibold">{current.citizen}</dd></div>
                <div><dt className="inline text-slate-500">Phone: </dt><dd className="inline">{current.citizenPhone}</dd></div>
                <div><dt className="inline text-slate-500">Service: </dt><dd className="inline">{current.service}</dd></div>
                {current.slotTime && <div><dt className="inline text-slate-500">Slot: </dt><dd className="inline">{current.slotTime}</dd></div>}
              </dl>
              {current.application && (
                <Link to={`/officer/applications/${current.application.id}`} className="mt-3 block rounded-lg bg-blue-50 p-2 text-sm text-brand-800 hover:underline">
                  Application {current.application.applicationCode} ({current.application.status.replaceAll('_', ' ').toLowerCase()}) - open
                </Link>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {current.status === 'CALLED' && <>
                  <button className="btn-primary" disabled={busy} onClick={() => startServing(current)}>Start serving</button>
                  <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ kind: 'skip' })}>Skip (not arrived)</button>
                </>}
                {current.status === 'SERVING' && <button className="btn-success" disabled={busy} onClick={() => setConfirm({ kind: 'complete' })}>Mark completed</button>}
              </div>
            </div>
          )}
        </section>

        <section className="card overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="font-bold">Waiting queue ({waiting.length})</h2></div>
          {waiting.length === 0 ? <div className="p-5"><EmptyState title="The queue is empty" text="New tokens appear here automatically." /></div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">#</th><th className="th">Token</th><th className="th">Citizen</th><th className="th">Service</th><th className="th">Slot</th><th className="th">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {waiting.map((t) => (
                    <tr key={t.id} className={t.eligible ? '' : 'bg-slate-50 text-slate-400'}>
                      <td className="td">{t.order}</td><td className="td font-bold">{t.tokenNumber}</td><td className="td">{t.citizen}</td><td className="td">{t.service}</td>
                      <td className="td">{t.slotTime || 'Virtual'}</td>
                      <td className="td">{t.isVerified && <span className="mr-1 text-xs text-emerald-700">Verified</span>}{!t.eligible && <span className="text-xs">Not yet (slot later)</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-bold">Processed by me today</h2>
        {recent.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr><th className="th">Token</th><th className="th">Citizen</th><th className="th">Service</th><th className="th">Called</th><th className="th">Finished</th><th className="th">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((t) => <tr key={t.id}><td className="td font-bold">{t.tokenNumber}</td><td className="td">{t.citizen}</td><td className="td">{t.service}</td><td className="td">{fmtTime(t.calledAt)}</td><td className="td">{fmtTime(t.completedAt)}</td><td className="td"><StatusBadge status={t.status} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirm?.kind === 'complete' && <ConfirmDialog title="Complete this token?" busy={busy} confirmText="Yes, completed" message={`Mark ${current.tokenNumber} as completed? Note: this does not approve the citizen's application.`} onConfirm={() => complete(current)} onCancel={() => setConfirm(null)} />}
      {confirm?.kind === 'skip' && <ConfirmDialog title="Skip this token?" danger busy={busy} confirmText="Yes, skip" message={`${current.citizen} did not arrive at the counter? Token ${current.tokenNumber} will be skipped.`} onConfirm={() => skip(current)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
