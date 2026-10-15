import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import Timeline from '../../components/Timeline.jsx';
import { POLL_MS, fmtDateTime } from '../../lib/format.js';

export default function ApplicationDetail() {
  const { id } = useParams();
  const { data, error, loading } = usePolling(() => api.get(`/citizen/applications/${id}`), POLL_MS, [id]);
  if (loading) return <Spinner />;
  if (error && !data) return <div><Alert>{error}</Alert><Link to="/citizen/applications" className="mt-4 inline-block text-brand-700 underline">Back</Link></div>;
  const a = data.application;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/citizen/applications" className="text-sm text-brand-700 hover:underline">&larr; My applications</Link>
      <PageHeader title={a.service.name} subtitle={`Application ID: ${a.applicationCode}`} actions={<StatusBadge kind="app" status={a.status} />} />
      <div className="space-y-5">
        {a.status === 'APPROVED' && <Alert type="success">Your application was approved in this demo system. (This is not an official certificate.)</Alert>}
        {a.status === 'REJECTED' && <Alert>Your application was rejected. Reason: {a.remark}</Alert>}
        <div className="card">
          <p className="text-sm text-slate-500">{a.office.name} | Submitted {fmtDateTime(a.createdAt)}</p>
          <h2 className="mb-6 mt-4 font-bold">Progress</h2>
          <Timeline status={a.status} history={a.history} />
        </div>
        <div className="card">
          <h2 className="mb-2 font-bold">Details you submitted</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{a.details}</p>
        </div>
        <p className="text-xs text-slate-500">The application status is separate from your queue token. Completing a visit does not approve an application.</p>
      </div>
    </div>
  );
}
