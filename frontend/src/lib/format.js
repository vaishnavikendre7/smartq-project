export const POLL_MS = 10000; // queue screens refresh every 10 seconds (simple polling, no sockets)

export const todayIST = (plusDays = 0) =>
  new Date(Date.now() + plusDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '-';
export const fmtDate = (s) =>
  s ? new Date(`${s}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export const TOKEN_LABEL = {
  WAITING: 'Waiting', CALLED: 'Called', SERVING: 'Serving', COMPLETED: 'Completed',
  SKIPPED: 'Skipped', CANCELLED: 'Cancelled', EXPIRED: 'Expired'
};
export const APP_LABEL = {
  SUBMITTED: 'Submitted', DOCUMENTS_UNDER_VERIFICATION: 'Documents Under Verification',
  UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected'
};
export const COMPLAINT_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };

export const BADGE = {
  WAITING: 'bg-amber-100 text-amber-800', CALLED: 'bg-blue-100 text-blue-800', SERVING: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800', SKIPPED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-slate-200 text-slate-700', EXPIRED: 'bg-slate-200 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-800', DOCUMENTS_UNDER_VERIFICATION: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800',
  OPEN: 'bg-red-100 text-red-800', IN_PROGRESS: 'bg-amber-100 text-amber-800', RESOLVED: 'bg-emerald-100 text-emerald-800'
};
export const dashboardPath = (role) => (role === 'ADMIN' ? '/admin' : role === 'OFFICER' ? '/officer' : '/citizen');
