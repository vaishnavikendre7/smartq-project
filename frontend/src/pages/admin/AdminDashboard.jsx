import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api.js';
import usePolling from '../../hooks/usePolling.js';
import { Alert, EmptyState, PageHeader, Spinner, StatCard } from '../../components/ui.jsx';
import { APP_LABEL, TOKEN_LABEL, todayIST } from '../../lib/format.js';

const COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#64748b'];

export default function AdminDashboard() {
  const [f, setF] = useState({ from: todayIST(-6), to: todayIST(), officeId: '' });
  const q = `from=${f.from}&to=${f.to}${f.officeId ? `&officeId=${f.officeId}` : ''}`;
  const { data, error, loading } = usePolling(() => api.get(`/admin/analytics?${q}`), 30000, [q]);
  const offices = usePolling(() => api.get('/admin/offices'), 0);

  const statusData = data ? Object.entries(data.tokensByStatus).filter(([, v]) => v > 0).map(([k, v]) => ({ name: TOKEN_LABEL[k], value: v })) : [];
  const appData = data ? Object.entries(data.applications).map(([k, v]) => ({ name: APP_LABEL[k], value: v })) : [];
  const t = data?.totals;

  return (
    <div>
      <PageHeader title="Administrator dashboard" subtitle="All numbers are calculated from the database" />
      <div className="card mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">From<input type="date" className="input mt-1" max={f.to} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="text-sm font-medium">To<input type="date" className="input mt-1" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="text-sm font-medium">Office
          <select className="input mt-1" value={f.officeId} onChange={(e) => setF({ ...f, officeId: e.target.value })}>
            <option value="">All offices</option>{offices.data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn-outline btn-sm" onClick={() => setF({ ...f, from: todayIST(), to: todayIST() })}>Today</button>
          <button className="btn-outline btn-sm" onClick={() => setF({ ...f, from: todayIST(-6), to: todayIST() })}>Last 7 days</button>
          <button className="btn-outline btn-sm" onClick={() => setF({ ...f, from: todayIST(-29), to: todayIST() })}>Last 30 days</button>
        </div>
      </div>
      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Citizens" value={t.citizens} />
            <StatCard label="Offices" value={t.offices} tone="slate" />
            <StatCard label="Services" value={t.services} tone="slate" />
            <StatCard label="Officers" value={t.officers} tone="slate" />
            <StatCard label="Tokens generated" value={t.tokensGenerated} hint={`${data.range.from} to ${data.range.to}`} />
            <StatCard label="Completed services" value={t.tokensCompleted} tone="green" />
            <StatCard label="Pending applications" value={t.pendingApplications} tone="amber" hint={`of ${t.totalApplications} in total`} />
            <StatCard label="Open complaints" value={t.openComplaints} tone="red" hint={`${data.complaints.RESOLVED} resolved`} />
            <StatCard label="Average waiting time" value={data.averageWaitMinutes === null ? 'No data' : `${data.averageWaitMinutes} min`} tone="amber" hint={`from ${data.waitSamples} called tokens`} />
            <StatCard label="Peak hour" value={data.peakHour ? data.peakHour.hour : 'No data'} tone="blue" hint={data.peakHour ? `${data.peakHour.count} tokens` : undefined} />
            <StatCard label="Average rating" value={data.feedback.average === null ? 'No data' : `${data.feedback.average} / 5`} tone="green" hint={`${data.feedback.count} reviews`} />
          </div>

          {t.tokensGenerated === 0 ? <EmptyState title="No tokens in this date range" text="Charts appear when citizens generate tokens." /> : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card"><h2 className="mb-3 font-bold">Tokens per day</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.tokensPerDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="tokens" stroke="#1d4ed8" strokeWidth={2} /></LineChart></ResponsiveContainer></div></div>
              <div className="card"><h2 className="mb-3 font-bold">Busy hours</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.busyHours}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Tokens" fill="#2563eb" /></BarChart></ResponsiveContainer></div></div>
              <div className="card"><h2 className="mb-3 font-bold">Most requested services</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.topServices} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="service" width={150} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="Tokens" fill="#059669" /></BarChart></ResponsiveContainer></div></div>
              <div className="card"><h2 className="mb-3 font-bold">Token outcomes</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" outerRadius={85} label>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></div>
            </div>
          )}

          <div className="card"><h2 className="mb-3 font-bold">Applications by status (all time)</h2>
            {appData.length === 0 ? <p className="text-sm text-slate-500">No applications yet.</p> : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{appData.map((a) => <div key={a.name} className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-brand-700">{a.value}</p><p className="text-xs text-slate-600">{a.name}</p></div>)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
