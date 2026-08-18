import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-8xl font-black text-slate-200 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-slate-500 mb-8 max-w-md">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all">
        Go Home
      </Link>
    </div>
  );
}
