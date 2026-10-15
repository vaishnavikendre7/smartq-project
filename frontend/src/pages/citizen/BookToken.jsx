import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, PageHeader, Spinner } from '../../components/ui.jsx';
import { todayIST, fmtDate } from '../../lib/format.js';

const MAX_DAYS = 7;

function Step({ n, title, done, children }) {
  return (
    <section className="card">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm text-white ${done ? 'bg-emerald-600' : 'bg-brand-700'}`}>{done ? '\u2713' : n}</span>{title}
      </h2>
      {children}
    </section>
  );
}


export default function BookToken() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [officeId, setOfficeId] = useState(params.get('office') ? Number(params.get('office')) : null);
  const [serviceId, setServiceId] = useState(null);
  const [mode, setMode] = useState('now');           // 'now' = virtual token today, 'slot' = appointment
  const [date, setDate] = useState(todayIST());
  const [slot, setSlot] = useState('');
  const [docs, setDocs] = useState([]);
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const offices = usePolling(() => api.get('/public/offices'), 0);
  const services = usePolling(() => (officeId ? api.get(`/public/offices/${officeId}/services`) : Promise.resolve(null)), 0, [officeId]);
  const office = offices.data?.offices.find((o) => o.id === officeId);
  const service = services.data?.services.find((s) => s.id === serviceId);

  // load the checklist (with my "ready" ticks) when a service is chosen
  useEffect(() => {
    setDocs([]);
    if (!serviceId) return;
    api.get(`/citizen/checklist/${serviceId}`).then((r) => setDocs(r.documents)).catch((e) => setError(e.message));
  }, [serviceId]);

  // load free slots for appointment mode
  useEffect(() => {
    setSlot(''); setSlots(null);
    if (mode !== 'slot' || !officeId || !serviceId) return;
    api.get(`/citizen/slots?officeId=${officeId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => setSlots(r.slots)).catch((e) => { setError(e.message); setSlots([]); });
  }, [mode, officeId, serviceId, date]);

  const toggleDoc = async (d) => {
    setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, isReady: !x.isReady } : x)));
    try { await api.put(`/citizen/checklist/${d.id}`, { isReady: !d.isReady }); } catch (e) { setError(e.message); }
  };

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      const body = { officeId, serviceId };
      if (mode === 'slot') { body.date = date; body.slotTime = slot; }
      const r = await api.post('/citizen/tokens', body);
      navigate(`/citizen/tokens/${r.token.id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const ready = docs.filter((d) => d.isReady).length;


  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Book a token" subtitle="Choose an office, a service, then take a token now or book a time slot" />
      <Alert onClose={() => setError('')}>{error}</Alert>

      <Step n={1} title="Choose an office" done={Boolean(officeId)}>
        {offices.loading && <Spinner />}
        <div className="grid gap-3 md:grid-cols-3">
          {offices.data?.offices.map((o) => (
            <button key={o.id} onClick={() => { setOfficeId(o.id); setServiceId(null); setMode('now'); }}
              className={`rounded-lg border p-3 text-left transition ${o.id === officeId ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 hover:border-brand-500'}`}>
              <p className="font-semibold">{o.name}</p>
              <p className="text-xs text-slate-500">{o.address}</p>
              <p className="mt-1 text-xs text-slate-600">{o.openTime} - {o.closeTime} | {o.isOpenNow ? 'Open now' : 'Closed now'}</p>
            </button>
          ))}
        </div>
      </Step>

      {officeId && (
        <Step n={2} title="Choose a service" done={Boolean(serviceId)}>
          {services.loading && <Spinner />}
          <div className="grid gap-3 md:grid-cols-2">
            {services.data?.services.map((s) => (
              <button key={s.id} onClick={() => { setServiceId(s.id); setMode('now'); }}
                className={`rounded-lg border p-3 text-left transition ${s.id === serviceId ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 hover:border-brand-500'}`}>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-slate-500">About {s.avgMinutes} min per person</p>
              </button>
            ))}
          </div>
        </Step>
      )}

      {service && (
        <Step n={3} title="Check the requirements" done={docs.length > 0 && ready === docs.length}>
          {service.description && <p className="mb-3 text-sm text-slate-600">{service.description}</p>}
          <p className="mb-2 text-sm font-semibold">Documents required ({ready} of {docs.length} ready)</p>
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={d.isReady} onChange={() => toggleDoc(d)} />
                  <span className={`text-sm ${d.isReady ? 'text-slate-400 line-through' : ''}`}>{d.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {docs.length > 0 && ready < docs.length && <p className="mt-3 text-xs text-amber-700">Tip: keep all documents ready before your visit. You can still book your token now.</p>}
        </Step>
      )}

      {service && (
        <Step n={4} title="Get your token" done={false}>
          <div className="mb-4 flex gap-2">
            <button className={mode === 'now' ? 'btn-primary' : 'btn-outline'} onClick={() => setMode('now')}>Take a token now</button>
            <button className={mode === 'slot' ? 'btn-primary' : 'btn-outline'} onClick={() => setMode('slot')}>Book an appointment</button>
          </div>

          {mode === 'now' && (
            <p className="text-sm text-slate-600">
              A virtual token for <b>today</b> joins the queue straight away. {office && !office.isOpenNow && <span className="font-semibold text-amber-700">This office is closed right now ({office.openTime} - {office.closeTime}); choose an appointment instead.</span>}
            </p>
          )}

          {mode === 'slot' && (
            <div>
              <label className="label" htmlFor="date">Date (today to {MAX_DAYS} days ahead)</label>
              <input id="date" type="date" className="input max-w-xs" min={todayIST()} max={todayIST(MAX_DAYS)} value={date} onChange={(e) => setDate(e.target.value)} />
              <p className="mb-2 mt-4 text-sm font-semibold">Available time slots for {fmtDate(date)}</p>
              {!slots && <Spinner label="Loading slots..." />}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {slots?.map((s) => (
                  <button key={s.time} disabled={!s.available} onClick={() => setSlot(s.time)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold ${slot === s.time ? 'border-brand-700 bg-brand-700 text-white' : s.available ? 'border-slate-300 bg-white hover:border-brand-500' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'}`}>
                    {s.time}<span className="block text-[10px] font-normal">{s.available ? `${s.remaining} left` : s.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button className="btn-primary" disabled={busy || (mode === 'slot' && !slot)} onClick={confirm}>
              {busy ? 'Booking...' : mode === 'slot' ? `Confirm appointment${slot ? ` at ${slot}` : ''}` : 'Get my token'}
            </button>
            <span className="text-xs text-slate-500">{office?.name} | {service.name}</span>
          </div>
        </Step>
      )}
    </div>
  );
}
