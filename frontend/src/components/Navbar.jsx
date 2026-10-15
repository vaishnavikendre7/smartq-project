import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { dashboardPath } from '../lib/format.js';

const LINKS = {
  PUBLIC: [['/', 'Home'], ['/offices', 'Offices'], ['/services', 'Services'], ['/display', 'Live Display'], ['/about', 'About']],
  CITIZEN: [['/citizen', 'Dashboard'], ['/citizen/book', 'Book Token'], ['/citizen/tokens', 'My Tokens'], ['/citizen/applications', 'Applications'], ['/citizen/complaints', 'Complaints']],
  OFFICER: [['/officer', 'Queue'], ['/officer/verify', 'Verify Token'], ['/officer/applications', 'Applications'], ['/officer/complaints', 'Complaints'], ['/display', 'Display']],
  ADMIN: [['/admin', 'Dashboard'], ['/admin/offices', 'Offices'], ['/admin/services', 'Services'], ['/admin/officers', 'Officers'], ['/admin/tokens', 'Tokens'], ['/admin/applications', 'Applications'], ['/admin/complaints', 'Complaints'], ['/admin/logs', 'Logs']]
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Unread count for the notification bell (checked every 30 seconds)
  useEffect(() => {
    if (!user || user.role !== 'CITIZEN') return undefined;
    const load = () => api.get('/citizen/notifications').then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('smartq-notifications-changed', load);
    return () => { clearInterval(t); window.removeEventListener('smartq-notifications-changed', load); };
  }, [user]);

  const links = user ? LINKS[user.role] : LINKS.PUBLIC;
  const linkClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link to={user ? dashboardPath(user.role) : '/'} className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-lg font-extrabold text-white">Q</span>
          <span className="text-lg font-extrabold text-brand-900">SmartQ</span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 lg:flex" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to.split('/').length <= 2} className={linkClass}>{label}</NavLink>)}
        </nav>

        <div className="flex items-center gap-2">
          {user?.role === 'CITIZEN' && (
            <Link to="/citizen/notifications" className="relative rounded-full p-2 hover:bg-slate-100" aria-label={`Notifications, ${unread} unread`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          {user ? (
            <>
              {user.role === 'CITIZEN' && <Link to="/citizen/profile" className="hidden text-sm font-medium text-slate-700 hover:underline sm:block">{user.name.split(' ')[0]}</Link>}
              {user.role !== 'CITIZEN' && <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 sm:block">{user.role}</span>}
              <button className="btn-outline btn-sm" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-outline btn-sm">Log in</Link>
              <Link to="/register" className="btn-primary btn-sm hidden sm:inline-flex">Register</Link>
            </>
          )}
          <button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(!open)} aria-label="Open menu" aria-expanded={open}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col">
            {links.map(([to, label]) => <NavLink key={to} to={to} end={to.split('/').length <= 2} className={linkClass} onClick={() => setOpen(false)}>{label}</NavLink>)}
            {!user && <NavLink to="/register" className={linkClass} onClick={() => setOpen(false)}>Register</NavLink>}
            {user?.role === 'CITIZEN' && <NavLink to="/citizen/profile" className={linkClass} onClick={() => setOpen(false)}>Profile</NavLink>}
          </div>
        </nav>
      )}
    </header>
  );
}
