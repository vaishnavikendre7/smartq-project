import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui.jsx';
import { POLL_MS, fmtDateTime } from '../../lib/format.js';

const refreshBell = () => window.dispatchEvent(new Event('smartq-notifications-changed'));

export default function Notifications() {
  const { data, error, loading, reload } = usePolling(() => api.get('/citizen/notifications'), POLL_MS);
  const read = async (n) => { if (!n.isRead) { await api.patch(`/citizen/notifications/${n.id}/read`); reload(); refreshBell(); } };
  const readAll = async () => { await api.patch('/citizen/notifications/read-all'); reload(); refreshBell(); };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle="Turn alerts, token updates and application status changes"
        actions={data?.unread > 0 && <button className="btn-outline btn-sm" onClick={readAll}>Mark all as read</button>} />
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && data.notifications.length === 0 && <EmptyState title="No notifications yet" text="You will see alerts here when your turn is near or an application changes." />}
      <ul className="space-y-2">
        {data?.notifications.map((n) => (
          <li key={n.id}>
            <button onClick={() => read(n)} className={`w-full rounded-lg border p-3 text-left ${n.isRead ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{!n.isRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" />}{n.title}</span>
                <span className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{n.message}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
