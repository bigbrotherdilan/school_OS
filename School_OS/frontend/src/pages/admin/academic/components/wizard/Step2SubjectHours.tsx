import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../../services/api';
import { useToastStore } from '../../../../../stores/toastStore';
import { BookOpen, ChevronDown, ChevronUp, AlertTriangle, Copy, CopyCheck, X } from 'lucide-react';

interface Props {
  sectionId: string | null;
  yearId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2SubjectHours({ sectionId, onNext, onBack }: Props) {
  const [classes, setClasses] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [copying, setCopying] = useState<string | null>(null);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const { t } = useTranslation('adminAcademic');
  const { addToast } = useToastStore();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { loadData(); }, [sectionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (sectionId && sectionId !== 'none') params.stream = sectionId;
      const classRes = await api.get('/academic/classes/', { params });
      const classArr: any[] = classRes.data.results || classRes.data;
      setClasses(classArr);
      if (classArr.length) setExpanded(String(classArr[0].id));

      const entries = await Promise.all(
        classArr.map((c: any) =>
          api.get('/academic/class-subjects/', { params: { academic_class: c.id } })
            .then(r => [String(c.id), r.data.results || r.data] as [string, any[]])
        )
      );
      const byClass: Record<string, any[]> = {};
      for (const [id, subs] of entries) byClass[id] = subs;
      setClassSubjects(byClass);
    } catch {
      addToast(t('Failed to load class subjects.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const patchCs = async (csId: string, classId: string, field: string, value: any) => {
    const key = `${csId}-${field}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.patch(`/academic/class-subjects/${csId}/`, { [field]: value });
      setClassSubjects(prev => ({
        ...prev,
        [classId]: (prev[classId] || []).map(cs => cs.id === csId ? { ...cs, [field]: value } : cs),
      }));
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to save.'), 'error');
    } finally {
      setSaving(s => { const n = { ...s }; delete n[key]; return n; });
    }
  };

  // Classes grouped by level (Form 1 & Form 1 B share the same level)
  const levelGroups = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const c of classes) {
      const key = c.level_order ?? 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [classes]);

  const openCopy = (source: any) => {
    const sourceId = String(source.id);
    const sameLevel = classes
      .filter(c => c.level_order === source.level_order && String(c.id) !== sourceId)
      .map(c => String(c.id));
    setCopySource(sourceId);
    setCopyTargets(sameLevel);
  };

  const toggleTarget = (id: string) => {
    setCopyTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const runCopy = async (source: any) => {
    if (!copyTargets.length) return;
    const sourceId = String(source.id);
    const targets = classes.filter(c => copyTargets.includes(String(c.id)));
    if (!targets.length) return;

    const sourceSubs = classSubjects[sourceId] || [];
    const sourceMap = new Map<string, any>();
    for (const cs of sourceSubs) {
      sourceMap.set(`${cs.subject}:${cs.series || ''}`, cs);
    }

    setCopying(sourceId);
    let patched = 0;
    try {
      for (const target of targets) {
        const targetSubs = classSubjects[String(target.id)] || [];
        const updates: Promise<any>[] = [];
        for (const cs of targetSubs) {
          const src = sourceMap.get(`${cs.subject}:${cs.series || ''}`);
          if (!src) continue;
          const payload: Record<string, any> = {};
          if ((src.weekly_hours ?? 0) !== (cs.weekly_hours ?? 0)) payload.weekly_hours = src.weekly_hours ?? 0;
          if (src.is_double !== cs.is_double) payload.is_double = src.is_double ?? null;
          if (Object.keys(payload).length) updates.push(api.patch(`/academic/class-subjects/${cs.id}/`, payload));
        }
        if (updates.length) await Promise.all(updates);
        patched += updates.length;
        setClassSubjects(prev => ({
          ...prev,
          [String(target.id)]: (prev[String(target.id)] || []).map(cs => {
            const src = sourceMap.get(`${cs.subject}:${cs.series || ''}`);
            return src ? { ...cs, weekly_hours: src.weekly_hours ?? 0, is_double: src.is_double } : cs;
          }),
        }));
      }
      const targetNames = targets.map(c => c.name).join(', ');
      addToast(t("Copied {{name}}'s settings to {{targets}} ({{count}} subject(s) updated).", { name: source.name, targets: targetNames, count: patched }), 'success');
      setCopySource(null);
      setCopyTargets([]);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to copy subject settings.'), 'error');
    } finally {
      setCopying(null);
    }
  };

  const focusNext = (classId: string, currentCsId: number, subs: any[]) => {
    const idx = subs.findIndex(cs => cs.id === currentCsId);
    const next = subs[idx + 1];
    if (next) {
      const ref = inputRefs.current[`${classId}:${next.id}`];
      ref?.focus();
      ref?.select();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t('Step 2: Subject Hours per Class')}</h3>
            <p className="text-sm text-on-surface-variant">{t('Set weekly periods per subject and double-period flags for every class.')}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-on-surface-variant animate-pulse">{t('Loading subjects…')}</div>
        ) : classes.length === 0 ? (
          <div className="py-12 text-center text-outline bg-surface-container-low rounded-2xl">{t('No classes found in this section.')}</div>
        ) : (
          <div className="space-y-6">
            {levelGroups.map(([level, levelClasses]) => (
              <div key={level} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-outline">{t('Level {{level}}', { level })}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {levelClasses.map((c) => (
                      <span key={c.id} className="text-xs font-bold px-2.5 py-1 bg-surface-container rounded-full text-on-surface-variant">{c.name}</span>
                    ))}
                  </div>
                </div>
                {levelClasses.map(cls => {
                  const subs = classSubjects[String(cls.id)] || [];
                  const isOpen = expanded === String(cls.id);
                  const totalPeriods = subs.reduce((s: number, cs: any) => s + (cs.weekly_hours || 0), 0);
                  const tbdCount = subs.filter((cs: any) => (cs.weekly_hours || 0) > 0).length;

                  return (
                    <div key={cls.id} className="border border-outline-variant/15 rounded-2xl overflow-hidden transition-shadow hover:shadow-sm">
                      <button
                        onClick={() => setExpanded(isOpen ? null : String(cls.id))}
                        className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold">{cls.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                            {t('{{count}} periods/wk', { count: totalPeriods })}
                          </span>
                          {tbdCount > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {t('{{count}} subject(s)', { count: tbdCount })}
                            </span>
                          )}
                        </div>
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-on-surface-variant shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="p-4 space-y-2 bg-surface-container-lowest animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                            <p className="text-xs text-on-surface-variant">
                              {t("Classes at the same level usually share the same periods — copy {{name}}'s settings to other classes in this section.", { name: cls.name })}
                            </p>
                            <button
                              onClick={() => openCopy(cls)}
                              className="flex items-center gap-1.5 shrink-0 text-[10px] font-black uppercase tracking-widest text-primary bg-white border border-primary/25 hover:bg-primary/10 px-3.5 py-2 rounded-xl transition-all"
                            >
                              <Copy className="w-3.5 h-3.5" /> {t('Copy settings…')}
                            </button>
                          </div>

                          {copySource === String(cls.id) && (
                            <div className="px-4 py-4 bg-surface-container rounded-xl border border-outline-variant/15 space-y-3 animate-in slide-in-from-top-1 duration-150">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                                  {t("Copy {{name}}'s settings to:", { name: cls.name })}
                                </p>
                                <button
                                  onClick={() => { setCopySource(null); setCopyTargets([]); }}
                                  className="text-on-surface-variant hover:text-error transition-colors"
                                  title={t('Close')}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                {levelGroups.map(([, levelClasses]) => {
                                  const others = levelClasses.filter((c: any) => String(c.id) !== String(cls.id));
                                  if (!others.length) return null;
                                  return (
                                    <div key={`${cls.id}-${others[0].level_order}`}>
                                      {others.map((c: any) => (
                                        <label key={c.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors">
                                          <input
                                            type="checkbox"
                                            checked={copyTargets.includes(String(c.id))}
                                            onChange={() => toggleTarget(String(c.id))}
                                            className="accent-primary w-4 h-4"
                                          />
                                          <span className="text-sm font-semibold">{c.name}</span>
                                          <span className="text-[10px] text-outline">{t('Level {{level}}', { level: c.level_order })}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })}
{classes.filter((c: any) => String(c.id) !== String(cls.id)).length === 0 && (
                  <p className="text-xs text-outline text-center py-2">{t('No other classes in this section.')}</p>
                )}
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  onClick={() => setCopyTargets(classes.filter((c: any) => String(c.id) !== String(cls.id)).map((c: any) => String(c.id)))}
                                  className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
                                >
                                  {t('Select all')}
                                </button>
                                <button
                                  onClick={() => runCopy(cls)}
                                  disabled={!copyTargets.length || copying === String(cls.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-primary hover:bg-primary-dark px-4 py-2 rounded-xl shadow-sm shadow-primary/30 transition-all disabled:opacity-50"
                                >
                                  {copying === String(cls.id)
                                    ? <><CopyCheck className="w-3.5 h-3.5" /> {t('Copying…')}</>
                                    : <><Copy className="w-3.5 h-3.5" /> {t('Copy to {{count}}', { count: copyTargets.length })}</>}
                                </button>
                              </div>
                            </div>
                          )}

                          {subs.length === 0 && (
                            <p className="text-xs text-outline text-center py-6">{t('No subjects linked to this class yet.')}</p>
                          )}
                          {subs.map((cs: any) => (
                            <div key={cs.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10 group">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{cs.subject_name || cs.subject_details?.name}</p>
                                <p className="text-[10px] text-outline">coeff {cs.coefficient}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={() => patchCs(cs.id, String(cls.id), 'is_double', !cs.is_double)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    cs.is_double
                                      ? 'bg-primary text-white shadow-sm shadow-primary/30'
                                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                                  }`}
                                  title="Run as 2 consecutive periods"
                                >
                                  Double
                                </button>
                                <input
                                  ref={el => { inputRefs.current[`${cls.id}:${cs.id}`] = el; }}
                                  type="number"
                                  min={0}
                                  max={20}
                                  defaultValue={cs.weekly_hours ?? 0}
                                  onBlur={e => {
                                    const v = parseInt(e.target.value) || 0;
                                    if (v !== (cs.weekly_hours || 0)) patchCs(cs.id, String(cls.id), 'weekly_hours', v);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                      focusNext(String(cls.id), cs.id, subs);
                                    }
                                  }}
                                  className="w-14 bg-white border border-outline-variant/30 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <span className="text-[10px] text-outline w-12">periods/wk</span>
                                {saving[`${cs.id}-weekly_hours`] && (
                                  <span className="text-[10px] text-primary font-bold animate-pulse">✓</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
