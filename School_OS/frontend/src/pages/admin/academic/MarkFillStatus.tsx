import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';
import { useTranslation } from 'react-i18next';

type TeacherInfo = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  subject_id: string | number;
  class_name: string;
  class_id: string | number;
};

type SequenceStats = {
  sequence_id: string | number;
  sequence_name: string;
  is_open: boolean;
  total_teachers: number;
  filled_count: number;
  not_filled_count: number;
  filled_teachers: TeacherInfo[];
  not_filled_teachers: TeacherInfo[];
  avg_score: number | null;
  total_results: number;
};

type TermStats = {
  term_id: string | number;
  term_name: string;
  sequences: SequenceStats[];
};

export default function MarkFillStatus() {
  const { addToast } = useToastStore();
  const { t } = useTranslation('adminAcademicMgmt');
  const { activeSectionId } = useSectionStore();
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);

  const [stats, setStats] = useState<TermStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [activeView, setActiveView] = useState<'by-teacher' | 'by-class'>('by-teacher');

  // Fetch metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [yearsRes, termsRes, classesRes, subjectsRes] = await Promise.all([
          api.get('/academic/academic-years/').catch(() => ({ data: [] })),
          api.get('/academic/terms/').catch(() => ({ data: [] })),
          api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }).catch(() => ({ data: [] })),
          api.get('/academic/subjects/').catch(() => ({ data: [] })),
        ]);
        const yearList = yearsRes.data.results || yearsRes.data || [];
        setYears(yearList);
        const active = yearList.find((y: any) => y.is_active);
        if (active) setSelectedYear(active.id);
        setTerms(termsRes.data.results || termsRes.data || []);
        setClasses(classesRes.data.results || classesRes.data || []);
        setSubjects(subjectsRes.data.results || subjectsRes.data || []);
      } catch { /* silent */ }
    };
    fetchMeta();
  }, [activeSectionId]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSubject) params.append('subject', selectedSubject);
      if (selectedClass) params.append('class', selectedClass);
      params.append('only_open', String(onlyOpen));
      const res = await api.get(`/assessments/mark-windows/mark-filling-stats/?${params.toString()}`);
      setStats(res.data || []);
    } catch {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedTerm, selectedSubject, selectedClass, onlyOpen]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleNotifyAll = async (termId?: string | number, seqId?: string | number) => {
    setNotifying(true);
    try {
      const payload: any = {};
      if (termId) payload.term_id = termId;
      if (seqId) payload.sequence_id = seqId;
      if (selectedClass) payload.class_id = selectedClass;
      const res = await api.post('/assessments/mark-windows/notify-pending-teachers/', payload);
      addToast(res.data.detail || t('Notifications sent!'), 'success');
    } catch {
      addToast(t('Failed to send notifications.'), 'error');
    } finally {
      setNotifying(false);
    }
  };

  // Summary totals
  const totalTeachers = stats.flatMap(t => t.sequences).reduce((s, seq) => s + seq.total_teachers, 0);
  const totalFilled = stats.flatMap(t => t.sequences).reduce((s, seq) => s + seq.filled_count, 0);
  const totalPending = totalTeachers - totalFilled;
  const fillRate = totalTeachers > 0 ? Math.round((totalFilled / totalTeachers) * 100) : 0;

  // Build class-based view
  const classSummary = (() => {
    const map = new Map<string, { class_name: string; filled: Set<string>; pending: Set<string>; sequences: Set<string> }>();
    for (const term of stats) {
      for (const seq of term.sequences) {
        for (const t of seq.filled_teachers) {
          const key = String(t.class_id);
          if (!map.has(key)) map.set(key, { class_name: t.class_name, filled: new Set(), pending: new Set(), sequences: new Set() });
          map.get(key)!.filled.add(`${t.teacher_id}_${t.subject_id}`);
          map.get(key)!.sequences.add(seq.sequence_name);
        }
        for (const t of seq.not_filled_teachers) {
          const key = String(t.class_id);
          if (!map.has(key)) map.set(key, { class_name: t.class_name, filled: new Set(), pending: new Set(), sequences: new Set() });
          map.get(key)!.pending.add(`${t.teacher_id}_${t.subject_id}`);
          map.get(key)!.sequences.add(seq.sequence_name);
        }
      }
    }
    return Array.from(map.values()).map(v => ({
      class_name: v.class_name,
      filled: v.filled.size,
      pending: v.pending.size,
      total: v.filled.size + v.pending.size,
      sequences: Array.from(v.sequences),
    }));
  })();

  const filteredTerms = selectedYear
    ? terms.filter((term: any) => term.academic_year === selectedYear || term.academic_year === parseInt(selectedYear))
    : terms;

  return (
    <div className="p-4 lg:p-10 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Mark Entry')}</span>
          <h1 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Mark Fill Status')}</h1>
          <p className="text-on-surface-variant text-lg mt-2">
            {t('Track which teachers have submitted marks and which are still pending.')}
          </p>
        </div>
        <button
          onClick={() => handleNotifyAll()}
          disabled={notifying || totalPending === 0}
          className="flex items-center gap-2 px-5 py-3 bg-error text-white rounded-xl font-semibold shadow-lg shadow-error/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span className="material-symbols-outlined text-lg">{notifying ? 'sync' : 'send'}</span>
          {notifying ? t('Sending...') : t('Notify All Pending ({{count}})', { count: totalPending })}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">{t('Academic Year')}</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-3 py-2.5 focus:ring-primary shadow-sm">
              <option value="">{t('All Years')}</option>
              {years.map((y: any) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? t(' (Active)') : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">{t('Term')}</label>
            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-3 py-2.5 focus:ring-primary shadow-sm">
              <option value="">{t('All Terms')}</option>
              {filteredTerms.map((term: any) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">{t('Subject')}</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-3 py-2.5 focus:ring-primary shadow-sm">
              <option value="">{t('All Subjects')}</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">{t('Class')}</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-3 py-2.5 focus:ring-primary shadow-sm">
              <option value="">{t('All Classes')}</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setOnlyOpen(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${onlyOpen ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${onlyOpen ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant">{t('Open Only')}</span>
          </label>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Fill Rate', value: `${fillRate}%`, sub: 'Overall completion', color: fillRate >= 80 ? 'text-secondary' : fillRate >= 50 ? 'text-primary' : 'text-error', bg: fillRate >= 80 ? 'bg-secondary/10 border-secondary/20' : fillRate >= 50 ? 'bg-primary/10 border-primary/20' : 'bg-error/10 border-error/20' },
          { label: 'Filled', value: totalFilled, sub: 'Assignments complete', color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/20' },
          { label: 'Pending', value: totalPending, sub: 'Still outstanding', color: 'text-error', bg: 'bg-error/10 border-error/20' },
          { label: 'Total Assignments', value: totalTeachers, sub: 'Across open sequences', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
        ].map(kpi => (
          <div key={kpi.label} className={`p-5 rounded-2xl border ${kpi.bg}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{t(kpi.label)}</p>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-on-surface-variant mt-1">{t(kpi.sub)}</p>
          </div>
        ))}
      </div>

      {/* Fill Rate Bar */}
      {totalTeachers > 0 && (
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-on-surface">{t('Overall Progress')}</span>
            <span className={fillRate >= 80 ? 'text-secondary' : fillRate >= 50 ? 'text-primary' : 'text-error'}>{fillRate}%</span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${fillRate >= 80 ? 'bg-secondary' : fillRate >= 50 ? 'bg-primary' : 'bg-error'}`}
              style={{ width: `${fillRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
            <span>{t('{{count}} submitted', { count: totalFilled })}</span>
            <span>{t('{{count}} pending', { count: totalPending })}</span>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2 border-b border-outline-variant/15">
        {(['by-teacher', 'by-class'] as const).map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeView === v ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-lg">{v === 'by-teacher' ? 'person' : 'class'}</span>
            {v === 'by-teacher' ? t('By Teacher & Sequence') : t('By Class')}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
          <span className="ml-3 text-on-surface-variant font-medium">{t('Loading status...')}</span>
        </div>
      )}

      {/* By Teacher View */}
      {!loading && activeView === 'by-teacher' && (
        <div className="space-y-6">
          {stats.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4 block">lock_clock</span>
              <p className="text-lg font-semibold text-on-surface mb-1">{t('No Open Sequences Found')}</p>
              <p className="text-sm">{t('Adjust your filters or open a sequence from the Exam Workflow page.')}</p>
            </div>
          ) : stats.map(term => (
            <div key={term.term_id} className="space-y-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                {term.term_name}
              </h2>
              {term.sequences.map(seq => (
                <div key={seq.sequence_id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
                  {/* Sequence header */}
                  <div className="p-5 bg-surface-container-low/40 border-b border-outline-variant/15 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-on-surface">{seq.sequence_name}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${seq.is_open ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                        {seq.is_open ? t('Open') : t('Closed')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xl font-black text-primary">{seq.filled_count}/{seq.total_teachers}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t('Teachers Filled')}</p>
                      </div>
                      {seq.not_filled_count > 0 && (
                        <button
                          onClick={() => handleNotifyAll(term.term_id, seq.sequence_id)}
                          disabled={notifying}
                          title={t('Notify pending teachers')}
                          className="flex items-center gap-1.5 px-3 py-2 bg-error/10 text-error border border-error/20 rounded-xl text-xs font-bold hover:bg-error hover:text-white transition-all disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">send</span>
                          {t('Notify {{count}}', { count: seq.not_filled_count })}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fill progress bar */}
                  <div className="px-5 py-3 bg-surface-container-low/20 border-b border-outline-variant/10">
                    <div className="w-full bg-surface-container rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-secondary transition-all duration-500"
                        style={{ width: seq.total_teachers > 0 ? `${(seq.filled_count / seq.total_teachers) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-outline-variant/10">
                    {/* Pending teachers */}
                    {seq.not_filled_teachers.length > 0 && (
                      <div className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-error mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">pending</span>
                          {t('Pending ({{count}})', { count: seq.not_filled_count })}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {seq.not_filled_teachers.map(teacher => (
                            <div key={teacher.id} className="flex items-center gap-2 bg-error/5 border border-error/15 rounded-xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-error/15 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-black text-error">{teacher.name[0]}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-on-surface truncate">{teacher.name}</p>
                                <p className="text-[11px] text-on-surface-variant truncate">{teacher.subject} · {teacher.class_name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filled teachers */}
                    {seq.filled_teachers.length > 0 && (
                      <div className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          {t('Submitted ({{count}})', { count: seq.filled_count })}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {seq.filled_teachers.map(teacher => (
                            <div key={teacher.id} className="flex items-center gap-2 bg-secondary/5 border border-secondary/15 rounded-xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-black text-secondary">{teacher.name[0]}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-on-surface truncate">{teacher.name}</p>
                                <p className="text-[11px] text-on-surface-variant truncate">{teacher.subject} · {teacher.class_name}</p>
                              </div>
                              <span className="material-symbols-outlined text-secondary text-base ml-auto flex-shrink-0">check_circle</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* By Class View */}
      {!loading && activeView === 'by-class' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          {classSummary.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4 block">class</span>
              <p className="text-lg font-semibold text-on-surface mb-1">{t('No Data')}</p>
              <p className="text-sm">{t('No class data available for current filters.')}</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-outline-variant/15 bg-surface-container-low/30">
                <h2 className="text-base font-bold text-on-surface">{t('Class Completion Overview')}</h2>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">{t('Class')}</th>
                    <th className="p-4">{t('Progress')}</th>
                    <th className="p-4">{t('Submitted')}</th>
                    <th className="p-4">{t('Pending')}</th>
                    <th className="p-4 pr-6">{t('Sequences')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {classSummary.map((cls, i) => {
                    const pct = cls.total > 0 ? Math.round((cls.filled / cls.total) * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-4 pl-6 font-semibold text-on-surface">{cls.class_name}</td>
                        <td className="p-4 w-48">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-container rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-secondary' : pct >= 50 ? 'bg-primary' : 'bg-error'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-on-surface-variant w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-secondary">{cls.filled}</td>
                        <td className="p-4">
                          <span className={`font-bold ${cls.pending > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{cls.pending}</span>
                        </td>
                        <td className="p-4 pr-6">
                          <div className="flex flex-wrap gap-1">
                            {cls.sequences.map(s => (
                              <span key={s} className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant">{s}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
