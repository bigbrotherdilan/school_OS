import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../../services/api';
import { useToastStore } from '../../../../../stores/toastStore';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface Props {
  sectionId: string | null;
  yearId: string;
  onDone: (result: any) => void;
  onBack: () => void;
}

export default function Step4GenerateReview({ sectionId, yearId, onDone, onBack }: Props) {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const { t } = useTranslation('adminAcademic');
  const { addToast } = useToastStore();

  const payload = { academic_year: yearId, stream: sectionId || 'none' };

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await api.post('/timetable/timetables/check_section/', payload);
      setCheckResult(res.data);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Feasibility check failed.'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await api.post('/timetable/timetables/generate_school/', payload);
      setGenResult(res.data);
      addToast(res.data.message || t('Timetables generated!'), 'success');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || t('Generation failed.');
      addToast(msg, 'error');
      setGenResult({ ok: false, message: msg });
    } finally {
      setGenerating(false);
    }
  };

  const hasErrors = checkResult && checkResult.issues?.some((i: any) => i.severity === 'error');
  const hasWarnings = checkResult && checkResult.issues?.some((i: any) => i.severity === 'warning');

  const severityIcon = (sev: string) => {
    if (sev === 'error') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t('Step 4: Review & Generate')}</h3>
            <p className="text-sm text-on-surface-variant">{t('Run a feasibility check first, then generate clash-free timetables for the whole section.')}</p>
          </div>
        </div>

        {/* Feasibility check */}
        <div className="space-y-4">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="w-full py-3.5 border-2 border-dashed border-primary/30 rounded-2xl text-primary font-bold text-sm hover:bg-primary/5 active:scale-[.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {checking ? t('Checking feasibility…') : t('Run feasibility check')}
          </button>

          {checkResult && (
            <div className="animate-in fade-in duration-300 space-y-3">
              {/* Summary bar */}
              <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${
                checkResult.ready
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                {checkResult.ready
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                <div>
                  <p className={`font-bold text-sm ${checkResult.ready ? 'text-green-800' : 'text-red-800'}`}>
                    {checkResult.ready ? t('Ready to generate!') : t('Issues found — fix before generating.')}
                  </p>
                  <p className={`text-xs ${checkResult.ready ? 'text-green-700' : 'text-red-700'}`}>
                    {checkResult.count} {t(checkResult.count !== 1 ? 'issues found' : 'issue found')}
                    {checkResult.shared_teacher_count > 0 && ` · ${t('{{count}} shared teacher(s) across sections', { count: checkResult.shared_teacher_count })}`}
                  </p>
                </div>
              </div>

              {/* Issues list */}
              {checkResult.issues?.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {checkResult.issues.map((issue: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs ${
                        issue.severity === 'error'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {severityIcon(issue.severity)}
                      <div>
                        {issue.class_name && <span className="font-black uppercase tracking-wider mr-2">{issue.class_name}:</span>}
                        {issue.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasWarnings && !hasErrors && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  {t('⚠ Some subjects have no assigned teacher and will appear as')} <strong>{t('TBD')}</strong> {t('on the timetable. You can still generate.')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Generate */}
        <div className="mt-6 pt-6 border-t border-outline-variant/10">
          {genResult ? (
            <div className={`rounded-2xl p-6 border ${genResult.ok !== false ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {genResult.ok !== false ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <p className="font-bold text-green-800">{t('Timetables generated successfully!')}</p>
                  </div>
                  <p className="text-sm text-green-700 whitespace-pre-line">{genResult.message}</p>
                  {genResult.classes && (
                    <div className="mt-4 space-y-1.5">
                      {genResult.classes.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2 text-xs font-semibold text-green-800 border border-green-100">
                          <span>{c.class_name}</span>
                          <span>{c.slots} {t('slots')} · {c.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => onDone(genResult)}
                    className="mt-5 w-full py-3 bg-green-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-md"
                  >
                    {t('View Timetables →')}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <p className="font-bold text-red-800">{t('Generation failed')}</p>
                  </div>
                  <p className="text-sm text-red-700 whitespace-pre-line">{genResult.message}</p>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating || hasErrors}
              className="w-full py-5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:opacity-90 active:scale-[.99] transition-all disabled:opacity-40 flex items-center justify-center gap-3"
            >
              {generating
                ? <><RefreshCw className="w-5 h-5 animate-spin" /> {t('Solving — this may take a moment…')}</>
                : <><Sparkles className="w-5 h-5" /> {t('Generate Timetables for Whole Section')}</>}
            </button>
          )}
          {hasErrors && !genResult && (
            <p className="text-xs text-red-600 text-center mt-2">{t('Fix the errors above before generating.')}</p>
          )}
          {!checkResult && !genResult && (
            <p className="text-xs text-outline text-center mt-2">{t('Run the feasibility check first (optional but recommended).')}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} disabled={generating} className="px-6 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all disabled:opacity-40">
          {t('← Back')}
        </button>
      </div>
    </div>
  );
}
