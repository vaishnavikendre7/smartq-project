import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Field, PageHeader } from '../../components/ui.jsx';
import { fmtDate } from '../../lib/format.js';

const LOOK = {
  VALID: ['bg-emerald-50 border-emerald-300 text-emerald-900', 'VALID TOKEN'],
  INVALID: ['bg-red-50 border-red-300 text-red-900', 'INVALID CODE'],
  CANCELLED: ['bg-slate-100 border-slate-300 text-slate-800', 'CANCELLED TOKEN'],
  EXPIRED: ['bg-slate-100 border-slate-300 text-slate-800', 'EXPIRED TOKEN'],
  NOT_TODAY: ['bg-amber-50 border-amber-300 text-amber-900', 'NOT FOR TODAY'],
  ALREADY_USED: ['bg-amber-50 border-amber-300 text-amber-900', 'ALREADY USED'],
  NOT_PERMITTED: ['bg-red-50 border-red-300 text-red-900', 'NOT YOUR SERVICE']
};

export default function VerifyToken() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { setResult(await api.post('/officer/tokens/verify', { code })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const look = result ? LOOK[result.result] : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Verify a token" subtitle="Enter the token number (like INC-004) or the text read from the citizen's QR code" />
      <form onSubmit={submit} className="card space-y-4">
        <Alert>{error}</Alert>
        <Field label="Token number or QR text" hint="Use a handheld QR scanner or phone scanner app to read the code text, then paste it here. Typing the token number also works.">
          <input className="input" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="INC-004  or  SMARTQ|12|abc123..." />
        </Field>
        <button className="btn-primary" disabled={busy}>{busy ? 'Checking...' : 'Verify'}</button>
      </form>

      {result && (
        <div className={`mt-5 rounded-xl border-2 p-5 ${look[0]}`} role="status">
          <p className="text-xl font-extrabold">{look[1]}</p>
          <p className="mt-1 text-sm">{result.message}</p>
          {result.token && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="opacity-70">Token</dt><dd className="font-bold">{result.token.tokenNumber}</dd></div>
              <div><dt className="opacity-70">Status</dt><dd className="font-bold">{result.token.status}</dd></div>
              <div><dt className="opacity-70">Citizen</dt><dd className="font-bold">{result.token.citizen}</dd></div>
              <div><dt className="opacity-70">Service</dt><dd className="font-bold">{result.token.service}</dd></div>
              <div><dt className="opacity-70">Date</dt><dd className="font-bold">{fmtDate(result.token.tokenDate)}</dd></div>
              <div><dt className="opacity-70">Slot</dt><dd className="font-bold">{result.token.slotTime || 'Virtual token'}</dd></div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
