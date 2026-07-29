import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Find Schools', to: '/schools' },
  { label: 'Features', to: '/#features' },
  { label: 'Trust', to: '/trust' },
];

export default function PublicNavbar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) => {
    if (to === '/') return pathname === '/';
    return pathname.startsWith(to);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 py-4 max-w-7xl mx-auto font-inter tracking-tight">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer shrink-0">
            <div className="bg-primary text-secondary-fixed p-2 rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300">
              <span className="material-symbols-outlined text-2xl leading-none">account_balance</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-xl font-black tracking-tighter text-primary">
                School<span className="text-secondary">OS</span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase opacity-70 hidden sm:block">
                School Management Platform
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={
                  isActive(link.to)
                    ? 'text-blue-900 font-semibold border-b-2 border-blue-900 pb-1'
                    : 'text-slate-600 hover:text-blue-900 transition-colors'
                }
              >
                {link.label}
              </Link>
            ))}
            <a className="text-slate-600 hover:text-blue-900 transition-colors" href="#contact">Contact</a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login" className="text-slate-600 hover:text-blue-900 transition-colors font-medium">
              Login
            </Link>
            <button className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95">
              Request Demo
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -mr-2 text-slate-600 hover:text-blue-900 transition-colors"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-2xl">{mobileOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 right-0 w-72 h-full bg-surface shadow-2xl p-6 pt-20 animate-in slide-in-from-right duration-200">
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={
                    isActive(link.to)
                      ? 'text-blue-900 font-semibold bg-blue-50 rounded-xl px-4 py-3'
                      : 'text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-3 transition-colors'
                  }
                >
                  {link.label}
                </Link>
              ))}
              <a href="#contact" onClick={() => setMobileOpen(false)} className="text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-3 transition-colors">
                Contact
              </a>
            </div>
            <div className="mt-6 pt-6 border-t border-outline-variant/20 space-y-3">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-6 py-3 border border-outline-variant/30 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                Login
              </Link>
              <button className="w-full px-6 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95">
                Request Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
