import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentClass } from '../../../hooks/useCurrentClass';
import { api } from '../../../services/api';
import { analyticsApi } from '../../../services/analyticsApi';
import { useTeacherStore } from '../../../stores/teacherStore';

export default function TeacherDashboardHome() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const { currentClass, nextClass, loading } = useCurrentClass();
  const [coveragePercent, setCoveragePercent] = useState(0);
  const { activeAssignment, loading: storeLoading } = useTeacherStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [isLessonLogged, setIsLessonLogged] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [openWindows, setOpenWindows] = useState<any[]>([]);
  const [announcementsCollapsed, setAnnouncementsCollapsed] = useState(() => {
    return localStorage.getItem('teacher_announcements_collapsed') === 'true';
  });
  const [markWindowsCollapsed, setMarkWindowsCollapsed] = useState(false);

  useEffect(() => {
    if (!activeAssignment) return;
    api.get(`/logbook/modules/?subject=${activeAssignment.subject}`).then((res) => {
      const modules = res.data.results || res.data;
      if (modules && modules.length > 0) {
        const allLessons = modules.flatMap((m: any) => m.lessons);
        if (allLessons.length > 0) {
          const completed = allLessons.filter((l: any) => l.is_completed).length;
          setCoveragePercent(Math.round((completed / allLessons.length) * 100));
        }
      }
    }).catch(() => {});
  }, [activeAssignment]);

  useEffect(() => {
    api.get('/reports/analytics/metadata/')
      .then((res) => {
        const allTerms = res.data.terms || [];
        const activeYear = (res.data.academic_years || []).find((y: any) => y.is_active);
        const yearTerms = activeYear
          ? allTerms.filter((t: any) => t.academic_year_id === activeYear.id)
          : allTerms;
        const sorted = yearTerms.sort((a: any, b: any) => a.order_number - b.order_number);
        setTerms(sorted);
        if (sorted.length > 0) {
          setSelectedTerm(sorted[sorted.length - 1].id);
        }
      })
      .catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async (termId?: string) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = termId ? { term_id: termId } : undefined;
      const data = await analyticsApi.getTeacherSummary(params);
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to fetch teacher analytics', err);
      setAnalyticsError(err?.response?.data?.detail || 'Failed to load performance data.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTerm) {
      fetchAnalytics(selectedTerm);
    }
  }, [selectedTerm, fetchAnalytics]);

  useEffect(() => {
    api.get('/notifications/announcements/?audience=teachers&limit=5').then((res) => {
      setAnnouncements(res.data.results || res.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/assessments/mark-windows/?is_open=true').then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setOpenWindows(data);
    }).catch((err) => {
      console.error('Failed to load open mark entry windows:', err);
    });
  }, []);

  const toggleAnnouncements = () => {
    const next = !announcementsCollapsed;
    setAnnouncementsCollapsed(next);
    localStorage.setItem('teacher_announcements_collapsed', String(next));
  };

  if (loading || storeLoading) {
    return (
      <div className="space-y-8 pb-12 animate-pulse">
        <div className="flex items-end justify-between px-2">
          <div className="h-8 w-48 bg-slate-100 rounded-lg" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-slate-50 rounded-2xl" />
          <div className="h-48 bg-slate-50 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!activeAssignment) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner border border-slate-100">
          <span className="material-symbols-outlined text-6xl text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-800">Welcome to School OS</h2>
        <p className="text-slate-500 max-w-md mt-4 text-sm leading-relaxed">
          You don't have any teaching assignments yet. This usually means:
        </p>
        <div className="mt-6 text-left max-w-sm space-y-3">
          {[
            'Your subjects and classes haven\'t been assigned yet',
            'The academic year hasn\'t been set up',
            'Your role may need to be updated',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">info</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">refresh</span> Refresh
          </button>
          <button onClick={() => navigate('/teacher/timetable')} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">calendar_today</span> View Timetable
          </button>
        </div>
      </div>
    );
  }

  const overall = analytics?.overall;
  const subjects = analytics?.subject_performance || [];
  const isClassmaster = analytics?.is_classmaster;
  const classmasterView = analytics?.classmaster_view;
  const rankings = classmasterView?.student_rankings || [];
  const visibleRankings = showAllRankings ? rankings : rankings.slice(0, 10);

  return (
    <div className="space-y-8 sm:space-y-12 pb-12">
      {/* Hero Section: Today's Schedule */}
      <div className="space-y-6">
        <div className="flex items-end justify-between px-2">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">Today's Schedule</h3>
          <span className="text-sm font-bold text-slate-400">{today}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentClass ? (
              <div className="relative overflow-hidden bg-primary-container text-white p-6 rounded-2xl shadow-premium border border-white/5 transition-transform hover:scale-[1.02] duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
                </div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Ongoing</span>
                    <span className="text-primary-fixed font-bold text-sm">{currentClass.endsInMinutes} mins left</span>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-1">{currentClass.subject}</h4>
                    <p className="text-primary-fixed-dim font-medium mb-6 opacity-90">{currentClass.name} &bull; {currentClass.room}</p>
                  </div>
                  <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">group</span>
                      <span className="text-xs font-medium">Class in progress</span>
                    </div>
                    <button className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-bold uppercase transition-colors" onClick={() => navigate('/teacher/logbook')}>Digitize</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 p-6 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center min-h-[180px]">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                <p className="text-slate-500 font-medium text-sm">No active lesson at this time</p>
                <p className="text-slate-400 text-xs mt-1">Check your timetable for today's classes</p>
              </div>
            )}

            {nextClass ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col transition-all hover:shadow-md duration-300 group min-h-[180px]">
                <div className="flex justify-between items-start mb-6">
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200/50">Up Next</span>
                  <span className="text-slate-400 font-bold text-sm">{nextClass.startTime.substring(0, 5)}</span>
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-primary mb-1">{nextClass.subject}</h4>
                  <p className="text-slate-500 font-medium mb-6">{nextClass.name} &bull; {nextClass.room}</p>
                </div>
                <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="material-symbols-outlined text-sm">description</span>
                    <span className="text-xs font-medium">Lesson Plan ready</span>
                  </div>
                  <button className="text-primary text-xs font-bold hover:underline transition-all group-hover:translate-x-1 underline-offset-4" onClick={() => navigate('/teacher/planner')}>View Plan</button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center min-h-[180px]">
                <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">auto_awesome</span>
                <p className="text-slate-400 text-xs font-medium italic">All caught up for today!</p>
              </div>
            )}
          </div>
        </div>

      {/* Announcements & Open Mark Entry Windows */}
      {(announcements.length > 0 || openWindows.length > 0) && (
        <div className="space-y-4 sm:space-y-6 px-1 sm:px-2">
          {openWindows.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden">
              <button
                onClick={() => setMarkWindowsCollapsed(!markWindowsCollapsed)}
                className="w-full flex items-center justify-between p-4 sm:p-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>edit_square</span>
                  <h4 className="text-sm font-bold text-primary">Mark Entry Open</h4>
                  {!markWindowsCollapsed && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{openWindows.length}</span>
                  )}
                </div>
                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${markWindowsCollapsed ? '' : 'rotate-180'}`}>expand_more</span>
              </button>
              {!markWindowsCollapsed && (
                <div className="px-4 pb-4 sm:px-6 sm:pb-6 space-y-2">
                  {openWindows.map((w: any) => (
                    <div key={w.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-primary/10">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{w.sequence_name || `Sequence ${w.sequence}`}</p>
                        <p className="text-xs text-slate-400">{w.term_name || `Term ${w.term}`}</p>
                      </div>
                      <button onClick={() => navigate(`/teacher/assessments?sequence=${w.sequence}`)} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all min-h-[40px]">
                        Enter Marks
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={toggleAnnouncements}
                className="w-full flex items-center justify-between p-4 sm:p-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-xl">campaign</span>
                  <h4 className="text-sm font-bold text-slate-700">Announcements</h4>
                  {announcementsCollapsed && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{announcements.length} new</span>
                  )}
                </div>
                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${announcementsCollapsed ? '' : 'rotate-180'}`}>expand_more</span>
              </button>
              {!announcementsCollapsed && (
                <div className="px-4 pb-4 sm:px-6 sm:pb-6 space-y-3">
                  {announcements.map((a: any) => (
                    <div key={a.id} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-bold text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subject Performance Analytics */}
      <div id="analytics-section" className="space-y-8">
        {/* Term Selector Header */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-bold text-primary tracking-tight">Performance Analytics</h3>
          {terms.length > 0 && (
            <select
              value={selectedTerm}
              onChange={(e) => { setSelectedTerm(e.target.value); setShowAllRankings(false); }}
              className="bg-surface-container-highest rounded-xl px-4 py-2 text-sm font-bold border border-outline-variant/20 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Loading State */}
        {analyticsLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15">
                  <div className="h-3 bg-surface-container-highest rounded w-20 mb-3" />
                  <div className="h-8 bg-surface-container-highest rounded w-16 mb-2" />
                  <div className="h-3 bg-surface-container-highest rounded w-24" />
                </div>
              ))}
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15">
              <div className="h-6 bg-surface-container-highest rounded w-40 mb-6" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 py-4 border-b border-outline-variant/5">
                  <div className="h-4 bg-surface-container-highest rounded flex-1" />
                  <div className="h-4 bg-surface-container-highest rounded w-20" />
                  <div className="h-4 bg-surface-container-highest rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!analyticsLoading && analyticsError && (
          <div className="bg-error/5 border border-error/20 rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-error/60 mb-3 block">error</span>
            <p className="text-sm font-bold text-on-surface">{analyticsError}</p>
            <button onClick={() => fetchAnalytics(selectedTerm)} className="mt-4 px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all">
              Retry
            </button>
          </div>
        )}

        {/* Analytics Content */}
        {!analyticsLoading && !analyticsError && analytics && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {overall && (
                <>
                  <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Overall Average</p>
                    <p className={`text-3xl font-black ${overall.average_percentage >= 70 ? 'text-secondary' : overall.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                      {overall.average_percentage != null ? `${overall.average_percentage}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">{overall.count} total results</p>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Pass Rate</p>
                    <p className={`text-3xl font-black ${overall.pass_rate >= 70 ? 'text-secondary' : overall.pass_rate >= 50 ? 'text-primary' : 'text-error'}`}>
                      {overall.pass_rate != null ? `${overall.pass_rate}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">{overall.pass_count} passed of {overall.count}</p>
                  </div>
                </>
              )}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Assignments</p>
                <p className="text-3xl font-black text-primary">{analytics.assignments_count || subjects.length}</p>
                <p className="text-xs text-on-surface-variant mt-1">active subjects</p>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Curriculum</p>
                <p className="text-3xl font-black text-primary">{coveragePercent}%</p>
                <div className="w-full bg-surface-container rounded-full h-1.5 mt-2">
                  <div className="bg-secondary h-1.5 rounded-full transition-all duration-500" style={{ width: `${coveragePercent}%` }} />
                </div>
          </div>
        </div>

      {/* Subject Performance Analytics */}
            {subjects.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
                  <h3 className="text-lg font-bold text-on-surface">My Subject Performance</h3>
                </div>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-4 pl-6">Subject</th>
                        <th className="p-4">Class</th>
                        <th className="p-4">Students</th>
                        <th className="p-4">Average</th>
                        <th className="p-4">Pass Rate</th>
                        <th className="p-4">Highest</th>
                        <th className="p-4 pr-6">Lowest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {subjects.map((s: any, i: number) => (
                        <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="p-4 pl-6 font-semibold text-on-surface">{s.subject_name}</td>
                          <td className="p-4 text-sm">{s.class_name}</td>
                          <td className="p-4 text-sm">{s.students_with_marks}/{s.total_students}</td>
                          <td className="p-4">
                            <span className={`font-bold ${s.average_percentage >= 70 ? 'text-secondary' : s.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                              {s.average}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-surface-container rounded-full h-1.5 max-w-[60px]">
                                <div className={`h-1.5 rounded-full ${s.pass_rate >= 70 ? 'bg-secondary' : s.pass_rate >= 50 ? 'bg-primary' : 'bg-error'}`}
                                  style={{ width: `${Math.min(s.pass_rate || 0, 100)}%` }} />
                              </div>
                              <span className="text-xs font-semibold">{s.pass_rate}%</span>
                            </div>
                          </td>
                          <td className="p-4 text-secondary font-semibold text-sm">{s.highest}</td>
                          <td className="p-4 pr-6 text-error text-sm">{s.lowest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-outline-variant/10">
                  {subjects.map((s: any, i: number) => (
                    <div key={i} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-on-surface text-sm">{s.subject_name}</p>
                          <p className="text-xs text-on-surface-variant">{s.class_name} &bull; {s.students_with_marks}/{s.total_students} students</p>
                        </div>
                        <span className={`text-lg font-black ${s.average_percentage >= 70 ? 'text-secondary' : s.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                          {s.average}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-on-surface-variant font-medium">Pass:</span>
                          <div className="flex-1 bg-surface-container rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${s.pass_rate >= 70 ? 'bg-secondary' : s.pass_rate >= 50 ? 'bg-primary' : 'bg-error'}`}
                              style={{ width: `${Math.min(s.pass_rate || 0, 100)}%` }} />
                          </div>
                          <span className="font-bold">{s.pass_rate}%</span>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-secondary font-semibold">High: {s.highest}</span>
                        <span className="text-error font-semibold">Low: {s.lowest}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Data State for analytics */}
            {subjects.length === 0 && !isClassmaster && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">analytics</span>
                <p className="text-on-surface-variant font-medium">No performance data for this term yet.</p>
                <p className="text-on-surface-variant/60 text-sm mt-1">Marks will appear here once exam results are entered.</p>
              </div>
            )}

            {/* Classmaster View */}
            {isClassmaster && classmasterView && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-outline-variant/15 bg-secondary-container/20 flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">Classmaster Overview: {classmasterView.class_name}</h3>
                    <p className="text-xs text-on-surface-variant">{classmasterView.section || classmasterView.cycle_name || 'N/A'} | {classmasterView.student_count} students</p>
                  </div>
                </div>
                {rankings.length > 0 ? (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                            <th className="p-4 pl-6">Rank</th>
                            <th className="p-4">Student</th>
                            <th className="p-4">Admission</th>
                            <th className="p-4">Average</th>
                            <th className="p-4">Percentage</th>
                            <th className="p-4 pr-6">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {visibleRankings.map((s: any, i: number) => (
                            <tr key={s.student_id} className={`hover:bg-surface-container-low/50 transition-colors ${i < 3 ? 'bg-secondary-container/10' : ''}`}>
                              <td className="p-4 pl-6">
                                <span className={`text-lg font-black ${i === 0 ? 'text-secondary' : i === 1 ? 'text-primary' : i === 2 ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
                                  #{s.rank}
                                </span>
                              </td>
                              <td className="p-4 font-semibold">{s.student_name}</td>
                              <td className="p-4 text-xs font-mono text-on-surface-variant">{s.admission_number}</td>
                              <td className="p-4 font-bold">{s.average}</td>
                              <td className="p-4">{s.percentage}%</td>
                              <td className="p-4 pr-6">
                                <span className={`px-2 py-1 text-xs font-bold rounded ${
                                  s.grade === 'A' || s.grade === 'TB' ? 'bg-secondary-container text-on-secondary-container' :
                                  s.grade === 'F' ? 'bg-error-container text-error' : 'bg-surface-container-highest text-on-surface-variant'
                                }`}>{s.grade}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-outline-variant/10">
                      {visibleRankings.map((s: any, i: number) => (
                        <div key={s.student_id} className={`p-4 flex items-center gap-4 ${i < 3 ? 'bg-secondary-container/10' : ''}`}>
                          <span className={`text-xl font-black w-8 text-center ${
                            i === 0 ? 'text-secondary' : i === 1 ? 'text-primary' : i === 2 ? 'text-on-tertiary-container' : 'text-on-surface-variant'
                          }`}>
                            {s.rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-on-surface truncate">{s.student_name}</p>
                            <p className="text-[10px] font-mono text-on-surface-variant">{s.admission_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{s.average}</p>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              s.grade === 'A' || s.grade === 'TB' ? 'bg-secondary-container text-on-secondary-container' :
                              s.grade === 'F' ? 'bg-error-container text-error' : 'bg-surface-container-highest text-on-surface-variant'
                            }`}>{s.grade}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {rankings.length > 10 && (
                      <div className="p-4 text-center border-t border-outline-variant/10">
                        <button
                          onClick={() => setShowAllRankings(!showAllRankings)}
                          className="text-primary text-sm font-semibold hover:underline min-h-[44px] inline-flex items-center"
                        >
                          {showAllRankings ? 'Show fewer' : `View all ${rankings.length} students`}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">school</span>
                    <p className="text-on-surface-variant font-medium text-sm">No student rankings available for this term.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Today's Checklist - What to do right now */}
      <div className="space-y-4 sm:space-y-6">
        <div className="px-1 sm:px-2">
          <h3 className="text-xl font-bold text-primary tracking-tight">Today's Checklist</h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">What needs your attention today</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          <ChecklistItem
            icon="edit_square"
            title="Log today's lesson"
            desc={currentClass ? `Record what you covered in ${currentClass.subject}` : 'Record your lesson in the logbook'}
            done={isLessonLogged}
            onClick={() => navigate('/teacher/logbook')}
            urgent={!isLessonLogged && !!currentClass}
          />
          <ChecklistItem
            icon="grade"
            title="Enter marks"
            desc={openWindows.length > 0 ? `${openWindows.length} mark entry window(s) open now` : "Input exam or assessment scores for your classes"}
            onClick={() => navigate('/teacher/assessments')}
            urgent={openWindows.length > 0}
          />
          <ChecklistItem
            icon="how_to_reg"
            title="Take attendance"
            desc={currentClass ? `Mark attendance for ${currentClass.name}` : 'Mark attendance for your next class'}
            onClick={() => navigate('/teacher/timetable')}
          />
          <ChecklistItem
            icon="edit_note"
            title="Prepare lesson plan"
            desc="Draft your 5E lesson plan for upcoming classes"
            onClick={() => navigate('/teacher/planner')}
          />
          <ChecklistItem
            icon="analytics"
            title="Review class performance"
            desc="Check averages, pass rates, and student rankings"
            onClick={() => {
              const el = document.getElementById('analytics-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </div>

      {/* Quick Actions - Grid */}
      <div className="space-y-4 sm:space-y-6">
        <div className="px-1 sm:px-2">
          <h3 className="text-xl font-bold text-primary tracking-tight">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <ToolButton icon="task_alt" label="Logbook" desc="Record lesson" color="secondary" onClick={() => navigate('/teacher/logbook')} />
          <ToolButton icon="menu_book" label="Scheme" desc="Curriculum modules" color="primary" onClick={() => navigate('/teacher/coverage')} />
          <ToolButton icon="how_to_reg" label="Attendance" desc="Mark present/absent" color="primary" onClick={() => navigate('/teacher/timetable')} />
          <ToolButton icon="assignment_add" label="Homework" desc="Set class tasks" color="primary" onClick={() => navigate('/teacher/planner')} />
          <ToolButton icon="grade" label="Marks" desc="Enter scores" color="tertiary" onClick={() => navigate('/teacher/assessments')} />
        </div>
      </div>

      {/* Curriculum Progress - Compact */}
      <div className="bg-primary-container p-6 rounded-2xl text-white relative overflow-hidden shadow-premium">
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold mb-1">Curriculum Progress</h4>
            <p className="text-primary-fixed-dim text-xs opacity-80">{activeAssignment.subject_name} - {activeAssignment.class_name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-3xl font-black">{coveragePercent}%</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-fixed-dim mt-1">{coveragePercent < 100 ? 'In Progress' : 'Complete'}</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-secondary-container flex items-center justify-center">
              <span className="text-lg font-bold">{coveragePercent}%</span>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-4 w-full bg-white/10 h-2 rounded-full overflow-hidden">
          <div className="bg-secondary-container h-full transition-all duration-1000 rounded-full" style={{ width: `${coveragePercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ icon, title, desc, done, onClick, urgent }: { icon: string; title: string; desc: string; done?: boolean; onClick: () => void; urgent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 sm:px-6 py-4 sm:py-5 text-left hover:bg-slate-50/80 transition-colors group min-h-[56px]"
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
        done ? 'bg-secondary/10 text-secondary' : urgent ? 'bg-red-50 text-red-500' : 'bg-primary/5 text-primary'
      }`}>
        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: done ? "'FILL' 1" : "" }}>
          {done ? 'check_circle' : icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
      </div>
      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg">
        chevron_right
      </span>
    </button>
  );
}

function ToolButton({ icon, label, desc, color, onClick }: { icon: string, label: string, desc: string, color: 'primary' | 'secondary' | 'tertiary', onClick?: () => void }) {
  const colorClasses = {
    primary: 'bg-primary/5 text-primary hover:bg-primary hover:text-white',
    secondary: 'bg-secondary/5 text-secondary hover:bg-secondary hover:text-white',
    tertiary: 'bg-tertiary-fixed-dim/10 text-on-tertiary-fixed-variant hover:bg-tertiary-fixed-dim hover:text-white',
  };

  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-4 sm:p-5 min-h-[80px] ${colorClasses[color]} rounded-2xl transition-all duration-300 group`}>
      <span className="material-symbols-outlined text-2xl sm:text-3xl transition-transform group-hover:scale-110 group-hover:-rotate-3">{icon}</span>
      <span className="text-xs font-bold text-center leading-tight">{label}</span>
      <span className="text-[10px] opacity-60 text-center leading-tight hidden sm:block">{desc}</span>
    </button>
  );
}
