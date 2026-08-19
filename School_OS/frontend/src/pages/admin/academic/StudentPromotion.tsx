import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useSectionStore } from '../../../stores/sectionStore';
import { useTranslation } from 'react-i18next';

interface PromotionResult {
  id: string;
  name: string;
  average: number | null;
  eligible: boolean;
  terms: { term: string; average: number }[];
}

interface AcademicClass {
  id: string;
  name: string;
}

export default function StudentPromotion() {
  const { t } = useTranslation('adminAcademicMgmt');
  const { activeSectionId } = useSectionStore();
  const [cutoff, setCutoff] = useState(9.5);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [preview, setPreview] = useState<PromotionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined });
        setClasses(res.data.results || res.data);
      } catch (err) {
        console.error('Failed to fetch classes', err);
      }
    };
    fetchClasses();
  }, [activeSectionId]);

  const fetchPreview = async () => {
    if (!selectedClass) return;
    setLoading(true);
    setSuccess(null);
    try {
      const res = await api.get(`/students/students/promotion-preview/?cutoff=${cutoff}&from_class=${selectedClass}`);
      setPreview(res.data);
    } catch (err) {
      console.error('Failed to fetch promotion preview', err);
    } finally {
      setLoading(false);
    }
  };

  const executePromotion = async () => {
    if (!preview.length) return;
    if (!window.confirm(t('ARE YOU SURE? This will globally move the selected students to their next classes. This action IS IRREVERSIBLE.'))) return;
    
    setExecuting(true);
    try {
      await api.post('/students/students/promote/', { from_class: selectedClass, cutoff: cutoff });
      setSuccess(t('Promotion processed for the selected students!'));
      setPreview([]);
    } catch (err) {
      console.error('Promotion execution failed', err);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-tertiary font-bold tracking-widest text-xs uppercase mb-2 block tracking-wider">{t('End of Year Process')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Class Promotion')}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{t('Manage the transition of students between class levels based on performance results.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Card */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-8 h-fit space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-tertiary-container text-tertiary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined font-bold">settings_suggest</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface">{t('Promotion Logic')}</h3>
          </div>
          
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {t('Select a class and configure the academic threshold. The promotion average is the')}
            <strong> {t('annual average')}</strong> {t('— the mean of the three term averages. Official Cameroon')}
            {t('standard for passing to the next class:')} <strong>10/20</strong>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">{t('Source Class')}</label>
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-surface-container-high border-none rounded-xl px-4 py-3 w-full focus:ring-2 focus:ring-tertiary/20 text-on-surface font-medium"
              >
                <option value="">{t('Select a class...')}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">{t('Minimum Average (0-20)')}</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="20"
                  value={cutoff}
                  onChange={(e) => setCutoff(parseFloat(e.target.value))}
                  className="bg-surface-container-high border-none rounded-xl px-4 py-3 w-full focus:ring-2 focus:ring-tertiary/20 text-lg font-bold"
                />
                <button 
                  onClick={fetchPreview}
                  disabled={loading || !selectedClass}
                  className="bg-tertiary text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-tertiary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? '...' : t('Preview')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-warning-container/30 border border-warning/10 rounded-2xl p-4 flex gap-4">
             <span className="material-symbols-outlined text-warning text-2xl">warning</span>
             <p className="text-xs text-on-surface-variant leading-relaxed">
               <strong>{t('Platform Guard:')}</strong> {t('Ensure all final term exams are published before execution.')}
             </p>
          </div>

          <button 
            onClick={executePromotion}
            disabled={preview.length === 0 || executing}
            className="w-full bg-surface-container-highest text-on-surface border border-outline-variant/20 py-4 rounded-xl font-bold hover:bg-error hover:text-white transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {executing ? (
               <span className="material-symbols-outlined animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined">rocket_launch</span>
            )}
            {t('Execute Promotion')}
          </button>
        </div>

        {/* Results Preview */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm overflow-hidden min-h-[600px]">
          <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-on-surface">{t('Promotion Preview')}</h3>
              {preview.length > 0 && (
                <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                  {t('{{count}} Students', { count: preview.length })}
                </span>
              )}
            </div>
          </div>

          {success ? (
             <div className="p-24 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
               <div className="w-24 h-24 bg-success-container text-success rounded-full flex items-center justify-center mb-6">
                 <span className="material-symbols-outlined text-5xl font-bold">check_circle</span>
               </div>
               <h3 className="text-2xl font-bold text-on-surface mb-2">{t('Success!')}</h3>
               <p className="text-on-surface-variant max-w-sm">{success}</p>
             </div>
          ) : preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left py-4 px-8 text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t('Student')}</th>
                    <th className="text-center py-4 px-8 text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t('Average')}</th>
                    <th className="text-right py-4 px-8 text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t('Decision')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-container-high/20 transition-colors">
                      <td className="py-4 px-8">
                        <span className="font-bold text-on-surface block">{row.name}</span>
                        {row.terms && row.terms.length > 0 && (
                          <span className="text-[10px] text-on-surface-variant font-mono block mt-0.5">
                            {row.terms.map(t => `${t.term} ${t.average.toFixed(2)}`).join('  ·  ')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-8 text-center font-mono font-bold tracking-tighter text-lg">{row.average === null ? '—' : row.average.toFixed(2)}</td>
                      <td className="py-4 px-8 text-right">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${row.eligible ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                          {row.eligible ? t('PROMOTED') : t('REPEATED')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-24 text-on-surface-variant text-center space-y-4 opacity-70">
              <span className="material-symbols-outlined text-6xl font-light">preview</span>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-on-surface">{t('Ready for Preview')}</h3>
                <p className="max-w-xs mx-auto text-sm leading-relaxed">{t('Select a class and click preview to see automated promotion eligibility results.')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
