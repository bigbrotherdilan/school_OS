import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';
import { useSectionStore } from '../../../stores/sectionStore';
import { api } from '../../../services/api';
import { analyticsApi } from '../../../services/analyticsApi';
import SetupProgressBar from '../../../components/admin/SetupProgressBar';

interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  module: string;
  description: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  created_at: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingIcon(): string {
  const h = new Date().getHours();
  if (h < 12) return 'wb_sunny';
  if (h < 17) return 'wb_cloudy';
  return 'dark_mode';
}

function formatCFA(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M CFA`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K CFA`;
  return `${val} CFA`;
}

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('Just now');
  if (mins < 60) return t('{{mins}}m ago', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{{hrs}}h ago', { hrs });
  const days = Math.floor(hrs / 24);
  return t('{{days}}d ago', { days });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

const MODULE_LABELS: Record<string, string> = {
  STUDENT: 'Students',
  STAFF: 'Staff',
  ACADEMIC: 'Academic',
  ASSESSMENT: 'Assessment',
  FINANCE: 'Finance',
  ATTENDANCE: 'Attendance',
  TIMETABLE: 'Timetable',
  REPORT: 'Reports',
  LOGBOOK: 'Logbook',
  NOTIFICATION: 'Notifications',
  DOCUMENT: 'Documents',
  AUTH: 'Auth',
  SYSTEM: 'System',
  GOVERNMENT: 'Government',
};

const MODULE_ICONS: Record<string, string> = {
  STUDENT: 'school',
  STAFF: 'person',
  ACADEMIC: 'menu_book',
  ASSESSMENT: 'grading',
  FINANCE: 'payments',
  ATTENDANCE: 'how_to_reg',
  TIMETABLE: 'calendar_month',
  REPORT: 'description',
  LOGBOOK: 'book',
  NOTIFICATION: 'notifications',
  DOCUMENT: 'folder',
  AUTH: 'lock',
  SYSTEM: 'settings',
  GOVERNMENT: 'account_balance',
};

const TIME_ESTIMATES: Record<string, number> = {
  'REPORT_CARD_GENERATED': 15,
  'BATCH_REPORT_GENERATED': 15,
  'ATTENDANCE_RECORDED': 2,
  'FEE_PAYMENT_RECORDED': 5,
  'FEE_PAYMENT_CREATED': 5,
  'ANNOUNCEMENT_SENT': 10,
  'STUDENT_ENROLLED': 8,
  'ID_CARD_GENERATED': 3,
  'TEMPLATE_CREATED': 5,
};

function getMinutesForAction(action: string, description: string): number {
  const desc = (description || '').toLowerCase();
  if (desc.includes('report card') || desc.includes('batch generate')) return 15;
  if (desc.includes('attendance')) return 2;
  if (desc.includes('fee') || desc.includes('payment') || desc.includes('transaction')) return 5;
  if (desc.includes('announcement')) return 10;
  if (desc.includes('enroll') || desc.includes('student')) return 8;
  if (desc.includes('id card')) return 3;
  if (desc.includes('template')) return 5;
  if (action in TIME_ESTIMATES) return TIME_ESTIMATES[action];
  return 1;
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const { t } = useTranslation('adminGov');
  const { addToast } = useToastStore();
  const { user, tenants } = useAuthStore();
  const { activeSectionId } = useSectionStore();

  const schoolName = tenants?.[0]?.school_name ?? t('Your School');
  const userName = user?.first_name ?? user?.full_name?.split(' ')[0] ?? t('Admin');

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [feesCollected, setFeesCollected] = useState<number | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [hasFinance, setHasFinance] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditFetched, setAuditFetched] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [timeSaved, setTimeSaved] = useState<number | null>(null);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const [studentsRes, teachersRes, classesRes, financeRes, attendanceRes, sectionsRes] = await Promise.allSettled([
          api.get('/students/students/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
          api.get('/staff/teachers/'),
          api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
          api.get('/finance/summary/'),
          api.get('/attendance/sessions/dashboard-stats/'),
          api.get('/academic/sections/'),
        ]);

        if (studentsRes.status === 'fulfilled') {
          const d = studentsRes.value.data;
          setStudentCount(d.count ?? d.results?.length ?? 0);
        } else {
          setStudentCount(0);
        }

        if (teachersRes.status === 'fulfilled') {
          const d = teachersRes.value.data;
          setTeacherCount(d.count ?? d.results?.length ?? 0);
        } else {
          setTeacherCount(0);
        }

        if (classesRes.status === 'fulfilled') {
          const d = classesRes.value.data;
          setClassCount(d.count ?? d.results?.length ?? 0);
        } else {
          setClassCount(0);
        }

        if (sectionsRes.status === 'fulfilled') {
          const d = sectionsRes.value.data;
          setSectionCount(d.count ?? d.results?.length ?? 0);
        } else {
          setSectionCount(0);
        }

        if (financeRes.status === 'fulfilled') {
          const d = financeRes.value.data;
          setFeesCollected(d.total_revenue ?? 0);
          setOutstanding(d.total_arrears ?? 0);
          setHasFinance(true);
        }

        if (attendanceRes.status === 'fulfilled') {
          const d = attendanceRes.value.data;
          setAttendanceRate(d.attendance_rate ?? null);
        }
      } catch (e) {
        console.error('Failed to fetch KPIs', e);
      } finally {
        setKpiLoading(false);
      }
    };

    fetchKpis();

    // Fetch comprehensive dashboard overview
    analyticsApi.getDashboardOverview().then(setOverview).catch(() => {});
  }, [activeSectionId]);

  useEffect(() => {
    const stored = localStorage.getItem('sos-time-saved-minutes');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        setTimeSaved(parsed);
      }
    }
  }, []);

  const fetchAuditLogs = async () => {
    if (auditFetched) return;
    setAuditLoading(true);
    try {
      const res = await api.get('/audit/logs/');
      const data = res.data.results ?? res.data ?? [];
      const logs = Array.isArray(data) ? data : [];
      setAuditLogs(logs);
      setAuditFetched(true);

      if (logs.length > 0) {
        const totalMinutes = logs.reduce((sum: number, log: AuditLog) => {
          return sum + getMinutesForAction(log.action, log.description);
        }, 0);
        const stored = localStorage.getItem('sos-time-saved-minutes');
        if (!stored) {
          localStorage.setItem('sos-time-saved-minutes', String(totalMinutes));
          setTimeSaved(totalMinutes);
        } else {
          setTimeSaved(parseInt(stored, 10));
        }
      }
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const toggleAudit = () => {
    const next = !showAudit;
    setShowAudit(next);
  };

  const handleExportAudit = async () => {
    try {
      addToast(t('Preparing system audit export...'), 'info');
      const response = await api.get('/audit/export/', { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `system_audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      addToast(t('Audit export downloaded successfully.'), 'success');
    } catch (err) {
      addToast(t('Failed to generate audit export. Please check permissions.'), 'error');
    }
  };

  const quickActions = useMemo(() => {
    const actions: { label: string; detail: string; icon: string; path: string; color: string; urgent: boolean }[] = [];

    if ((sectionCount ?? 0) === 0) {
      actions.push({
        label: t('Create your first section'),
        detail: t('Required before classes, subjects, or students can be set up'),
        icon: 'layers',
        path: '/admin/academic/setup',
        color: 'bg-purple-500',
        urgent: true,
      });
    }

    if (hasFinance && (outstanding ?? 0) > 0) {
      actions.push({
        label: t('Send fee reminders'),
        detail: t('{{amount}} outstanding', { amount: formatCFA(outstanding!) }),
        icon: 'request_quote',
        path: '/admin/finance/arrears',
        color: 'bg-amber-500',
        urgent: true,
      });
    }

    if ((studentCount ?? 0) > 0) {
      actions.push({
        label: t('Generate report cards'),
        detail: t('For all enrolled students'),
        icon: 'description',
        path: '/admin/academic/report-cards',
        color: 'bg-rose-500',
        urgent: false,
      });
    }

    if ((studentCount ?? 0) > 0 && attendanceRate !== null && attendanceRate < 85) {
      actions.push({
        label: t("Check today's attendance"),
        detail: t('{{rate}}% average - below target', { rate: attendanceRate.toFixed(1) }),
        icon: 'how_to_reg',
        path: '/admin/attendance',
        color: 'bg-orange-500',
        urgent: true,
      });
    }

    if ((studentCount ?? 0) === 0) {
      actions.push({
        label: t('Enroll your first student'),
        detail: t('Get your school running'),
        icon: 'person_add',
        path: '/admin/academic/students/new',
        color: 'bg-blue-500',
        urgent: true,
      });
    }

    if ((classCount ?? 0) === 0) {
      actions.push({
        label: t('Create your first class'),
        detail: t('Set up your class structure'),
        icon: 'class',
        path: '/admin/academic/setup',
        color: 'bg-indigo-500',
        urgent: true,
      });
    }

    if (!hasFinance) {
      actions.push({
        label: t('Configure fee structure'),
        detail: t('Start tracking payments'),
        icon: 'payments',
        path: '/admin/finance/fee-setup',
        color: 'bg-emerald-500',
        urgent: true,
      });
    }

    return actions;
  }, [studentCount, classCount, sectionCount, hasFinance, outstanding, attendanceRate, t]);

  const urgentActions = useMemo(() => quickActions.filter(a => a.urgent), [quickActions]);
  const nonUrgentActions = useMemo(() => quickActions.filter(a => !a.urgent), [quickActions]);

  const recentActivity = useMemo(() => auditLogs.slice(0, 5), [auditLogs]);

  const attendanceColor = attendanceRate !== null
    ? attendanceRate > 85 ? 'text-secondary' : attendanceRate >= 70 ? 'text-amber-600' : 'text-error'
    : 'text-on-surface';

  const feesFormatted = hasFinance ? formatCFA(feesCollected ?? 0) : '-';
  const outstandingFormatted = hasFinance ? formatCFA(outstanding ?? 0) : '-';
  const feeCollectionRate = feesCollected !== null && outstanding !== null && (feesCollected + outstanding) > 0
    ? Math.round((feesCollected / (feesCollected + outstanding)) * 100)
    : null;

  return (
    <div className="p-4 lg:p-12 space-y-8 lg:space-y-10 animate-in fade-in duration-500">

      {/* ─── Setup Progress Bar ─── */}
      <SetupProgressBar
        studentCount={studentCount}
        classCount={classCount}
        sectionCount={sectionCount}
        hasFinance={hasFinance}
      />

      {/* ─── A. Welcome Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {getGreetingIcon()}
            </span>
            <span className="text-on-surface-variant text-sm font-medium">
              {t(getGreeting())}, <span className="text-on-surface font-bold">{userName}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-[2.5rem] font-semibold leading-tight tracking-tight text-on-surface">
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              {schoolName}
            </span>
          </h1>
          <p className="text-on-surface-variant mt-2 text-base">{t('Your school at a glance')}</p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/admin/academic/students/new')}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95 bg-gradient-to-br from-primary to-primary-container"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            <span className="hidden sm:inline">{t('New Registration')}</span>
            <span className="sm:hidden">{t('New')}</span>
          </button>
        </div>
      </div>

      {/* ─── B. Executive KPI Strip ─── */}
      {kpiLoading ? (
        <div className="flex items-center justify-center py-10 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-3">sync</span>
          <span className="font-medium text-sm">{t('Loading metrics...')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {/* Students */}
          <button
            onClick={() => navigate('/admin/academic')}
            className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/15 flex flex-col justify-between hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-300 group text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Students')}</span>
                {(studentCount ?? 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-blue-500 text-lg sm:text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              </div>
            </div>
            <p className="text-xl sm:text-[2.25rem] font-bold leading-none text-on-surface">{studentCount?.toLocaleString() ?? '-'}</p>
            <span className="text-[11px] text-on-surface-variant mt-2 block">{t('Enrolled')}</span>
          </button>

          {/* Teachers */}
          <button
            onClick={() => navigate('/admin/operations/faculty')}
            className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/15 flex flex-col justify-between hover:border-violet-500/30 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-300 group text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Teachers')}</span>
                {(teacherCount ?? 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-violet-500 text-lg sm:text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
              </div>
            </div>
            <p className="text-xl sm:text-[2.25rem] font-bold leading-none text-on-surface">{teacherCount?.toLocaleString() ?? '-'}</p>
            <span className="text-[11px] text-on-surface-variant mt-2 block">{t('Active staff')}</span>
          </button>

          {/* Attendance Rate */}
          <button
            onClick={() => navigate('/admin/attendance')}
            className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/15 flex flex-col justify-between hover:border-emerald-500/30 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300 group text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Attendance')}</span>
                {attendanceRate !== null && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    attendanceRate > 85 ? 'bg-secondary' : attendanceRate >= 70 ? 'bg-amber-500' : 'bg-error'
                  }`} />
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-emerald-500 text-lg sm:text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
              </div>
            </div>
            <p className={`text-xl sm:text-[2.25rem] font-bold leading-none ${attendanceColor}`}>
              {attendanceRate !== null ? `${attendanceRate.toFixed(1)}%` : '-'}
            </p>
            <span className="text-[11px] text-on-surface-variant mt-2 block">{t('Average')}</span>
          </button>

          {/* Fees */}
          <button
            onClick={() => navigate('/admin/finance')}
            className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/15 flex flex-col justify-between hover:border-amber-500/30 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300 group text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Fees')}</span>
                {(outstanding ?? 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-error flex-shrink-0 animate-pulse" />
                )}
                {(!outstanding || outstanding === 0) && hasFinance && (
                  <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />
                )}
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-amber-500 text-lg sm:text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
            </div>
            <p className="text-xl sm:text-[2.25rem] font-bold leading-none text-on-surface">{feesFormatted}</p>
            {hasFinance && (
              <div className="flex items-center justify-between mt-2">
                {feeCollectionRate !== null && (
                  <div className="flex-1 mr-3">
                    <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, feeCollectionRate)}%`,
                          backgroundColor: feeCollectionRate > 80 ? 'var(--md-sys-color-secondary)' : feeCollectionRate > 50 ? 'var(--md-sys-color-amber-500)' : 'var(--md-sys-color-error)',
                        }}
                      />
                    </div>
                  </div>
                )}
                <span className={`text-[11px] font-medium ${
                  (outstanding ?? 0) > 0 ? 'text-error' : 'text-secondary'
                }`}>
                  {(outstanding ?? 0) > 0 ? t('{{amount}} due', { amount: outstandingFormatted }) : t('All clear')}
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* ─── School Health Score Banner ─── */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>monitor_heart</span>
          </div>
          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('School Health')}</span>
          {timeSaved !== null && timeSaved > 0 && (
            <span className="ml-auto text-[11px] text-on-surface-variant">
              <span className="material-symbols-outlined text-xs align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              <span className="font-bold text-secondary">{t('{{time}} saved', { time: formatMinutes(timeSaved) })}</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-on-surface-variant font-medium">{t('Attendance')}</span>
              <span className="text-xs text-on-surface-variant">
                {attendanceRate !== null ? `${attendanceRate.toFixed(1)}%` : '-'}
              </span>
            </div>
            <div className="relative h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, attendanceRate ?? 0)}%`,
                  backgroundColor: (attendanceRate ?? 0) > 85 ? 'var(--md-sys-color-secondary)' : (attendanceRate ?? 0) > 70 ? 'var(--md-sys-color-amber-500)' : 'var(--md-sys-color-error)',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-on-surface-variant font-medium">{t('Fee Collection')}</span>
              <span className="text-xs text-on-surface-variant">{feeCollectionRate !== null ? `${feeCollectionRate}%` : '-'}</span>
            </div>
            <div className="relative h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, feeCollectionRate ?? 0)}%`,
                  backgroundColor: (feeCollectionRate ?? 0) > 80 ? 'var(--md-sys-color-secondary)' : (feeCollectionRate ?? 0) > 50 ? 'var(--md-sys-color-amber-500)' : 'var(--md-sys-color-error)',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-on-surface-variant font-medium">{t('Audit Trail')}</span>
              <span className="text-xs text-on-surface-variant">{t('{{count}} events', { count: auditLogs.length })}</span>
            </div>
            <div className="relative h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, Math.min(100, (auditLogs.length / 20) * 100))}%`,
                  backgroundColor: 'var(--md-sys-color-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Academic Performance & Curriculum ─── */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Academic Performance */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-indigo-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Academic Performance')}</span>
            </div>
            {overview.academics?.overall_average != null ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-on-surface">{overview.academics.overall_average}%</span>
                  <span className="text-xs text-on-surface-variant">{t('school average')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('Pass Rate')}</span>
                    <p className="text-lg font-bold text-on-surface mt-1">{overview.academics.pass_rate}%</p>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('Term')}</span>
                    <p className="text-sm font-bold text-on-surface mt-1">{overview.academics.current_term || '-'}</p>
                  </div>
                </div>
                {overview.academics.best_subject && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                    <span className="text-on-surface-variant">{t('Best')}: <span className="font-bold text-on-surface">{overview.academics.best_subject.name}</span> ({overview.academics.best_subject.average}%)</span>
                  </div>
                )}
                {overview.academics.worst_subject && overview.academics.worst_subject.name !== overview.academics.best_subject?.name && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-error text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>trending_down</span>
                    <span className="text-on-surface-variant">{t('Needs focus')}: <span className="font-bold text-on-surface">{overview.academics.worst_subject.name}</span> ({overview.academics.worst_subject.average}%)</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm">{t('No exam data yet for this term.')}</p>
            )}
          </div>

          {/* Curriculum Compliance */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
              </div>
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('Curriculum Coverage')}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-on-surface">{overview.curriculum?.coverage_pct ?? 0}%</span>
                <span className="text-xs text-on-surface-variant">{t('overall coverage')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-container rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-on-surface">{overview.curriculum?.total_modules ?? 0}</p>
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">{t('Modules')}</span>
                </div>
                <div className="bg-surface-container rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-on-surface">{overview.curriculum?.completed_lessons ?? 0}/{overview.curriculum?.total_lessons ?? 0}</p>
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">{t('Lessons')}</span>
                </div>
                <div className="bg-surface-container rounded-xl p-2.5 text-center">
                  <p className={`text-lg font-bold ${(overview.curriculum?.teachers_without_modules ?? 0) > 0 ? 'text-error' : 'text-secondary'}`}>
                    {overview.curriculum?.teachers_without_modules ?? 0}
                  </p>
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant">{t('Inactive')}</span>
                </div>
              </div>
              {(overview.curriculum?.teachers_without_modules ?? 0) > 0 && (
                <button
                  onClick={() => navigate('/admin/academic/curriculum')}
                  className="w-full text-left text-xs font-medium text-error hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">warning</span>
                  {t('{{count}} teacher(s) have not created any modules', { count: overview.curriculum.teachers_without_modules })}
                </button>
              )}
              <button
                onClick={() => navigate('/admin/academic/curriculum')}
                className="w-full bg-primary/10 text-primary text-xs font-bold py-2 rounded-lg hover:bg-primary/20 transition-colors"
              >
                {t('View Full Coverage')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── C. Action Center ─── */}
      <section>
        <h3 className="text-sm font-bold text-on-surface mb-4">{t('What needs your attention today')}</h3>

        {/* Alerts from dashboard overview */}
        {overview?.alerts && overview.alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {overview.alerts.map((alert: any, i: number) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <span className="material-symbols-outlined text-lg">
                  {alert.severity === 'critical' ? 'error' : 'warning'}
                </span>
                <span className="text-sm font-medium flex-1">{alert.message}</span>
                {alert.type === 'marks' && (
                  <button onClick={() => navigate('/admin/academic/mark-status')} className="text-xs font-bold underline">
                    {t('View')}
                  </button>
                )}
                {alert.type === 'curriculum' && (
                  <button onClick={() => navigate('/admin/academic/curriculum')} className="text-xs font-bold underline">
                    {t('View')}
                  </button>
                )}
                {alert.type === 'attendance' && (
                  <button onClick={() => navigate('/admin/attendance')} className="text-xs font-bold underline">
                    {t('View')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {quickActions.length > 0 ? (
          <div className="space-y-3">
            {urgentActions.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-amber-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      {urgentActions.length} {t('urgent')} {urgentActions.length === 1 ? t('action') : t('actions')}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-amber-500/10">
                  {urgentActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      className="w-full px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-3 hover:bg-amber-500/5 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-xl ${action.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{action.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-on-surface block">{action.label}</span>
                        <span className="text-xs text-on-surface-variant">{action.detail}</span>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant/40 flex-shrink-0">arrow_forward</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {nonUrgentActions.length > 0 && (
              <div>
                {urgentActions.length > 0 && (
                  <button
                    onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                    className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-2 hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm transition-transform duration-200" style={{ transform: suggestionsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      expand_more
                    </span>
                    {suggestionsExpanded ? t('Hide') : t('Show')} {t('suggested actions')} ({nonUrgentActions.length})
                  </button>
                )}
                {(suggestionsExpanded || urgentActions.length === 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nonUrgentActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => navigate(action.path)}
                        className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl border border-outline-variant/15 hover:border-primary/30 hover:shadow-md transition-all group text-left flex items-center gap-3"
                      >
                        <div className={`w-9 h-9 rounded-lg ${action.color} flex items-center justify-center text-white shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform`}>
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{action.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors block">{action.label}</span>
                          <span className="text-xs text-on-surface-variant">{action.detail}</span>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary/60 transition-colors flex-shrink-0 text-lg">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/15 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{t('All clear!')}</p>
              <p className="text-xs text-on-surface-variant">{t('Your school is running smoothly.')}</p>
            </div>
          </div>
        )}
      </section>

      {/* ─── Quick Navigation ─── */}
      <section>
        <h3 className="text-sm font-bold text-on-surface mb-4">{t('Quick access')}</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 lg:grid-cols-8 sm:flex-nowrap sm:overflow-x-visible">
          {[
            { label: 'Register Student', icon: 'person_add_alt', path: '/admin/academic/students/new', color: 'bg-blue-500' },
            { label: 'Record Payment', icon: 'payments', path: '/admin/finance/transactions/new', color: 'bg-emerald-500' },
            { label: 'ID Cards', icon: 'badge', path: '/admin/academic/id-cards', color: 'bg-amber-500' },
            { label: 'Report Cards', icon: 'description', path: '/admin/academic/report-cards', color: 'bg-rose-500' },
            { label: 'Year Review', icon: 'summarize', path: '/admin/year-review', color: 'bg-teal-500' },
            { label: 'Communications', icon: 'campaign', path: '/admin/community/communications', color: 'bg-violet-500' },
            { label: 'Mark Filling', icon: 'edit_note', path: '/admin/academic/analytics', color: 'bg-orange-500' },
            { label: 'Exam Workflow', icon: 'school', path: '/admin/academic/exam-workflow', color: 'bg-indigo-500' },
          ].map((mod) => (
            <button
              key={mod.label}
              onClick={() => navigate(mod.path)}
              className="bg-surface-container-lowest p-3.5 sm:p-4 rounded-xl border border-outline-variant/15 hover:border-primary/30 hover:shadow-md transition-all group text-left flex-shrink-0 w-24 sm:w-auto"
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${mod.color} flex items-center justify-center text-white mb-2 shadow-sm group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-lg sm:text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{mod.icon}</span>
              </div>
              <span className="text-[11px] font-bold text-on-surface block leading-tight">{t(mod.label)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── D. Activity & Audit (Merged) ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-on-surface">{t('Activity & Audit')}</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/audit')} className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
              {t('View all')}
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
          {auditLoading && !auditFetched ? (
            <div className="p-10 flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-primary text-xl mr-3">sync</span>
              <span className="text-sm font-medium">{t('Loading activity...')}</span>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="p-10 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-2 block">history</span>
              <p className="text-on-surface-variant text-sm font-medium">{t('No activity yet.')}</p>
              <p className="text-on-surface-variant/60 text-xs mt-1">{t('Actions will appear here as you use the platform.')}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-outline-variant/5">
                {recentActivity.map((log, i) => (
                  <div key={log.id ?? i} className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-surface-container/20 transition-colors">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      log.status_code && log.status_code < 400 ? 'bg-secondary/10' : 'bg-error/10'
                    }`}>
                      <span className={`material-symbols-outlined text-xs sm:text-sm ${
                        log.status_code && log.status_code < 400 ? 'text-secondary' : 'text-error'
                      }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {MODULE_ICONS[log.module] || (log.status_code && log.status_code < 400 ? 'check_circle' : 'error')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{log.description || log.action}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        <span className="font-medium">{log.user_name}</span>
                        <span className="mx-1.5">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px] align-middle">{MODULE_ICONS[log.module] || 'circle'}</span>
                          {t(MODULE_LABELS[log.module] || log.module)}
                        </span>
                      </p>
                    </div>
                    <span className="text-[11px] text-on-surface-variant/60 whitespace-nowrap flex-shrink-0">{timeAgo(log.created_at, t)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-outline-variant/10">
                <button
                  onClick={toggleAudit}
                  className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-surface-container/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-lg">table_chart</span>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-on-surface">{t('Full Audit Trail')}</h4>
                      <p className="text-xs text-on-surface-variant">{t('{{count}} events logged', { count: auditLogs.length })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {showAudit && (
                      <button onClick={(e) => { e.stopPropagation(); handleExportAudit(); }} className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
                        <span className="material-symbols-outlined text-xs">file_download</span>
                        {t('Export')}
                      </button>
                    )}
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-200" style={{ transform: showAudit ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      expand_more
                    </span>
                  </div>
                </button>

                {showAudit && (
                  <div className="border-t border-outline-variant/10">
                    {auditLoading ? (
                      <div className="p-10 flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-primary text-xl mr-3">sync</span>
                        <span className="text-sm font-medium">{t('Loading audit trail...')}</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-surface-container-low">
                              <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('Action')}</th>
                              <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hidden sm:table-cell">{t('Module')}</th>
                              <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hidden lg:table-cell">{t('User')}</th>
                              <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hidden xl:table-cell">{t('Timestamp')}</th>
                              <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/5">
                            {auditLogs.map((log, i) => (
                              <tr key={log.id ?? i} className="hover:bg-surface-variant/20 transition-colors">
                                <td className="px-4 sm:px-6 py-3 sm:py-4">
                                  <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter">{log.action}</span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium hidden sm:table-cell">{log.module}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm hidden lg:table-cell">{log.user_name}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-on-surface-variant hidden xl:table-cell">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4">
                                  <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-sm ${log.status_code && log.status_code < 400 ? 'text-secondary' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                      {log.status_code && log.status_code < 400 ? 'check_circle' : 'error'}
                                    </span>
                                    <span className="text-xs font-bold">{log.status_code || '-'}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
