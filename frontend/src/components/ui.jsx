import { useEffect } from 'react';
import { BADGE, TOKEN_LABEL, APP_LABEL, COMPLAINT_LABEL } from '../lib/format.js';

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Alert({ type = 'error', children, onClose }) {
  if (!children) return null;
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800'
  };
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      <div>{children}</div>
      {onClose && <button onClick={onClose} className="font-bold leading-none" aria-label="Close message">x</button>}
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, kind = 'token' }) {
  const label = kind === 'app' ? APP_LABEL[status] : kind === 'complaint' ? COMPLAINT_LABEL[status] : TOKEN_LABEL[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[status] || 'bg-slate-100 text-slate-700'}`}>{label || status}</span>;
}

export function StatCard({ label, value, hint, tone = 'blue' }) {
  const tones = { blue: 'text-brand-700', green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-700' };
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tones[tone]}`}>{value ?? '-'}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`mt-10 w-full rounded-xl bg-white p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Asks "Are you sure?" before important actions
export function ConfirmDialog({ title, message, confirmText = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-5 text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait...' : confirmText}</button>
      </div>
    </Modal>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
