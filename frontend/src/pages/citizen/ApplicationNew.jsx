import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, Field, PageHeader } from '../../components/ui.jsx';

export default function ApplicationNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [officeId, setOfficeId] = useState(params.get('office') || '');
  const [serviceId, setServiceId] = useState(params.get('service') || '');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const offices = usePolling(() => api.get('/public/offices'), 0);
  const services = usePolling(() => (officeId ? api.get(`/public/offices/${officeId}/services`) : Promise.resolve(null)), 0, [officeId]);
  const svc = services.data?.services.find((s) => String(s.id) === String(serviceId));

  useEffect(() => { if (services.data && serviceId && !svc) setServiceId(''); }, [services.data, serviceId, svc]);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const r = await api.post('/citizen/applications', { officeId: Number(officeId), serviceId: Number(serviceId), details });
      navigate(`/citizen/applications/${r.application.id}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/citizen/applications" className="text-sm text-brand-700 hover:underline">&larr; My applications</Link>
      <PageHeader title="Submit an application" subtitle="You will receive an Application ID to track progress" />
      <form onSubmit={submit} className="card space-y-4">
        <Alert>{error}</Alert>
        <Field label="Office">
          <select className="input" required value={officeId} onChange={(e) => { setOfficeId(e.target.value); setServiceId(''); }}>
            <option value="">Select an office</option>{offices.data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Service">
          <select className="input" required value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!officeId}>
            <option value="">Select a service</option>{services.data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {svc && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-semibold">Documents you should have ready:</p>
            <ul className="mt-1 list-disc pl-5 text-slate-600">{svc.documents.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
          </div>
        )}
        <Field label="Application details" hint="Write the purpose and the details the officer needs (10 to 1500 characters). Do not write passwords or card numbers.">
          <textarea className="input" rows={5} required minLength={10} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <button className="btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit application'}</button>
      </form>
    </div>
  );
}
