import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardPath } from '../../lib/format.js';

const FEATURES = [
  ['Skip the queue', 'Take a virtual token or book an appointment slot from home. Come only when your turn is near.'],
  ['Know your turn', 'See your queue position and estimated waiting time. Get notified when your turn is close.'],
  ['Track your application', 'Submit a document application, get an Application ID and follow every step on a timeline.'],
  ['Checklist before you go', 'See exactly which documents each service needs, and tick them off before your visit.'],
  ['QR token check-in', 'Show your QR code. The officer verifies your token in seconds.'],
  ['Feedback and complaints', 'Rate your visit or raise a complaint and watch the response.']
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="space-y-14">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-14 text-white sm:px-12">
        <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">College project demo</p>
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-5xl">Stop standing in line. Start tracking your government work.</h1>
        <p className="mt-4 max-w-2xl text-blue-100">SmartQ manages queues and document applications for government offices and service centres, so citizens save time and officers stay organised.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Link to={dashboardPath(user.role)} className="btn bg-white text-brand-800 hover:bg-blue-50">Go to my dashboard</Link>
          ) : (
            <>
              <Link to="/register" className="btn bg-white text-brand-800 hover:bg-blue-50">Create free account</Link>
              <Link to="/login" className="btn border border-white/60 text-white hover:bg-white/10">Log in</Link>
            </>
          )}
          <Link to="/offices" className="btn border border-white/60 text-white hover:bg-white/10">View offices</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-center text-2xl font-bold">What SmartQ gives you</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="card">
              <h3 className="font-bold text-brand-800">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}