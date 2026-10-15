import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, ConfirmDialog, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import TokenCard from '../../components/TokenCard.jsx';
import { POLL_MS, TOKEN_LABEL, fmtDateTime } from '../../lib/format.js';

export default function TokenDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = usePolling(() => api.get(`/citizen/tokens/${id}`), POLL_MS, [id]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [fb, setFb] = useState({ rating: 5, comment: '' });

  const cancel = async () => {
    setBusy(true);
    try { await api.patch(`/citizen/tokens/${id}/cancel`); setMsg({ type: 'success', text: 'Your token was cancelled.' }); reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setBusy(false); setConfirm(false); }
  };
  const sendFeedback = async (e) => {
    e.preventDefault();
    try { await api.post('/citizen/feedback', { tokenId: Number(id), ...fb }); setMsg({ type: 'success', text: 'Thank you for your feedback!' }); reload(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  if (loading) return <Spinner />;
  if (error && !data) return <div><Alert>{error}</Alert><Link to="/citizen/tokens" className="mt-4 inline-block text-brand-700 underline">Back to my tokens</Link></div>;
  const { token, history, feedback } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/citizen/tokens" className="text-sm text-brand-700 hover:underline">&larr; My tokens</Link>
      <PageHeader title={`Token ${token.tokenNumber}`} subtitle={token.status === 'WAITING' ? `Refreshes every ${POLL_MS / 1000} seconds` : undefined} />
      <div className="space-y-5">
        <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
        <TokenCard token={token} big link={false} />
        {['WAITING', 'CALLED', 'SERVING'].includes(token.status) && <p className="text-center text-xs text-slate-500">Show this QR code (or the token number) to the officer at the counter.</p>}

        <div className="flex flex-wrap gap-2">
          {token.status === 'WAITING' && <button className="btn-danger" disabled={!token.canCancel} onClick={() => setConfirm(true)}>Cancel token</button>}
          <Link to={`/citizen/applications/new?office=${token.office.id}&service=${token.service.id}`} className="btn-outline">Submit application for this service</Link>
        </div>
        {token.status === 'WAITING' && !token.canCancel && <p className="text-xs text-amber-700">{token.cancelNote}</p>}

        {token.status === 'COMPLETED' && (
          <div className="card">
            <h2 className="mb-2 font-bold">Rate your experience</h2>
            {feedback ? <p className="text-sm text-slate-600">You rated this visit {feedback.rating}/5{feedback.comment ? `: "${feedback.comment}"` : ''}. Thank you!</p> : (
              <form onSubmit={sendFeedback} className="space-y-3">
                <Field label="Rating">
                  <select className="input max-w-xs" value={fb.rating} onChange={(e) => setFb({ ...fb, rating: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} - {['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'][n]}</option>)}
                  </select>
                </Field>
                <Field label="Comment (optional)"><textarea className="input" rows={2} maxLength={500} value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} /></Field>
                <button className="btn-primary">Send feedback</button>
              </form>
            )}
          </div>
        )}

        <div className="card">
          <h2 className="mb-3 font-bold">Token history</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                <span><b>{TOKEN_LABEL[h.to]}</b>{h.note ? ` - ${h.note}` : ''}</span><span className="text-xs text-slate-500">{fmtDateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {confirm && <ConfirmDialog title="Cancel this token?" danger busy={busy} confirmText="Yes, cancel token" message={`Token ${token.tokenNumber} will leave the queue and you will lose your place.`} onConfirm={cancel} onCancel={() => setConfirm(false)} />}
    </div>
  );
}
