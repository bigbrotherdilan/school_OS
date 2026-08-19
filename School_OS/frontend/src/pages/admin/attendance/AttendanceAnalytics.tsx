import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useSectionStore } from '../../../stores/sectionStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';

interface SessionRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  student?: { id: string; full_name?: string; first_name?: string; last_name?: string };
  student_name?: string;
  academic_class_details?: { id: string; name: string };
  academic_class?: string;
}

interface DashboardStats {
  total_sessions: number;
  attendance_rate: number;
  present_count: number;
  absent_count: number;
  at_risk_count: number;
  sessions_by_class: { academic_class__name: string; avg_rate: number; total: number; present: number }[];
}

interface Term { id: string; name: string; }
interface ClassItem { id: string; name: string; }

const PIE_COLORS = ['#2E7D32', '#C62828', '#F57F17'];

export default function AttendanceAnalytics() {
  const { t } = useTranslation('adminFinance');
  const { activeSectionId } = useSectionStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [termsRes, classesRes, statsRes, sessionsRes] = await Promise.all([
          api.get('/academic/terms/'),
          api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
          api.get('/attendance/sessions/dashboard-stats/'),
          api.get('/attendance/sessions/')
        ]);
        setTerms(termsRes.data.results || termsRes.data);
        setClasses(classesRes.data.results || classesRes.data);
        setStats(statsRes.data);
        setSessions(sessionsRes.data.results || sessionsRes.data);
      } catch (err) {
        console.error('Failed to load analytics data', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, [activeSectionId]);

  useEffect(() => {
    if (!selectedTerm && !selectedClass) return;
    const fetchFiltered = async () => {
      setFetchingData(true);
      try {
        const params: Record<string, string> = {};
        if (selectedTerm) params.term = selectedTerm;
        if (selectedClass) params.class = selectedClass;
        const [statsRes, sessionsRes] = await Promise.all([
          api.get('/attendance/sessions/dashboard-stats/', { params }),
          api.get('/attendance/sessions/', { params })
        ]);
        setStats(statsRes.data);
        setSessions(sessionsRes.data.results || sessionsRes.data);
      } catch (err) {
        console.error('Failed to fetch filtered data', err);
      } finally {
        setFetchingData(false);
      }
    };
    fetchFiltered();
  }, [selectedTerm, selectedClass]);

  const attendanceRate = stats?.attendance_rate ?? 0;
  const totalSessions = stats?.total_sessions ?? 0;
  const atRiskCount = stats?.at_risk_count ?? 0;
  const presentCount = stats?.present_count ?? 0;
  const avgDailyAttendance = totalSessions > 0 ? (presentCount / totalSessions) : 0;

  const rateColor = attendanceRate >= 90 ? 'text-success' : attendanceRate >= 80 ? 'text-orange-500' : 'text-error';
  const rateBg = attendanceRate >= 90 ? 'bg-success/10 border-success/15' : attendanceRate >= 80 ? 'bg-orange-500/10 border-orange-500/15' : 'bg-error/10 border-error/15';
  const rateIconBg = attendanceRate >= 90 ? 'bg-success' : attendanceRate >= 80 ? 'bg-orange-500' : 'bg-error';

  const barData = (stats?.sessions_by_class || []).map(item => ({
    name: item.academic_class__name,
    rate: item.avg_rate ?? (item.total > 0 ? (item.present / item.total) * 100 : 0),
  }));

  const statusCounts = sessions.reduce((acc, s) => {
    const st = s.status || 'absent';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: t('Present'), value: statusCounts['present'] || 0 },
    { name: t('Absent'), value: statusCounts['absent'] || 0 },
    { name: t('Late'), value: statusCounts['late'] || 0 },
  ].filter(d => d.value > 0);

  const atRiskStudents = (() => {
    const studentMap = new Map<string, { name: string; className: string; absentCount: number; totalRecords: number }>();
    sessions.forEach(s => {
      const studentId = s.student?.id || s.student_name;
      if (!studentId) return;
      const key = `${studentId}-${s.academic_class_details?.id || s.academic_class || ''}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          name: s.student?.full_name || s.student_name || `${s.student?.first_name || ''} ${s.student?.last_name || ''}`.trim(),
          className: s.academic_class_details?.name || '',
          absentCount: 0,
          totalRecords: 0,
        });
      }
      const entry = studentMap.get(key)!;
      entry.totalRecords++;
      if (s.status === 'absent') entry.absentCount++;
    });
    return Array.from(studentMap.values())
      .map(s => ({
        ...s,
        absenceRate: s.totalRecords > 0 ? (s.absentCount / s.totalRecords) * 100 : 0,
      }))
      .filter(s => s.absenceRate >= 20 || s.absentCount >= 3)
      .sort((a, b) => b.absenceRate - a.absenceRate);
  })();

  const getStatusBadge = (rate: number) => {
    if (rate >= 50) return <span className="px-2 py-1 bg-error/15 text-error rounded-full text-xs font-bold">{t('Critical')}</span>;
    if (rate >= 30) return <span className="px-2 py-1 bg-orange-500/15 text-orange-500 rounded-full text-xs font-bold">{t('Warning')}</span>;
    return <span className="px-2 py-1 bg-yellow-500/15 text-yellow-600 rounded-full text-xs font-bold">{t('Monitor')}</span>;
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Analytics')}</span>
        <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Attendance Analytics')}</h2>
        <p className="text-on-surface-variant text-lg mt-2">{t('School-wide attendance trends and at-risk student tracking.')}</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">sync</span>
          <p className="text-lg font-medium">{t('Loading analytics...')}</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="material-symbols-outlined text-on-surface-variant">filter_list</span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm"
            >
              <option value="">{t('All Terms')}</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm"
            >
              <option value="">{t('All Classes')}</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            {fetchingData && (
              <span className="material-symbols-outlined animate-spin text-xl text-primary">sync</span>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`bg-surface-container-lowest rounded-2xl border shadow-sm p-6 flex items-center gap-5 ${rateBg}`}>
              <div className={`w-14 h-14 ${rateIconBg} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-xs uppercase tracking-wider mb-1">{t('Overall Attendance Rate')}</p>
                <h3 className={`text-3xl font-bold ${rateColor}`}>{attendanceRate.toFixed(1)}%</h3>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 flex items-center gap-5">
              <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-3xl">analytics</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-xs uppercase tracking-wider mb-1">{t('Total Sessions')}</p>
                <h3 className="text-3xl font-bold text-on-surface">{totalSessions}</h3>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 flex items-center gap-5">
              <div className="w-14 h-14 bg-error text-white rounded-2xl flex items-center justify-center shadow-lg shadow-error/20">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-xs uppercase tracking-wider mb-1">{t('At-Risk Students')}</p>
                <h3 className="text-3xl font-bold text-on-surface">{atRiskCount || atRiskStudents.length}</h3>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 flex items-center gap-5">
              <div className="w-14 h-14 bg-tertiary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-tertiary/20">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium text-xs uppercase tracking-wider mb-1">{t('Avg. Daily Attendance')}</p>
                <h3 className="text-3xl font-bold text-on-surface">{avgDailyAttendance.toFixed(1)}</h3>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar Chart — Attendance by Class */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
              <h3 className="text-xl font-bold text-on-surface mb-6">{t('Attendance by Class')}</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Bar dataKey="rate" fill="#6750A4" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-on-surface-variant">
                  <p>{t('No class data available.')}</p>
                </div>
              )}
            </div>

            {/* Pie Chart — Attendance Status */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
              <h3 className="text-xl font-bold text-on-surface mb-6">{t('Attendance Status Breakdown')}</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-on-surface-variant">
                  <p>{t('No attendance records to display.')}</p>
                </div>
              )}
            </div>
          </div>

          {/* At-Risk Students Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error">warning</span>
                <h3 className="text-xl font-bold text-on-surface">{t('At-Risk Students')}</h3>
              </div>
              <span className="text-sm text-on-surface-variant font-medium">
                {atRiskStudents.length} {t('students flagged')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Student')}</th>
                    <th className="text-left py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Class')}</th>
                    <th className="text-center py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Absent Count')}</th>
                    <th className="text-center py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Absence Rate')}</th>
                    <th className="text-center py-4 px-8 text-sm font-bold text-on-surface-variant uppercase tracking-wider">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {atRiskStudents.length > 0 ? atRiskStudents.map((student, i) => (
                    <tr key={i} className="hover:bg-surface-container-high/30 transition-colors group">
                      <td className="py-4 px-8 font-medium text-on-surface">{student.name || t('Unknown')}</td>
                      <td className="py-4 px-8">
                        <span className="px-3 py-1 bg-secondary-container/50 text-on-secondary-container rounded-full text-xs font-bold">
                          {student.className}
                        </span>
                      </td>
                      <td className="py-4 px-8 text-center font-bold text-error">{student.absentCount}</td>
                      <td className="py-4 px-8 text-center font-bold text-on-surface">{student.absenceRate.toFixed(1)}%</td>
                      <td className="py-4 px-8 text-center">{getStatusBadge(student.absenceRate)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl text-success mb-2 block">check_circle</span>
                        {t('No at-risk students identified.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
