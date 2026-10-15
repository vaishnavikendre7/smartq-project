import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { StatusBadge } from './ui.jsx';
import { fmtDate } from '../lib/format.js';

export function WaitInfo({ token }) {
  if (token.status === 'CALLED') return <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">It is your turn! Please go to the counter now.</p>;
  if (token.status === 'SERVING') return <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm font-semibold text-indigo-800">Your service is in progress.</p>;
  if (token.status !== 'WAITING') return null;
  const future = token.estimatedWaitMinutes === null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-center">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Queue position</p>
        <p className="text-2xl font-bold text-brand-700">{token.position}</p>
        <p className="text-xs text-slate-500">{token.peopleAhead} ahead of you</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Estimated wait</p>
        <p className="text-2xl font-bold text-brand-700">{future ? '-' : `${token.estimatedWaitMinutes} min`}</p>
        <p className="text-xs text-slate-500">{future ? 'Shown on the day of your visit' : `based on ${token.estimateSource} average`}</p>
      </div>
    </div>
  );
}

export default function TokenCard({ token, big = false, link = true }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{token.service.name}</p>
          <p className={`font-extrabold tracking-wide text-brand-800 ${big ? 'text-5xl' : 'text-3xl'}`}>{token.tokenNumber}</p>
          <p className="mt-1 text-sm text-slate-600">{token.office.name}</p>
          <p className="text-sm text-slate-500">{fmtDate(token.tokenDate)}{token.slotTime ? ` at ${token.slotTime}` : ' (virtual token)'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={token.status} />
          {token.isVerified && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>}
          {big && ['WAITING', 'CALLED', 'SERVING'].includes(token.status) && (
            <div className="rounded-lg border border-slate-200 bg-white p-2"><QRCodeSVG value={token.qrValue} size={110} /></div>
          )}
        </div>
      </div>
      <WaitInfo token={token} />
      {link && <Link to={`/citizen/tokens/${token.id}`} className="btn-outline btn-sm mt-4">View details and QR code</Link>}
    </div>
  );
}
