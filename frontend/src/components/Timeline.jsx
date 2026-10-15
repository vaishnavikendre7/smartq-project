import { APP_LABEL, fmtDateTime } from '../lib/format.js';

const STEPS = ['SUBMITTED', 'DOCUMENTS_UNDER_VERIFICATION', 'UNDER_REVIEW', 'APPROVED'];

// Visual progress bar + list of every update with time and reason
export default function Timeline({ status, history = [] }) {
  const rejected = status === 'REJECTED';
  const steps = rejected ? ['SUBMITTED', 'DOCUMENTS_UNDER_VERIFICATION', 'UNDER_REVIEW', 'REJECTED'] : STEPS;
  const reached = new Set(history.map((h) => h.status));
  const currentIndex = Math.max(...steps.map((s, i) => (reached.has(s) || s === status ? i : -1)));

  return (
    <div>
      <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0" aria-label="Application progress">
        {steps.map((s, i) => {
          const done = i <= currentIndex;
          const isCurrent = s === status;
          const color = s === 'REJECTED' ? 'bg-red-600' : s === 'APPROVED' ? 'bg-emerald-600' : 'bg-brand-700';
          return (
            <li key={s} className="flex flex-1 items-center sm:flex-col sm:text-center">
              <div className="flex items-center sm:w-full">
                <div className={`hidden h-1 flex-1 sm:block ${i === 0 ? 'opacity-0' : done ? color : 'bg-slate-200'}`} />
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${done ? color : 'bg-slate-300'} ${isCurrent ? 'ring-4 ring-brand-100' : ''}`}>
                  {done ? (s === 'REJECTED' ? '!' : '\u2713') : i + 1}
                </div>
                <div className={`hidden h-1 flex-1 sm:block ${i === steps.length - 1 ? 'opacity-0' : i < currentIndex ? color : 'bg-slate-200'}`} />
              </div>
              <p className={`ml-3 text-sm sm:ml-0 sm:mt-2 sm:px-1 ${isCurrent ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{APP_LABEL[s]}</p>
            </li>
          );
        })}
      </ol>

      <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Update history</h3>
      <ul className="space-y-3">
        {[...history].reverse().map((h) => (
          <li key={h.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">{h.statusLabel}</span>
              <span className="text-xs text-slate-500">{fmtDateTime(h.at)} by {h.by}</span>
            </div>
            {h.remark && <p className="mt-1 text-sm text-slate-600">Note: {h.remark}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
