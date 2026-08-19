import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useTranslation } from 'react-i18next';

interface SchoolSubject {
  id: string;
  name: string;
  code: string | null;
}

interface SchoolClass {
  id: string;
  name: string;
}

interface Lesson {
  id: string;
  module: string;
  title: string;
  content_brief: string;
  order: number;
  is_completed: boolean;
}

interface Module {
  id: string;
  subject: string;
  academic_class: string | null;
  class_name: string | null;
  name: string;
  order: number;
  lessons: Lesson[];
}

interface CoverageRow {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  total_modules: number;
  total_lessons: number;
  completed_lessons: number;
  progress: number;
  next_module_order: number;
}

interface SchoolCoverage {
  results: CoverageRow[];
  total_class_subjects: number;
  total_modules: number;
  total_lessons: number;
  total_completed: number;
  overall_progress: number;
}

type Tab = 'coverage' | 'editor';

export default function CurriculumCoverage() {
  const { addToast } = useToastStore();
  const { t } = useTranslation('adminAcademicMgmt');
  const [tab, setTab] = useState<Tab>('coverage');

  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  // Coverage tab
  const [coverage, setCoverage] = useState<SchoolCoverage | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(true);
  const [drill, setDrill] = useState<CoverageRow | null>(null);
  const [drillModules, setDrillModules] = useState<Module[]>([]);
  const [loadingDrill, setLoadingDrill] = useState(false);

  // Editor tab — one scheme per class + subject
  const [edClass, setEdClass] = useState('');
  const [edSubject, setEdSubject] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingEd, setLoadingEd] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [addingLessonModule, setAddingLessonModule] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  // Assign scheme from another class
  const [showAssign, setShowAssign] = useState(false);
  const [assignSources, setAssignSources] = useState<(CoverageRow & { source_modules: number })[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [subjRes, classRes] = await Promise.all([
        api.get('/academic/subjects/', { params: { school: true } }),
        api.get('/academic/classes/'),
      ]);
      const s = subjRes.data.results || subjRes.data;
      const c = classRes.data.results || classRes.data;
      setSubjects(s);
      setClasses(c);
      setEdClass((prev) => prev || c[0]?.id || '');
      setEdSubject((prev) => prev || s[0]?.id || '');
    } catch (e) {
      console.error('Failed to fetch metadata', e);
      addToast(t('Could not load subjects or classes.'), 'error');
    }
  }, [addToast]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const fetchCoverage = useCallback(async () => {
    setLoadingCoverage(true);
    try {
      const res = await api.get('/logbook/modules/school_coverage/');
      setCoverage(res.data);
    } catch (e) {
      console.error('Failed to fetch coverage', e);
      addToast(t('Could not load work coverage.'), 'error');
    } finally {
      setLoadingCoverage(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (tab === 'coverage') fetchCoverage();
  }, [tab, fetchCoverage]);

  const fetchEditorModules = useCallback(async () => {
    if (!edClass || !edSubject) return;
    setLoadingEd(true);
    try {
      const res = await api.get('/logbook/modules/', { params: { subject: edSubject, class: edClass } });
      setModules(res.data.results || res.data);
      setAddingModule(false);
      setAddingLessonModule(null);
      setNewLessonTitle('');
    } catch (e) {
      console.error('Failed to fetch modules', e);
      addToast(t('Could not load the scheme for this class and subject.'), 'error');
    } finally {
      setLoadingEd(false);
    }
  }, [edClass, edSubject, addToast]);

  useEffect(() => {
    if (tab === 'editor') fetchEditorModules();
  }, [tab, fetchEditorModules]);

  const fetchDrill = useCallback(async (row: CoverageRow) => {
    setLoadingDrill(true);
    try {
      const res = await api.get('/logbook/modules/', { params: { subject: row.subject_id, class: row.class_id } });
      setDrillModules(res.data.results || res.data);
    } catch (e) {
      console.error('Failed to fetch drilldown', e);
      addToast(t('Could not load module breakdown.'), 'error');
    } finally {
      setLoadingDrill(false);
    }
  }, [addToast]);

  // ── Module CRUD ──
  const handleAddModule = async () => {
    if (!edClass || !edSubject || !newModuleName.trim()) return;
    setAddingModule(true);
    try {
      await api.post('/logbook/modules/', {
        subject: edSubject,
        academic_class: edClass,
        name: newModuleName.trim(),
        order: (modules.length ? Math.max(...modules.map((m) => m.order)) : 0) + 1,
      });
      setNewModuleName('');
      addToast(t('Module added. Add lessons to build it up gradually.'), 'success');
      fetchEditorModules();
      fetchCoverage();
    } catch (e: any) {
      addToast(e.response?.data?.detail || t('Could not add the module.'), 'error');
    } finally {
      setAddingModule(false);
    }
  };

  const handleRenameModule = async (module: Module, name: string) => {
    if (!name.trim() || name.trim() === module.name) return;
    setSavingId(module.id);
    try {
      const res = await api.patch(`/logbook/modules/${module.id}/`, { name: name.trim() });
      setModules((prev) => prev.map((m) => (m.id === module.id ? res.data : m)));
    } catch (e: any) {
      addToast(e.response?.data?.detail || t('Could not rename the module.'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteModule = async (module: Module) => {
    if (!window.confirm(t('Delete module "{{name}}" and its {{count}} lesson(s)?', { name: module.name, count: module.lessons.length }))) return;
    setSavingId(module.id);
    try {
      await api.delete(`/logbook/modules/${module.id}/`);
      setModules((prev) => prev.filter((m) => m.id !== module.id));
      addToast(t('Module deleted.'), 'success');
      fetchCoverage();
    } catch (e) {
      addToast(t('Could not delete the module.'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ── Lesson CRUD ──
  const handleAddLesson = async (module: Module) => {
    if (!newLessonTitle.trim()) return;
    try {
      await api.post('/logbook/lessons/', {
        module: module.id,
        title: newLessonTitle.trim(),
        content_brief: '',
        order: (module.lessons.length ? Math.max(...module.lessons.map((l) => l.order)) : 0) + 1,
      });
      setNewLessonTitle('');
      addToast(t('Lesson added.'), 'success');
      fetchEditorModules();
      fetchCoverage();
    } catch (e: any) {
      addToast(e.response?.data?.detail || t('Could not add the lesson.'), 'error');
    }
  };

  const handleSaveLesson = async (lesson: Lesson, field: 'title' | 'content_brief', value: string) => {
    if (field === 'title' && !value.trim()) {
      addToast(t('Lesson title is required.'), 'error');
      return;
    }
    if (value === lesson[field]) return;
    setSavingId(lesson.id);
    try {
      const res = await api.patch(`/logbook/lessons/${lesson.id}/`, { [field]: value });
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, ...res.data } : l)),
      })));
    } catch (e: any) {
      addToast(e.response?.data?.detail || t('Could not save the lesson.'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!window.confirm(t('Delete lesson "{{title}}"?', { title: lesson.title }))) return;
    setSavingId(lesson.id);
    try {
      await api.delete(`/logbook/lessons/${lesson.id}/`);
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: m.lessons.filter((l) => l.id !== lesson.id),
      })));
      addToast(t('Lesson deleted.'), 'success');
      fetchCoverage();
    } catch (e) {
      addToast(t('Could not delete the lesson.'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const editorEnabled = Boolean(edClass && edSubject);
  const selectedClassName = classes.find((c) => c.id === edClass)?.name || '';

  // ── Assign an existing scheme to this class ──
  const loadAssignSources = useCallback(async () => {
    if (!edSubject) return;
    setLoadingAssign(true);
    try {
      const res = await api.get('/logbook/modules/', { params: { subject: edSubject } });
      const allModules: Module[] = res.data.results || res.data;
      const byClass = new Map<string, CoverageRow & { source_modules: number }>();
      for (const m of allModules) {
        if (!m.academic_class || m.academic_class === edClass) continue;
        const cur = byClass.get(m.academic_class) || {
          class_id: m.academic_class,
          class_name: m.class_name || '',
          subject_id: edSubject,
          subject_name: '',
          subject_code: null,
          total_modules: 0,
          total_lessons: 0,
          completed_lessons: 0,
          progress: 0,
          next_module_order: 0,
          source_modules: 0,
        };
        cur.source_modules += 1;
        cur.total_lessons += m.lessons.length;
        cur.completed_lessons += m.lessons.filter((l) => l.is_completed).length;
        byClass.set(m.academic_class, cur);
      }
      const rows = [...byClass.values()];
      rows.forEach((r) => {
        r.progress = r.total_lessons ? Math.round((r.completed_lessons / r.total_lessons) * 100) : 0;
      });
      setAssignSources(rows.sort((a, b) => a.class_name.localeCompare(b.class_name)));
    } catch (e) {
      console.error('Failed to fetch assign sources', e);
      addToast(t('Could not find classes with a scheme for this subject.'), 'error');
    } finally {
      setLoadingAssign(false);
    }
  }, [edSubject, edClass, addToast]);

  const handleAssignFrom = async (sourceClassId: string) => {
    if (!edClass || !edSubject) return;
    const hasExisting = modules.length > 0;
    if (hasExisting && !window.confirm(
      t('{{className}} already has a scheme for this subject.', { className: selectedClassName }) + '\n' + t('Assigning will REPLACE it with the source scheme. Continue?')
    )) return;
    setAssigningId(sourceClassId);
    try {
      const res = await api.post('/logbook/modules/copy-scheme/', {
        subject: edSubject,
        source_class: sourceClassId,
        target_class: edClass,
        overwrite: hasExisting,
      });
      addToast(res.data?.detail || t('Scheme assigned.'), 'success');
      setShowAssign(false);
      fetchEditorModules();
      fetchCoverage();
    } catch (e: any) {
      addToast(e.response?.data?.detail || t('Could not assign the scheme.'), 'error');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Instructional Delivery')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Scheme of Work')}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{t('One yearly scheme per class and subject — build it module by module, lesson by lesson.')}</p>
        </div>
        <div className="flex bg-surface-container-high rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('coverage')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${tab === 'coverage' ? 'bg-white text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {t('Work Coverage')}
          </button>
          <button
            onClick={() => setTab('editor')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${tab === 'editor' ? 'bg-white text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {t('Scheme Editor')}
          </button>
        </div>
      </div>

      {tab === 'coverage' ? (
        <CoverageView
          coverage={coverage}
          loading={loadingCoverage}
          drill={drill}
          drillModules={drillModules}
          loadingDrill={loadingDrill}
          onRefresh={fetchCoverage}
          onDrill={(row) => { setDrill(row); fetchDrill(row); }}
          onCloseDrill={() => setDrill(null)}
          onGoEdit={(class_id?: string, subject_id?: string) => {
            setEdClass(class_id || edClass);
            setEdSubject(subject_id || edSubject);
            setTab('editor');
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Class + Subject selectors — school subjects only */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 flex flex-col md:flex-row gap-4 items-end justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-outline block mb-1">{t('Class')}</label>
                <select value={edClass} onChange={(e) => setEdClass(e.target.value)} className="w-full bg-white border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/30">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-outline block mb-1">{t('Subject')}</label>
                <select value={edSubject} onChange={(e) => setEdSubject(e.target.value)} className="w-full bg-white border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/30">
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAssign(true); loadAssignSources(); }}
                  disabled={!editorEnabled}
                  className="bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-container-highest disabled:opacity-40 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">content_copy</span> {t('Assign from another class')}
                </button>
                <button
                  onClick={() => setAddingModule(true)}
                  disabled={!editorEnabled}
                  className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">add_box</span> {t('Add Module')}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                {t('{{className}} has its own scheme — Form 1 Maths differs from Form 2 Maths. Same-level classes can reuse one scheme.', { className: selectedClassName })}
              </p>
            </div>
          </div>

          {/* Module list */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
              <h3 className="text-xl font-bold text-on-surface">
                {t('{{className}} — {{subjectName}} — Yearly Scheme', { className: selectedClassName, subjectName: subjects.find((s) => s.id === edSubject)?.name || t('Subject') })}
              </h3>
              <span className="text-xs font-bold text-on-surface-variant">{t('{{count}} module(s)', { count: modules.length })}</span>
            </div>

            {loadingEd ? (
              <div className="flex items-center justify-center p-12 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
                {t('Loading...')}
              </div>
            ) : !editorEnabled ? (
              <div className="p-16 text-center text-on-surface-variant">{t('Select a class and subject to begin.')}</div>
            ) : modules.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-outline">account_tree</span>
                </div>
                <h4 className="text-lg font-bold text-on-surface mb-2">{t('No scheme yet for {{className}} — {{subjectName}}', { className: selectedClassName, subjectName: subjects.find((s) => s.id === edSubject)?.name })}</h4>
                <p className="text-sm text-on-surface-variant mb-6 max-w-md">
                  {t('Build it slowly: add a module (a major unit, e.g. "Algebra"), then fill it with lessons over time.')}
                  {t('Or reuse the scheme from another {{className}}-level class if one already exists.', { className: selectedClassName })}
                  {t('The plan is yearly and can be reused for many years.')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => { setShowAssign(true); loadAssignSources(); }}
                    className="bg-surface-container-high text-on-surface px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-container-highest flex items-center justify-center gap-2"
                  >
<span className="material-symbols-outlined text-lg">content_copy</span> {t('Assign from another class')}
                  </button>
                  <button onClick={() => setAddingModule(true)} className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90">
                    {t('Create from scratch')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10 p-4 sm:p-6 space-y-4">
                {addingModule && (
                  <div className="flex gap-2 items-center bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <span className="material-symbols-outlined text-primary">add</span>
                    <input
                      autoFocus
                      value={newModuleName}
                      onChange={(e) => setNewModuleName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddModule()}
                      placeholder={t('Module name, e.g. Algebra, Cell Biology…')}
                      className="flex-1 bg-white border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={handleAddModule} disabled={addingModule || !newModuleName.trim()} className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-40">
                      {addingModule ? t('Adding…') : t('Save')}
                    </button>
                    <button onClick={() => { setAddingModule(false); setNewModuleName(''); }} className="text-on-surface-variant hover:text-on-surface px-2">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                )}

                {modules.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    savingId={savingId}
                    addingLesson={addingLessonModule === m.id}
                    newLessonTitle={newLessonTitle}
                    onNewLessonTitle={setNewLessonTitle}
                    onStartAddLesson={() => { setAddingLessonModule(m.id); }}
                    onCancelAddLesson={() => { setAddingLessonModule(null); setNewLessonTitle(''); }}
                    onSaveLesson={() => handleAddLesson(m)}
                    onRename={handleRenameModule}
                    onDelete={handleDeleteModule}
                    onSaveLessonField={handleSaveLesson}
                    onDeleteLesson={handleDeleteLesson}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign scheme modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-on-surface">{t('Assign an existing scheme')}</h3>
              <button onClick={() => setShowAssign(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">
              {t('Copy the scheme for')} <b>{subjects.find((s) => s.id === edSubject)?.name}</b> {t('from another class')}
              {t('into')} <b>{selectedClassName || t('this class')}</b>. {t('Copies are independent — each class keeps its own progress.')}
              {modules.length > 0 && (
                <span className="block mt-1 text-error">⚠ {t('{{className}} already has modules — assigning will replace them.', { className: selectedClassName })}</span>
              )}
            </p>
            {loadingAssign ? (
              <div className="flex items-center justify-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
                {t('Looking for classes with a scheme…')}
              </div>
            ) : assignSources.length === 0 ? (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                {t('No other class has a scheme for this subject yet.')}
                <br />{t('Build one first, then assign it to the rest.')}
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10 max-h-72 overflow-y-auto rounded-xl border border-outline-variant/15">
                {assignSources.map((s) => (
                  <div key={s.class_id} className="flex items-center gap-4 p-4 hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-on-surface">{s.class_name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {t('{{modules}} module(s) • {{completed}}/{{total}} lessons • {{progress}}%', { modules: s.source_modules, completed: s.completed_lessons, total: s.total_lessons, progress: s.progress })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAssignFrom(s.class_id)}
                      disabled={assigningId !== null}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                      {assigningId === s.class_id && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                      {t('Assign')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageView({ coverage, loading, drill, drillModules, loadingDrill, onRefresh, onDrill, onCloseDrill, onGoEdit }: {
  coverage: SchoolCoverage | null;
  loading: boolean;
  drill: CoverageRow | null;
  drillModules: Module[];
  loadingDrill: boolean;
  onRefresh: () => void;
  onDrill: (row: CoverageRow) => void;
  onCloseDrill: () => void;
  onGoEdit: (class_id?: string, subject_id?: string) => void;
}) {
  const { t } = useTranslation('adminAcademicMgmt');
  const rows = coverage?.results || [];
  const withPlans = rows.filter((r) => r.total_modules > 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('Class × Subject')} value={coverage?.total_class_subjects ?? 0} icon="menu_book" tone="primary" />
        <Kpi label={t('Modules')} value={coverage?.total_modules ?? 0} icon="account_tree" tone="secondary" />
        <Kpi label={t('Lessons')} value={`${coverage?.total_completed ?? 0}/${coverage?.total_lessons ?? 0}`} icon="play_lesson" tone="amber" />
        <Kpi label={t('Coverage')} value={`${coverage?.overall_progress ?? 0}%`} icon="trending_up" tone={(coverage?.overall_progress ?? 0) >= 70 ? 'secondary' : (coverage?.overall_progress ?? 0) >= 40 ? 'amber' : 'error'} />
      </div>

      {/* Coverage table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
          <h3 className="text-xl font-bold text-on-surface">{t('Yearly coverage by class & subject')}</h3>
          <button onClick={onRefresh} className="text-xs font-bold text-primary hover:underline">{t('Refresh')}</button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
            {t('Loading coverage...')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-outline">menu_book</span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-2">{t('No subjects added to the school yet')}</h4>
            <p className="text-sm text-on-surface-variant mb-6 max-w-sm">
              {t('Add subjects in School Setup, then build their yearly scheme here.')}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">{t('Class')}</th>
                <th className="p-4">{t('Subject')}</th>
                <th className="p-4">{t('Modules')}</th>
                <th className="p-4">{t('Lessons')}</th>
                <th className="p-4">{t('Progress')}</th>
                <th className="p-4 text-right pr-6">{t('Detail')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {rows.map((r) => (
                <tr key={`${r.class_id}-${r.subject_id}`} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-4 pl-6 font-semibold text-on-surface">{r.class_name}</td>
                  <td className="p-4 text-sm text-on-surface-variant">
                    {r.subject_name}
                    {r.subject_code && <span className="text-xs text-on-surface-variant font-normal ml-2">({r.subject_code})</span>}
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant">{r.total_modules}</td>
                  <td className="p-4 text-sm text-on-surface-variant">{r.completed_lessons}/{r.total_lessons}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-28 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${r.progress === 100 ? 'bg-secondary' : r.progress > 0 ? 'bg-primary' : 'bg-outline/40'}`} style={{ width: `${r.progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-primary">{r.progress}%</span>
                    </div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {r.total_modules === 0 ? (
                      <button onClick={() => onGoEdit(r.class_id, r.subject_id)} className="text-primary text-xs font-bold hover:underline">
                        {t('Build scheme')}
                      </button>
                    ) : (
                      <button onClick={() => onDrill(r)} className="text-primary text-xs font-bold hover:underline">
                        {t('View modules')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {withPlans.length === 0 && rows.length > 0 && (
          <div className="p-6 text-center text-sm text-on-surface-variant">
            {t('Nothing planned yet — open the')} <button onClick={() => onGoEdit()} className="text-primary font-bold hover:underline">{t('Scheme Editor')}</button> {t('and add the first module for a class and subject.')}
          </div>
        )}
      </div>

      {/* Drilldown — modules & lessons of one class + subject */}
      {drill && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-lg font-bold text-on-surface">{t('{{className}} — {{subjectName}} modules & lessons', { className: drill.class_name, subjectName: drill.subject_name })}</h3>
            <button onClick={onCloseDrill} className="text-xs font-bold text-on-surface-variant hover:text-on-surface">{t('Close')}</button>
          </div>
          {loadingDrill ? (
            <div className="p-10 text-center text-on-surface-variant">{t('Loading modules...')}</div>
          ) : drillModules.length === 0 ? (
            <div className="p-10 text-center text-on-surface-variant">{t('No modules planned.')}</div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4">
              {drillModules.map((m) => {
                const done = m.lessons.filter((l) => l.is_completed).length;
                const pct = m.lessons.length ? Math.round((done / m.lessons.length) * 100) : 0;
                return (
                  <div key={m.id} className="border border-outline-variant/15 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-3 bg-surface-container-low/50 px-4 py-3">
                      <p className="font-bold text-on-surface">
                        <span className="text-outline mr-2">{m.order}.</span>{m.name}
                      </p>
                      <span className="text-[11px] font-bold text-on-surface-variant">{t('{{done}}/{{total}} lessons • {{pct}}%', { done, total: m.lessons.length, pct })}</span>
                    </div>
                    {m.lessons.length > 0 && (
                      <ul className="divide-y divide-outline-variant/10">
                        {m.lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${l.is_completed ? 'bg-secondary' : 'bg-outline/40'}`} />
                            <span className={`text-sm flex-1 ${l.is_completed ? 'text-on-surface-variant line-through decoration-secondary/60' : 'text-on-surface'}`}>{l.title}</span>
                            {l.content_brief && <span className="text-xs text-on-surface-variant max-w-md truncate hidden sm:block">{l.content_brief}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module, savingId, addingLesson, newLessonTitle, onNewLessonTitle, onStartAddLesson, onCancelAddLesson, onSaveLesson, onRename, onDelete, onSaveLessonField, onDeleteLesson }: {
  module: Module;
  savingId: string | null;
  addingLesson: boolean;
  newLessonTitle: string;
  onNewLessonTitle: (v: string) => void;
  onStartAddLesson: () => void;
  onCancelAddLesson: () => void;
  onSaveLesson: () => void;
  onRename: (m: Module, name: string) => void;
  onDelete: (m: Module) => void;
  onSaveLessonField: (l: Lesson, field: 'title' | 'content_brief', value: string) => void;
  onDeleteLesson: (l: Lesson) => void;
}) {
  const { t } = useTranslation('adminAcademicMgmt');
  const [name, setName] = useState(module.name);
  const [dirty, setDirty] = useState(false);
  const done = module.lessons.filter((l) => l.is_completed).length;
  const saving = savingId === module.id;

  const sync = () => {
    if (dirty) { onRename(module, name); setDirty(false); }
  };

  return (
    <div className="border border-outline-variant/15 rounded-2xl overflow-hidden bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-surface-container-low/50">
        <span className="text-outline font-black text-sm">{module.order}.</span>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          onBlur={sync}
          onKeyDown={(e) => e.key === 'Enter' && sync()}
          disabled={saving}
          className="flex-1 bg-transparent border-b border-transparent focus:border-primary/40 text-base font-bold text-on-surface focus:bg-white focus:ring-2 focus:ring-primary/20 px-1 py-1 rounded disabled:opacity-60"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-on-surface-variant">{t('{{done}}/{{total}} lessons', { done, total: module.lessons.length })}</span>
          {saving && <span className="material-symbols-outlined text-xs animate-spin text-primary">sync</span>}
          <button onClick={onStartAddLesson} disabled={saving} className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-primary hover:text-white transition-all flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span> {t('Lesson')}
          </button>
          <button onClick={() => onDelete(module)} disabled={saving} className="text-error/70 hover:text-error text-xs font-bold px-2">{t('Delete')}</button>
        </div>
      </div>

      {module.lessons.length > 0 && (
        <ul className="divide-y divide-outline-variant/10">
          {module.lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} saving={savingId === l.id} onSaveField={onSaveLessonField} onDelete={() => onDeleteLesson(l)} />
          ))}
        </ul>
      )}

      {addingLesson ? (
        <div className="flex gap-2 items-center px-4 py-3 bg-primary/5 border-t border-primary/20">
          <span className="material-symbols-outlined text-primary text-sm">play_lesson</span>
          <input
            autoFocus
            value={newLessonTitle}
            onChange={(e) => onNewLessonTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveLesson()}
            placeholder={t('Lesson title, e.g. Solving linear equations…')}
            className="flex-1 bg-white border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={onSaveLesson} disabled={!newLessonTitle.trim()} className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-40">{t('Add')}</button>
          <button onClick={onCancelAddLesson} className="text-on-surface-variant hover:text-on-surface px-1"><span className="material-symbols-outlined">close</span></button>
        </div>
      ) : null}
    </div>
  );
}

function LessonRow({ lesson, saving, onSaveField, onDelete }: {
  lesson: Lesson;
  saving: boolean;
  onSaveField: (l: Lesson, field: 'title' | 'content_brief', value: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('adminAcademicMgmt');
  const [title, setTitle] = useState(lesson.title);
  const [brief, setBrief] = useState(lesson.content_brief || '');
  const [tDirty, setTDirty] = useState(false);
  const [bDirty, setBDirty] = useState(false);

  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className={`mt-2.5 w-2.5 h-2.5 rounded-full shrink-0 ${lesson.is_completed ? 'bg-secondary' : 'bg-outline/40'}`} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTDirty(true); }}
          onBlur={() => { if (tDirty) { onSaveField(lesson, 'title', title); setTDirty(false); } }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          disabled={saving}
          className={`w-full bg-transparent text-sm font-semibold text-on-surface px-1 py-0.5 rounded border border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${lesson.is_completed ? 'line-through decoration-secondary/60' : ''}`}
        />
        <textarea
          value={brief}
          onChange={(e) => { setBrief(e.target.value); setBDirty(true); }}
          onBlur={() => { if (bDirty) { onSaveField(lesson, 'content_brief', brief); setBDirty(false); } }}
          rows={1}
          placeholder={t('Brief description (optional)')}
          disabled={saving}
          className="w-full bg-transparent text-xs text-on-surface-variant px-1 py-0.5 rounded border border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/20 resize-y disabled:opacity-60"
        />
      </div>
      {saving && <span className="material-symbols-outlined text-xs animate-spin text-primary mt-1.5">sync</span>}
      <button onClick={onDelete} disabled={saving} className="text-error/60 hover:text-error text-xs font-bold mt-1.5">{t('Delete')}</button>
    </li>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number | string; icon: string; tone: 'primary' | 'secondary' | 'amber' | 'error' }) {
  const tones = {
    primary: 'bg-primary/10 text-primary border-primary/10',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    error: 'bg-error/10 text-error border-error/20',
  };
  return (
    <div className={`p-5 rounded-2xl border ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}