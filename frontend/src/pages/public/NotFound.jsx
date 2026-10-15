import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-6xl font-extrabold text-brand-700">404</p>
      <p className="mt-2 text-lg font-semibold">This page does not exist.</p>
      <Link to="/" className="btn-primary mt-6">Go to home</Link>
    </div>
  );
}
