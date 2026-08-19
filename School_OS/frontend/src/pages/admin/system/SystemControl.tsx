import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';

interface HealthData {
  status: string;
  platform: string;
  version: string;
}

export default function SystemControl() {
  const { t } = useTranslation('adminGov');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/health/');
      setHealth(res.data);
      setLastChecked(new Date());
    } catch {
      setError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-12">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40 mb-3 block">{t('System Administration')}</span>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">{t('System Settings')}</h1>
          <p className="text-slate-500 mt-4 max-w-xl text-lg font-medium leading-relaxed">
            {t('Configure school system settings, manage platform preferences, and monitor system health.')}
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
          {t('Refresh Status')}
        </button>
      </section>

      {/* Health Check */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`rounded-2xl p-8 border ${error ? 'bg-red-50 border-red-200' : health?.status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${error ? 'bg-red-100' : health?.status === 'healthy' ? 'bg-green-100' : 'bg-slate-100'}`}>
              <span className={`material-symbols-outlined text-3xl ${error ? 'text-red-600' : health?.status === 'healthy' ? 'text-green-600' : 'text-slate-400'}`}>
                {error ? 'error' : 'check_circle'}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('API Status')}</p>
              <h3 className="text-2xl font-black text-slate-900">
                {loading ? t('Checking...') : error ? t('Unreachable') : health?.status || t('Unknown')}
              </h3>
            </div>
          </div>
          {lastChecked && (
            <p className="text-xs text-slate-400 font-medium">{t('Last checked: {{time}}', { time: lastChecked.toLocaleTimeString() })}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-8 border border-slate-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary">dns</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Platform')}</p>
              <h3 className="text-2xl font-black text-slate-900">{health?.platform || '-'}</h3>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">{t('Multi-tenant education management system')}</p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-slate-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-amber-600">info</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Version')}</p>
              <h3 className="text-2xl font-black text-slate-900">{health?.version || '-'}</h3>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">{t('Current platform build')}</p>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-6">{t('System Quick Info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-xl p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-2xl">shield</span>
            <div>
              <p className="font-bold text-slate-900">{t('JWT Authentication')}</p>
              <p className="text-xs text-slate-400">{t('Token-based auth with automatic refresh')}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-2xl">apartment</span>
            <div>
              <p className="font-bold text-slate-900">{t('Multi-Tenancy')}</p>
              <p className="text-xs text-slate-400">{t('School-scoped data isolation via middleware')}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-2xl">database</span>
            <div>
              <p className="font-bold text-slate-900">{t('PostgreSQL')}</p>
              <p className="text-xs text-slate-400">{t('Production database via DATABASE_URL')}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-2xl">cloud</span>
            <div>
              <p className="font-bold text-slate-900">{t('Railway Deployment')}</p>
              <p className="text-xs text-slate-400">{t('Backend hosting with gunicorn')}</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-24 border-t border-slate-200 text-center flex flex-col items-center gap-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-0.5 bg-primary/20"></div>
          <span className="text-2xl font-black tracking-[0.5em] text-slate-900 uppercase">{t('System Settings')}</span>
          <div className="w-12 h-0.5 bg-primary/20"></div>
        </div>
        <div className="space-y-4">
          <p className="text-slate-400 italic font-serif text-xl max-w-2xl leading-relaxed">
            "{t('System stability is the foundation of educational excellence.')}"
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-primary/30">{t('- School OS Administration')}</p>
        </div>
      </footer>
    </div>
  );
}
