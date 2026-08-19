import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';

interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  module: string;
  description: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  ip_address: string;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  STUDENT: 'Students',
  STAFF: 'Staff',
  ACADEMIC: 'Academic',
  ASSESSMENT: 'Assessment',
  FINANCE: 'Finance',
  ATTENDANCE: 'Attendance',
  TIMETABLE: 'Timetable',
  REPORT: 'Reports',
  LOGBOOK: 'Logbook',
  NOTIFICATION: 'Notifications',
  DOCUMENT: 'Documents',
  AUTH: 'Auth',
  SYSTEM: 'System',
  GOVERNMENT: 'Government',
};

export default function AuditLogs() {
  const { t } = useTranslation('adminGov');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/audit/logs/', { params });
      const data = res.data.results ?? res.data ?? [];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/audit/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // silent
    }
  };

  const actionColors: Record<string, string> = {
    CREATE: 'bg-emerald-100 text-emerald-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    LOGIN: 'bg-purple-100 text-purple-700',
    LOGOUT: 'bg-slate-100 text-slate-700',
    EXPORT: 'bg-amber-100 text-amber-700',
    APPROVE: 'bg-emerald-100 text-emerald-700',
    REJECT: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1500px] mx-auto bg-white min-h-screen">
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 pb-12">
        <div>
          <span className="text-[0.65rem] font-black uppercase tracking-[0.4em] text-primary/40 mb-3 block">{t('Activity Records')}</span>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">{t('Activity Log')}</h1>
          <p className="text-slate-500 mt-4 max-w-xl text-lg font-medium leading-relaxed">
            {t('Record of all administrative actions within the school system for transparency and accountability.')}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleExport}
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            {t('Export CSV')}
          </button>
        </div>
      </section>

      <section className="space-y-8 bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="relative w-full md:w-96 group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder={t('Search by actor, endpoint or description...')}
              className="w-full pl-12 pr-6 py-4 bg-white border-transparent focus:border-primary shadow-sm rounded-2xl text-sm font-medium transition-all focus:ring-4 focus:ring-primary/5"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-4 py-3 bg-white border-transparent focus:border-primary rounded-2xl text-sm font-medium shadow-sm"
            >
              <option value="">{t('All Modules')}</option>
              <option value="FINANCE">{t('Finance')}</option>
              <option value="STUDENT">{t('Students')}</option>
              <option value="STAFF">{t('Staff')}</option>
              <option value="ACADEMIC">{t('Academic')}</option>
              <option value="ASSESSMENT">{t('Assessment')}</option>
              <option value="ATTENDANCE">{t('Attendance')}</option>
              <option value="AUTH">{t('Auth')}</option>
              <option value="SYSTEM">{t('System')}</option>
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-3 bg-white border-transparent focus:border-primary rounded-2xl text-sm font-medium shadow-sm"
            >
              <option value="">{t('All Actions')}</option>
              <option value="CREATE">{t('Create')}</option>
              <option value="UPDATE">{t('Update')}</option>
              <option value="DELETE">{t('Delete')}</option>
              <option value="LOGIN">{t('Login')}</option>
              <option value="EXPORT">{t('Export')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-100">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl mb-4 block">sync</span>
            <p className="text-slate-400 font-medium">{t('Loading audit ledger...')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-100">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">history</span>
            <p className="text-slate-400 font-medium">{t('No audit logs available.')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-6">{t('Timestamp')}</th>
                  <th className="px-8 py-6">{t('Action')}</th>
                  <th className="px-8 py-6">{t('Module')}</th>
                  <th className="px-8 py-6">{t('User')}</th>
                  <th className="px-8 py-6">{t('Description')}</th>
                  <th className="px-8 py-6">{t('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="text-xs font-bold text-slate-400 group-hover:text-primary transition-colors">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[9px] px-3 py-1.5 rounded-lg font-black tracking-tighter uppercase shadow-sm border border-slate-200/50 ${actionColors[row.action] || 'bg-slate-100 text-slate-700'}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{t(MODULE_LABELS[row.module] || row.module)}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900">{row.user_name}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">{row.user_email}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-medium text-slate-700">{row.description || `${row.method} ${row.endpoint}`}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-black text-[10px] tracking-widest">
                        <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${row.status_code && row.status_code < 400 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className={row.status_code && row.status_code < 400 ? 'text-emerald-600' : 'text-red-600'}>
                          {row.status_code || '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="py-24 text-center flex flex-col items-center gap-12">
        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center grayscale opacity-20 shadow-inner">
          <span className="material-symbols-outlined text-white text-3xl">verified_user</span>
        </div>
        <p className="text-slate-400 italic font-serif text-xl max-w-2xl leading-relaxed opacity-60">
          "{t('The greatest asset of an institution is not its ledger of wealth, but its ledger of radical honesty.')}"
        </p>
      </footer>
    </div>
  );
}
