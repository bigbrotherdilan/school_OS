import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useTeacherStore } from '../../../stores/teacherStore';

interface Lesson {
  id: string;
  title: string;
  is_completed: boolean;
  order: number;
  content_brief?: string;
  module: string;
}

interface Module {
  id: string;
  name: string;
  order: number;
  lessons: Lesson[];
}

interface CoverageSummary {
  overall_progress: number;
  total_modules: number;
  total_lessons: number;
  total_completed: number;
  modules: {
    id: string;
    name: string;
    order: number;
    total_lessons: number;
    completed_lessons: number;
    progress: number;
  }[];
}

type ActiveTab = 'curriculum' | 'analytics';

export default function TeacherCoveragePage() {
  const { t } = useTranslation('teacher');
  const [modules, setModules] = useState<Module[]>([]);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('curriculum');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const { activeAssignment } = useTeacherStore();

  // Add Module modal state
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [addingModule, setAddingModule] = useState(false);

  // Inline Add Lesson state - which module is currently adding a lesson
  const [addingLessonModuleId, setAddingLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);

  const fetchCoverage = useCallback(async () => {
    if (!activeAssignment) return;
    setLoading(true);
    try {
      const response = await api.get(`/logbook/modules/?subject=${activeAssignment.subject}&class=${activeAssignment.academic_class}`);
      setModules(response.data.results || response.data);
    } catch (error) {
      console.error("Failed to fetch coverage data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeAssignment]);

  const fetchSummary = useCallback(async () => {
    if (!activeAssignment) return;
    try {
      const response = await api.get(`/logbook/modules/coverage_summary/?subject=${activeAssignment.subject}&class=${activeAssignment.academic_class}`);
      setSummary(response.data);
    } catch (error) {
      console.error("Failed to fetch coverage summary:", error);
    }
  }, [activeAssignment]);

  useEffect(() => {
    fetchCoverage();
    fetchSummary();
  }, [fetchCoverage, fetchSummary]);

  const toggleLesson = async (lesson: Lesson) => {
    // Optimistic update
    setTogglingIds(prev => new Set(prev).add(lesson.id));
    setModules(prev => prev.map(m => ({
      ...m,
      lessons: m.lessons.map(l =>
        l.id === lesson.id ? { ...l, is_completed: !l.is_completed } : l
      )
    })));

    try {
      await api.post(`/logbook/lessons/${lesson.id}/toggle_complete/`);
      // Refresh summary after toggle
      fetchSummary();
    } catch (error) {
      console.error("Failed to toggle lesson:", error);
      // Revert optimistic update on failure
      setModules(prev => prev.map(m => ({
        ...m,
        lessons: m.lessons.map(l =>
          l.id === lesson.id ? { ...l, is_completed: !l.is_completed } : l
        )
      })));
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(lesson.id);
        return next;
      });
    }
  };

  const calculateProgress = (module: Module) => {
    if (module.lessons.length === 0) return 0;
    const completed = module.lessons.filter(l => l.is_completed).length;
    return Math.round((completed / module.lessons.length) * 100);
  };

  const totalProgress = () => {
    const allLessons = modules.flatMap(m => m.lessons);
    if (allLessons.length === 0) return 0;
    const completed = allLessons.filter(l => l.is_completed).length;
    return Math.round((completed / allLessons.length) * 100);
  };

  const getNextLesson = () => {
    for (const module of modules) {
      const next = module.lessons.find(l => !l.is_completed);
      if (next) return { lesson: next, moduleName: module.name };
    }
    return null;
  };

  const handleAddModule = async () => {
    if (!newModuleName.trim() || !activeAssignment) return;
    setAddingModule(true);
    try {
      await api.post('/logbook/modules/', {
        subject: activeAssignment.subject,
        academic_class: activeAssignment.academic_class,
        name: newModuleName.trim(),
        order: modules.length + 1,
      });
      setNewModuleName('');
      setShowAddModule(false);
      fetchCoverage();
      fetchSummary();
    } catch (error) {
      console.error("Failed to add module:", error);
    } finally {
      setAddingModule(false);
    }
  };

  const handleAddLesson = async (moduleId: string) => {
    if (!newLessonTitle.trim()) return;
    setSavingLesson(true);
    try {
      const module = modules.find(m => m.id === moduleId);
      await api.post('/logbook/lessons/', {
        module: moduleId,
        title: newLessonTitle.trim(),
        order: module ? module.lessons.length + 1 : 1,
      });
      setNewLessonTitle('');
      setAddingLessonModuleId(null);
      fetchCoverage();
      fetchSummary();
    } catch (error) {
      console.error("Failed to add lesson:", error);
    } finally {
      setSavingLesson(false);
    }
  };

  if (loading) return (
    <div className="space-y-8 animate-pulse p-2">
      <div className="h-10 w-64 bg-slate-100 rounded-2xl"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="h-48 bg-slate-100 rounded-3xl"></div>
        <div className="h-48 bg-slate-100 rounded-3xl"></div>
        <div className="h-48 bg-slate-100 rounded-3xl"></div>
      </div>
      <div className="h-64 bg-slate-100 rounded-3xl"></div>
    </div>
  );

  const nextUp = getNextLesson();
  const allLessons = modules.flatMap(m => m.lessons);
  const completedLessons = allLessons.filter(l => l.is_completed).length;

  return (
    <div className="space-y-8 sm:space-y-12 pb-24">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 px-1 sm:px-2">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-primary tracking-tighter mb-2">{t('Program Coverage')}</h2>
          <p className="text-slate-500 font-medium text-sm">{activeAssignment?.subject_name} &bull; {activeAssignment?.class_name}</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
           <button
             onClick={() => setActiveTab('curriculum')}
             className={`px-4 sm:px-6 py-2 rounded-xl font-bold text-sm transition-all min-h-[40px] ${activeTab === 'curriculum' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             {t('Curriculum')}
           </button>
           <button
             onClick={() => setActiveTab('analytics')}
             className={`px-4 sm:px-6 py-2 rounded-xl font-bold text-sm transition-all min-h-[40px] ${activeTab === 'analytics' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             {t('Analytics')}
           </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
        <div className="bg-primary-container p-5 sm:p-8 rounded-3xl text-white shadow-premium relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-9xl">analytics</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-4">{t('Overall Completion')}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{totalProgress()}%</span>
            <span className="text-lg font-bold opacity-60">{t('Covered')}</span>
          </div>
          <div className="mt-6 w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div className="bg-secondary-container h-full transition-all duration-1000" style={{ width: `${totalProgress()}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{t('Lessons Logged')}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-primary">{completedLessons}</span>
              <span className="text-lg font-bold text-slate-300">/ {allLessons.length}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-secondary text-xs font-bold">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>{totalProgress() >= 50 ? t('On track for term completion') : t('Keep going - building momentum')}</span>
          </div>
        </div>

        <div className="bg-tertiary-fixed/10 p-5 sm:p-8 rounded-3xl border border-tertiary-fixed/20 shadow-sm flex flex-col justify-between">
           <div>
             <p className="text-[10px] font-black text-on-tertiary-fixed-variant uppercase tracking-[0.2em] mb-4">{t('Next Up')}</p>
             {nextUp ? (
               <>
                 <h4 className="text-xl font-bold text-on-tertiary-fixed">{nextUp.lesson.title}</h4>
                 <p className="text-sm text-on-tertiary-fixed opacity-70 mt-1">{nextUp.moduleName}</p>
               </>
             ) : (
               <>
<h4 className="text-xl font-bold text-on-tertiary-fixed">{t('All Complete!')}</h4>
                  <p className="text-sm text-on-tertiary-fixed opacity-70 mt-1">{t('Every lesson has been covered')}</p>
               </>
             )}
           </div>
           {nextUp && (
<button
                onClick={() => toggleLesson(nextUp.lesson)}
                className="mt-4 w-full py-3 bg-tertiary-fixed text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-95 shadow-sm min-h-[44px]"
              >
                {t('Mark as Covered')}
              </button>
           )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'curriculum' ? (
        /* ========== CURRICULUM TAB ========== */
        <div className="space-y-8">
          <div className="flex items-center justify-between px-1 sm:px-2">
            <h3 className="text-xl sm:text-2xl font-black text-primary tracking-tight">{t('Course Modules')}</h3>
            <button
              onClick={() => setShowAddModule(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-primary/5 text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all min-h-[40px]"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {t('Add Module')}
            </button>
          </div>

          {/* Add Module Modal */}
          {showAddModule && (
            <div className="bg-white rounded-3xl border border-primary/20 shadow-lg p-8 animate-in slide-in-from-top-2 duration-300">
              <h4 className="text-lg font-black text-primary mb-4">{t('New Module')}</h4>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder={t('Module name (e.g., Trigonometry)')}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddModule()}
                  autoFocus
                />
                <button
                  onClick={handleAddModule}
                  disabled={addingModule || !newModuleName.trim()}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-primary/90 transition-all"
                >
                  {addingModule ? t('Saving...') : t('Create')}
                </button>
                <button
                  onClick={() => { setShowAddModule(false); setNewModuleName(''); }}
                  className="px-4 py-3 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {modules.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner border border-slate-100">
                <span className="material-symbols-outlined text-6xl text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>library_books</span>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t('No Curriculum Data Yet')}</h3>
              <p className="text-slate-500 max-w-md mt-4 text-sm leading-relaxed">
                {t('Start building your curriculum by adding modules and lessons. This will track your program coverage throughout the term.')}
              </p>
              <button
                onClick={() => setShowAddModule(true)}
                className="mt-8 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-sm"
              >
                {t('Create First Module')}
              </button>
            </div>
          )}
        
          {/* Modules List */}
          <div className="grid grid-cols-1 gap-6">
            {modules.map((module) => (
              <div key={module.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:border-primary/20 transition-all">
                <div className="p-5 sm:p-8 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-primary font-black shadow-inner border border-slate-100">
                      {module.order}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-primary tracking-tight">{module.name}</h4>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('{{count}} Lessons', { count: module.lessons.length })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('Module Progress')}</p>
                      <p className="text-lg font-black text-primary">{calculateProgress(module)}%</p>
                    </div>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                      <div className="bg-secondary h-full transition-all duration-700" style={{ width: `${calculateProgress(module)}%` }} />
                    </div>
                  </div>
                </div>
                
                <div className="px-5 sm:px-8 pb-5 sm:pb-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                    {module.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => toggleLesson(lesson)}
                        disabled={togglingIds.has(lesson.id)}
                        className={`p-3 sm:p-4 rounded-2xl border border-slate-50 bg-slate-50/30 flex items-center gap-3 sm:gap-4 hover:bg-slate-50 transition-all group/item text-left w-full min-h-[48px] ${togglingIds.has(lesson.id) ? 'opacity-60' : ''}`}
                      >
                         <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-300 ${lesson.is_completed ? 'bg-secondary border-secondary text-white scale-110' : 'border-slate-200 text-transparent group-hover/item:border-primary/30'}`}>
                            <span className="material-symbols-outlined text-sm font-black">check</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate transition-colors ${lesson.is_completed ? 'text-slate-700' : 'text-slate-400'}`}>{lesson.title}</p>
                         </div>
                         {togglingIds.has(lesson.id) && (
                           <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                         )}
                      </button>
                    ))}

                    {/* Inline Add Lesson */}
                    {addingLessonModuleId === module.id ? (
                      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3 animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={newLessonTitle}
                          onChange={(e) => setNewLessonTitle(e.target.value)}
                          placeholder={t('Lesson title...')}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddLesson(module.id);
                            if (e.key === 'Escape') { setAddingLessonModuleId(null); setNewLessonTitle(''); }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddLesson(module.id)}
                          disabled={savingLesson || !newLessonTitle.trim()}
                          className="p-2 bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">{savingLesson ? 'hourglass_top' : 'check'}</span>
                        </button>
                        <button
                          onClick={() => { setAddingLessonModuleId(null); setNewLessonTitle(''); }}
                          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingLessonModuleId(module.id); setNewLessonTitle(''); }}
                        className="p-3 sm:p-4 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 hover:border-primary-fixed hover:text-primary transition-all group/add min-h-[48px]"
                      >
                        <span className="material-symbols-outlined text-sm transition-transform group-hover/add:rotate-90">add</span>
                        <span className="text-xs font-black uppercase tracking-widest">{t('Add Lesson')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ========== ANALYTICS TAB ========== */
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
          <h3 className="text-xl sm:text-2xl font-black text-primary tracking-tight px-1 sm:px-2">{t('Coverage Analytics')}</h3>

          {summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                <AnalyticsCard
                  label={t('Total Modules')}
                  value={summary.total_modules.toString()}
                  icon="folder_open"
                  color="primary"
                />
                <AnalyticsCard
                  label={t('Total Lessons')}
                  value={summary.total_lessons.toString()}
                  icon="menu_book"
                  color="primary"
                />
                <AnalyticsCard
                  label={t('Completed')}
                  value={summary.total_completed.toString()}
                  icon="check_circle"
                  color="secondary"
                />
                <AnalyticsCard
                  label={t('Remaining')}
                  value={(summary.total_lessons - summary.total_completed).toString()}
                  icon="pending"
                  color="tertiary"
                />
              </div>

              {/* Pace Indicator */}
              <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-black text-primary">{t('Coverage Pace')}</h4>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                    summary.overall_progress >= 70 
                      ? 'bg-secondary/10 text-secondary border-secondary/20' 
                      : summary.overall_progress >= 40 
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {summary.overall_progress >= 70 ? 'verified' : summary.overall_progress >= 40 ? 'schedule' : 'warning'}
                    </span>
                    {summary.overall_progress >= 70 ? t('Excellent Pace') : summary.overall_progress >= 40 ? t('On Track') : t('Needs Attention')}
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-1000"
                    style={{ width: `${summary.overall_progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3 text-xs font-bold text-slate-400">
                  <span>0%</span>
                  <span>{t('{{progress}}% Complete', { progress: summary.overall_progress })}</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Per-Module Breakdown */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-8 pb-4">
                  <h4 className="text-lg font-black text-primary mb-2">{t('Module Breakdown')}</h4>
                  <p className="text-xs text-slate-400 font-medium">{t('Individual progress for each curriculum module')}</p>
                </div>
                <div className="px-5 sm:px-8 pb-5 sm:pb-8">
                  <div className="space-y-6">
                    {summary.modules.map((mod) => (
                      <div key={mod.id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white ${mod.progress === 100 ? 'bg-secondary' : 'bg-primary'}`}>
                              {mod.order}
                            </div>
                            <span className="font-bold text-sm text-slate-700">{mod.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-400">{mod.completed_lessons}/{mod.total_lessons}</span>
                            <span className={`text-sm font-black ${mod.progress === 100 ? 'text-secondary' : 'text-primary'}`}>{mod.progress}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${mod.progress === 100 ? 'bg-secondary' : 'bg-primary/70'}`}
                            style={{ width: `${mod.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Completion Projection */}
              <div className="bg-primary-container/10 p-5 sm:p-8 rounded-3xl border border-primary/10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">insights</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-primary mb-1">{t('Projection')}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {summary.overall_progress === 100 
                        ? t('Congratulations! You have achieved full curriculum coverage for this subject. All lessons have been documented and linked to your logbook.')
                        : summary.overall_progress >= 70
                          ? t("You're making excellent progress. At your current pace, you're well on track to complete the remaining {{remaining}} lessons before the end of term.", { remaining: summary.total_lessons - summary.total_completed })
                          : summary.overall_progress >= 30
                            ? t('You have covered {{completed}} of {{total}} lessons. Consider increasing your coverage rate to ensure all topics are addressed by inspection time.', { completed: summary.total_completed, total: summary.total_lessons })
                            : t('Coverage is at an early stage with {{completed}} of {{total}} lessons completed. Prioritize high-coefficient modules to maximize impact.', { completed: summary.total_completed, total: summary.total_lessons })
                      }
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">query_stats</span>
              <p className="text-slate-500 font-medium">{t('Loading analytics data...')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyticsCard({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: string;
  color: 'primary' | 'secondary' | 'tertiary';
}) {
  const { t } = useTranslation('teacher');
  const colorClasses = {
    primary: 'bg-primary/5 text-primary border-primary/10',
    secondary: 'bg-secondary/5 text-secondary border-secondary/10',
    tertiary: 'bg-tertiary-fixed/10 text-on-tertiary-fixed-variant border-tertiary-fixed/20',
  };

  return (
    <div className={`p-6 rounded-2xl border ${colorClasses[color]} transition-all hover:scale-[1.02] duration-200`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}
