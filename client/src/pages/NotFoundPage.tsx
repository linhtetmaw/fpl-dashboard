import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-16 text-center">
      <p className="eyebrow">404</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-white">Page not found</h2>
      <p className="mt-2 text-sm text-slate-400">This page doesn't exist. It may have moved.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        Go to Your Team
      </Link>
    </main>
  );
}
