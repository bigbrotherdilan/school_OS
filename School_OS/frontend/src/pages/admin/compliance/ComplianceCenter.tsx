import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function ComplianceCenter() {
  const navigate = useNavigate();
  const { t } = useTranslation('adminGov');
  const { addToast } = useToastStore();

  const handleExportMinistryReport = async () => {
    try {
      addToast(t('Preparing ministry report export...'), 'info');
      const response = await api.get('/gov/export/', { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ministry_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      addToast(t('Compliance report ready for download.'), 'success');
    } catch (err) {
      addToast(t('Failed to generate ministry report.'), 'error');
    }
  };

  const handleRecalculateCompliance = async () => {
    try {
      addToast(t('Initiating compliance recalibration...'), 'info');
      const response = await api.post('/gov/recalculate/');
      addToast(response.data.message || t('Compliance scores recalculated.'), 'success');
    } catch (err) {
      addToast(t('Failed to recalculate scores.'), 'error');
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-outline-variant/15 pb-8">
        <div>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary/60 mb-2 block font-headline">{t('MINESEC & Inspections')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface font-headline">{t('Inspections & Ministry Reports')}</h2>
          <p className="text-on-surface-variant mt-2 max-w-xl text-lg leading-relaxed">
            {t('Prepare for MINESEC inspections, manage compliance reports, and ensure alignment with national education standards.')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportMinistryReport}
            className="px-6 py-3 bg-surface-container-highest text-on-surface font-semibold rounded-xl text-sm transition-all hover:bg-surface-container-high active:scale-95 flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-sm">download</span>
            {t('Export Ministry Report')}
          </button>
          <button
            onClick={handleRecalculateCompliance}
            className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold rounded-xl text-sm shadow-xl transition-all active:scale-95 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">sync</span>
            {t('Submit Audit Data')}
          </button>
        </div>
      </div>

      {/* Compliance Modules Navigation */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Inspector Dashboard', icon: 'dashboard', path: '/admin/compliance/inspections', color: 'bg-blue-500' },
          { label: 'Performance Reports', icon: 'assessment', path: '/admin/compliance/reports', color: 'bg-emerald-500' },
        ].map((mod) => (
          <button
            key={mod.path}
            onClick={() => navigate(mod.path)}
            className="bg-surface-container-lowest p-4 lg:p-5 rounded-xl border border-outline-variant/15 hover:border-primary/30 hover:shadow-md transition-all group text-left"
          >
            <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center text-white mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{mod.icon}</span>
            </div>
            <span className="text-xs font-bold text-on-surface block leading-tight">{t(mod.label)}</span>
          </button>
        ))}
      </section>

      <footer className="mt-20 py-16 border-t border-outline-variant/15 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl font-black shadow-xl grayscale opacity-40">OS</div>
          </div>
          <p className="text-on-surface-variant italic font-serif text-xl leading-relaxed">
            "{t('Institutional integrity is not a destination, but a continuous process of accurate documentation and radical transparency.')}"
          </p>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/40">{t('- School OS Governance Charter v2.4')}</p>
            <div className="w-12 h-1 bg-primary/20 rounded-full mt-4"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
