import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">SmartQ - Digital Queue Management and Application Tracking</p>
          <p className="mt-1">A college project demonstration. It is not connected to any government system and cannot issue official certificates.</p>
        </div>
      </footer>
    </div>
  );
}
