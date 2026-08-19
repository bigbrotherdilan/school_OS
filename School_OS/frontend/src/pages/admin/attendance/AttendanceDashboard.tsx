import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';

interface Stats {
  total_sessions: number;
  attendance_rate: number;
  present_count: number;
  absent_count: number;
  at_risk_count: number;
  sessions_by_class: any[];
}

export default function AttendanceDashboard() {
  const { t } = useTranslation('adminFinance');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metadata, setMetadata] = useState<{ classes: any[], subjects: any[], teachers: any[], terms: any[] }>({ classes: [], subjects: [], teachers: [], terms: [] });
  const [formData, setFormData] = useState({ classId: '', subjectId: '', teacherId: '', termId: '', date: new Date().toISOString().split('T')[0], startTime: '' });
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToastStore();
  const { activeSectionId } = useSectionStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, sessionsRes, classesRes, subjectsRes, staffRes, termsRes] = await Promise.all([
          api.get('/attendance/sessions/dashboard-stats/'),
          api.get('/attendance/sessions/'),
          api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
          api.get('/academic/subjects/'),
          api.get('/staff/teachers/'),
          api.get('/academic/terms/')
        ]);
        setStats(statsRes.data);
        setRecentSessions(sessionsRes.data.results || sessionsRes.data);
        setMetadata({
          classes: classesRes.data.results || classesRes.data,
          subjects: subjectsRes.data.results || subjectsRes.data,
          teachers: staffRes.data.results || staffRes.data,
          terms: termsRes.data.results || termsRes.data
        });
      } catch (err) {
        console.error('Failed to fetch attendance data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeSectionId]);

  const handleExportReport = async () => {
    try {
      addToast(t('Preparing attendance report export...'), 'info');
      const response = await api.get('/attendance/sessions/export/', { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      addToast(t('Attendance report ready for review.'), 'success');
    } catch (err) {
      addToast(t('Failed to generate report.'), 'error');
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block tracking-wider">{t('Daily Register')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('School Attendance Register')}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{t('Monitor daily presence, track absenteeism, and analyze attendance trends across all classes.')}</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={handleExportReport}
             className="bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-surface-container-highest transition-all">
            <span className="material-symbols-outlined text-lg">download</span>
            {t('Export Report')}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            {t('New Session')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">sync</span>
          <p className="text-lg font-medium">{t('Synchronizing records...')}</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-primary-container/30 border border-primary/10 rounded-2xl p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-sm mb-1 uppercase tracking-wider">{t('Avg. Presence Rate')}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-on-surface">{stats?.attendance_rate?.toFixed(1)}%</h3>
                  <span className="text-success text-sm font-bold flex items-center">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    {t('Stable')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-secondary-container/30 border border-secondary/10 rounded-2xl p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-secondary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-secondary/20">
                <span className="material-symbols-outlined text-3xl">history_edu</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-sm mb-1 uppercase tracking-wider">{t('Sessions Recorded')}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-on-surface">{stats?.total_sessions}</h3>
                  <p className="text-on-surface-variant/70 text-xs text-sm">{t('Valid this term')}</p>
                </div>
              </div>
            </div>

            <div className="bg-tertiary-container/30 border border-tertiary/10 rounded-2xl p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-tertiary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-tertiary/20">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-sm mb-1 uppercase tracking-wider">{t('Critical Absenteeism')}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-on-surface">{stats?.at_risk_count ?? '-'}</h3>
                  <p className="text-on-surface-variant/70 text-xs text-sm">{t('Students flagged')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Sessions Table */}
            <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 className="text-xl font-bold text-on-surface">{t('Recent Attendance Logs')}</h3>
                <button className="text-primary font-bold text-sm hover:underline">{t('View All')}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Date & Time')}</th>
                      <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Class')}</th>
                      <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Subject')}</th>
                      <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Teacher')}</th>
                      <th className="text-right py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {recentSessions.length > 0 ? recentSessions.slice(0, 8).map((session, i) => (
                      <tr key={i} className="hover:bg-surface-container-high/30 transition-colors group">
                        <td className="py-4 px-8">
                          <div className="flex flex-col">
                            <span className="font-medium text-on-surface">{new Date(session.date).toLocaleDateString()}</span>
                            <span className="text-xs text-on-surface-variant">{session.start_time || t('N/A')}</span>
                          </div>
                        </td>
                        <td className="py-4 px-8">
                           <span className="px-3 py-1 bg-secondary-container/50 text-on-secondary-container rounded-full text-xs font-bold">
                            {session.academic_class_details?.name || t('Class')}
                          </span>
                        </td>
                        <td className="py-4 px-8 font-medium text-on-surface">{session.subject_details?.name || t('Subject')}</td>
                        <td className="py-4 px-8 text-on-surface-variant">{session.teacher_details?.user_details?.full_name || t('Teacher')}</td>
                        <td className="py-4 px-8 text-right">
                          <button className="p-2 rounded-lg hover:bg-surface-container-highest transition-all opacity-0 group-hover:opacity-100">
                             <span className="material-symbols-outlined text-outline">visibility</span>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-on-surface-variant">{t('No attendance records found.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance by Class */}
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-8">
              <h3 className="text-xl font-bold text-on-surface mb-6">{t('Attendance by Class')}</h3>
              <div className="space-y-6">
                {(stats?.sessions_by_class || []).map((item: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="font-bold text-on-surface">{item.academic_class__name}</span>
                      <span className="text-sm font-bold text-primary">{item.avg_rate.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000" 
                        style={{ width: item.avg_rate + '%' }}
                      ></div>
                    </div>
                  </div>
                ))}
                {(!stats?.sessions_by_class || stats.sessions_by_class.length === 0) && (
                   <div className="text-center py-8 text-on-surface-variant italic">
                    <p>{t('No class metrics available yet.')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {/* New Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary text-white">
              <div>
                <h3 className="text-2xl font-bold">{t('New Attendance Session')}</h3>
                <p className="text-blue-100 text-sm">{t('Initiate real-time tracking for a class')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            
            <form className="p-8 space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              if (!formData.classId || !formData.subjectId || !formData.teacherId || !formData.termId) {
                addToast(t('Please fill in all required fields.'), 'error');
                return;
              }
              setSubmitting(true);
              try {
                await api.post('/attendance/sessions/', {
                  academic_class: formData.classId,
                  subject: formData.subjectId,
                  teacher: formData.teacherId,
                  term: formData.termId,
                  date: formData.date,
                  start_time: formData.startTime || null,
                });
                addToast(t('Attendance session started. Students can now be marked present.'), 'success');
                setIsModalOpen(false);
                setFormData({ classId: '', subjectId: '', teacherId: '', termId: '', date: new Date().toISOString().split('T')[0], startTime: '' });
                const [statsRes, sessionsRes] = await Promise.all([
                  api.get('/attendance/sessions/dashboard-stats/'),
                  api.get('/attendance/sessions/')
                ]);
                setStats(statsRes.data);
                setRecentSessions(sessionsRes.data.results || sessionsRes.data);
              } catch {
                addToast(t('Failed to initialize session.'), 'error');
              } finally {
                setSubmitting(false);
              }
            }}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Session Date')}</label>
                  <input 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Academic Class')}</label>
                  <select 
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  >
                    <option value="">{t('Select Class')}</option>
                    {metadata.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Subject / Course')}</label>
                <select 
                  value={formData.subjectId}
                  onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">{t('Select Subject')}</option>
                  {metadata.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Assigned Teacher')}</label>
                <select 
                  value={formData.teacherId}
                  onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">{t('Select Teacher')}</option>
                  {metadata.teachers.map(t => <option key={t.id} value={t.id}>{t.user_details?.full_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Term / Sequence')}</label>
                  <select
                    value={formData.termId}
                    onChange={(e) => setFormData({...formData, termId: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  >
                    <option value="">{t('Select Term')}</option>
                    {metadata.terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">{t('Start Time')}</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95"
                >
                  {t('Cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? t('Launching...') : t('Launch Session')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}