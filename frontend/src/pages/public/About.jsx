import { PageHeader } from '../../components/ui.jsx';

export default function About() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="About SmartQ" subtitle="Digital Queue Management and Government Document Application Tracking System" />
      <div className="card space-y-4 text-sm leading-relaxed text-slate-700">
        <p>SmartQ is a final-year B.Tech Computer Science project. It shows how a government office or service centre can reduce crowding by letting citizens take virtual tokens, book appointments, and track document applications online.</p>
        <h2 className="text-base font-bold">Three roles</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Citizen:</b> books tokens and appointments, reads document checklists, submits applications, tracks progress, gives feedback and complaints.</li>
          <li><b>Officer:</b> calls tokens, verifies QR codes, updates application statuses for the assigned services.</li>
          <li><b>Administrator:</b> manages offices, services, checklists, officers, queue rules, complaints and reports.</li>
        </ul>
        <h2 className="text-base font-bold">Technology</h2>
        <p>React + Vite + Tailwind CSS (frontend), Node.js + Express (backend), MySQL with Prisma (database), JWT and bcrypt (security). Queue screens refresh by simple polling every 10 seconds.</p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <b>Important:</b> this is a college demonstration. Offices and addresses are sample data. SmartQ is not connected to any government system and cannot issue or approve real certificates. Approvals shown here are made by demo officers inside this application only.
        </div>
      </div>
    </div>
  );
}
