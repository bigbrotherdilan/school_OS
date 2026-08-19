import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { format, parseISO } from 'date-fns';

export default function InspectorDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation('adminGov');
  const { addToast } = useToastStore();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'in-progress' | 'completed' | 'findings' | 'actions'>('upcoming');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/gov/inspector-dashboard/');
      setDashboardData(response.data);
    } catch (err) {
      console.error('Failed to fetch inspector dashboard', err);
      addToast(t('Failed to load dashboard data'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-error text-on-error';
      case 'major': return 'bg-warning text-on-warning';
      case 'minor': return 'bg-info text-on-info';
      case 'observation': return 'bg-surface-container-highest text-on-surface';
      case 'good_practice': return 'bg-secondary text-on-secondary';
      default: return 'bg-outline-variant text-on-surface';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary/10 text-primary';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'completed': return 'bg-secondary/10 text-secondary';
      case 'report_draft': return 'bg-info/10 text-info';
      case 'report_finalized': return 'bg-emerald/10 text-emerald';
      case 'closed': return 'bg-surface-container-highest text-on-surface';
      default: return 'bg-outline-variant/10 text-outline';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'compliant': return 'bg-secondary/10 text-secondary';
      case 'minor_issues': return 'bg-warning/10 text-warning';
      case 'major_issues': return 'bg-error/10 text-error';
      case 'critical': return 'bg-error text-on-error';
      case 'pending': return 'bg-surface-container-highest text-on-surface';
      default: return 'bg-outline-variant/10 text-outline';
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-12 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">dashboard</span>
            <p className="text-on-surface-variant">{t('Loading Inspector Dashboard...')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-outline-variant/15 pb-8">
        <div>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary/60 mb-2 block font-headline">{t('MINESEC Inspector Portal')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface font-headline">{t('Inspections Dashboard')}</h2>
          <p className="text-on-surface-variant mt-2 max-w-xl text-lg leading-relaxed">
            {t('Manage and track school inspections, findings, and corrective actions across your region.')}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate('/admin/compliance/new-inspection')}
            className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold rounded-xl text-sm shadow-xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
            {t('New Inspection')}
          </button>
          <button
            onClick={fetchDashboard}
            className="px-6 py-3 bg-surface-container-highest text-on-surface font-semibold rounded-xl text-sm transition-all hover:bg-surface-container-high active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {t('Refresh')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {dashboardData?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard
            label={t('Total Inspections')}
            value={dashboardData.stats.total_inspections}
            icon="fact_check"
            color="bg-blue-500"
          />
          <StatCard
            label={t('This Year')}
            value={dashboardData.stats.this_year}
            icon="event"
            color="bg-emerald-500"
          />
          <StatCard
            label={t('Completed')}
            value={dashboardData.stats.completed_this_year}
            icon="check_circle"
            color="bg-secondary-500"
          />
          <StatCard
            label={t('Completion Rate')}
            value={`${dashboardData.stats.completion_rate}%`}
            icon="trending_up"
            color="bg-amber-500"
          />
          <StatCard
            label={t('Avg Score')}
            value={dashboardData.stats.average_score ? `${dashboardData.stats.average_score}/100` : '—'}
            icon="score"
            color="bg-purple-500"
          />
          <StatCard
            label={t('Overdue Findings')}
            value={dashboardData.overdue_findings?.length || 0}
            icon="warning"
            color="bg-red-500"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
        <div className="border-b border-outline-variant/15 overflow-x-auto">
          <nav className="flex gap-1 p-1 min-w-max" role="tablist">
            {[
              { id: 'upcoming', label: 'Upcoming', count: dashboardData?.upcoming?.length || 0, icon: 'event_upcoming' },
              { id: 'in-progress', label: 'In Progress', count: dashboardData?.in_progress?.length || 0, icon: 'play_circle' },
              { id: 'completed', label: 'Completed', count: dashboardData?.recent_completed?.length || 0, icon: 'check_circle' },
              { id: 'findings', label: 'Overdue Findings', count: dashboardData?.overdue_findings?.length || 0, icon: 'warning' },
              { id: 'actions', label: 'Pending Actions', count: dashboardData?.pending_actions?.length || 0, icon: 'assignment_late' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container/50'
                }`}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{tab.icon}</span>
                {t(tab.label)}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    activeTab === tab.id ? 'bg-on-primary/20' : 'bg-surface-container-highest'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {activeTab === 'upcoming' && (
            <InspectionList
              inspections={dashboardData?.upcoming || []}
              title={t('Upcoming Inspections')}
              emptyMessage={t('No upcoming inspections scheduled.')}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
            />
          )}
          {activeTab === 'in-progress' && (
            <InspectionList
              inspections={dashboardData?.in_progress || []}
              title={t('In-Progress Inspections')}
              emptyMessage={t('No inspections currently in progress.')}
              formatDate={formatDateTime}
              getStatusColor={getStatusColor}
            />
          )}
          {activeTab === 'completed' && (
            <InspectionList
              inspections={dashboardData?.recent_completed || []}
              title={t('Recently Completed')}
              emptyMessage={t('No recently completed inspections.')}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              getOutcomeColor={getOutcomeColor}
              showOutcome={true}
            />
          )}
          {activeTab === 'findings' && (
            <FindingsList
              findings={dashboardData?.overdue_findings || []}
              title={t('Overdue Findings')}
              emptyMessage={t('No overdue findings. All corrective actions are on track.')}
              formatDate={formatDate}
              getSeverityColor={getSeverityColor}
            />
          )}
          {activeTab === 'actions' && (
            <ActionsList
              actions={dashboardData?.pending_actions || []}
              title={t('Pending Corrective Actions')}
              emptyMessage={t('No pending corrective actions awaiting review.')}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>

      {/* Severity Breakdown Charts */}
      {dashboardData?.stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeverityBreakdownChart
            data={dashboardData.stats.severity_breakdown}
            title={t('Findings by Severity')}
          />
          <CategoryBreakdownChart
            data={dashboardData.stats.category_breakdown}
            title={t('Findings by Category')}
          />
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{label}</p>
          <p className="text-3xl font-bold text-on-surface tabular-nums">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// Inspection List Component
interface InspectionListProps {
  inspections: any[];
  title: string;
  emptyMessage: string;
  formatDate: (date: string | null) => string;
  getStatusColor: (status: string) => string;
  getOutcomeColor?: (outcome: string) => string;
  showOutcome?: boolean;
}

function InspectionList({ inspections, title, emptyMessage, formatDate, getStatusColor, getOutcomeColor, showOutcome }: InspectionListProps) {
  const { t } = useTranslation('adminGov');
  if (inspections.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-outline">event</span>
        </div>
        <h4 className="text-lg font-bold text-on-surface mb-2">{title}</h4>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-outline text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/15">
              <th className="p-3 pb-2">{t('School')}</th>
              <th className="p-3 pb-2">{t('Type')}</th>
              <th className="p-3 pb-2">{t('Scheduled')}</th>
              <th className="p-3 pb-2">{t('Lead Inspector')}</th>
              <th className="p-3 pb-2">{t('Status')}</th>
              {showOutcome && <th className="p-3 pb-2">{t('Outcome')}</th>}
              {showOutcome && <th className="p-3 pb-2">{t('Score')}</th>}
              <th className="p-3 pb-2 text-right">{t('Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {inspections.map((insp: any) => (
              <tr key={insp.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-on-surface">{insp.school?.school_name || t('Unknown School')}</div>
                  <div className="text-[10px] text-outline">{insp.school?.school_code} • {insp.school?.region}</div>
                </td>
                <td className="p-3">
                  <span className="text-sm text-on-surface-variant">{insp.inspection_type_display}</span>
                </td>
                <td className="p-3 text-sm text-on-surface-variant">{formatDate(insp.scheduled_date)}</td>
                <td className="p-3 text-sm text-on-surface-variant">{insp.lead_inspector_name || insp.lead_inspector_detail?.full_name || t('Unassigned')}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(insp.status)}`}>
                    {insp.status_display}
                  </span>
                </td>
                {showOutcome && (
                  <>
                    <td className="p-3">
                      {insp.outcome ? (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getOutcomeColor!(insp.outcome)}`}>
                          {insp.outcome_display}
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline">{t('Pending')}</span>
                      )}
                    </td>
                    <td className="p-3 text-sm font-mono text-on-surface-variant">
                      {insp.overall_score ? `${insp.overall_score}/100` : '—'}
                    </td>
                  </>
                )}
                <td className="p-3 text-right">
                  <button
                    onClick={() => window.location.href = `/admin/compliance/inspections/${insp.id}`}
                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors flex items-center gap-1 justify-center mx-auto"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    {t('View')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Findings List Component
interface FindingsListProps {
  findings: any[];
  title: string;
  emptyMessage: string;
  formatDate: (date: string | null) => string;
  getSeverityColor: (severity: string) => string;
}

function FindingsList({ findings, title, emptyMessage, formatDate, getSeverityColor }: FindingsListProps) {
  const { t } = useTranslation('adminGov');
  if (findings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-secondary">check_circle</span>
        </div>
        <h4 className="text-lg font-bold text-on-surface mb-2">{title}</h4>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">{title}</h4>
      <div className="space-y-3">
        {findings.map((finding: any) => (
          <div key={finding.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/15 hover:border-primary/30 transition-colors">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getSeverityColor(finding.severity)}`}>
                    {finding.severity_display}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-outline bg-surface-container-highest px-2 py-1 rounded">
                    {finding.category_display}
                  </span>
                </div>
                <h5 className="font-semibold text-on-surface mb-1">{finding.title}</h5>
                <p className="text-sm text-on-surface-variant mb-2 line-clamp-2">{finding.description}</p>
                <div className="flex flex-wrap gap-4 text-[10px] text-outline">
                  <span>{t('Deadline:')} <span className="font-medium text-error">{formatDate(finding.deadline)}</span></span>
                  <span>{t('School:')} <span className="font-medium">{finding.inspection?.school?.school_name}</span></span>
                  <span>{t('Inspection:')} <span className="font-medium">{finding.inspection?.inspection_type_display}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2 md:ml-4">
                <button
                  onClick={() => window.location.href = `/admin/compliance/inspections/${finding.inspection?.id}?finding=${finding.id}`}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {t('Review')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Actions List Component
interface ActionsListProps {
  actions: any[];
  title: string;
  emptyMessage: string;
  formatDate: (date: string | null) => string;
}

function ActionsList({ actions, title, emptyMessage, formatDate }: ActionsListProps) {
  const { t } = useTranslation('adminGov');
  if (actions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-secondary">check_circle</span>
        </div>
        <h4 className="text-lg font-bold text-on-surface mb-2">{title}</h4>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">{title}</h4>
      <div className="space-y-3">
        {actions.map((action: any) => (
          <div key={action.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/15 hover:border-primary/30 transition-colors">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-warning/10 text-warning">
                    {action.status_display || action.status}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-outline bg-surface-container-highest px-2 py-1 rounded">
                    {action.finding?.severity_display} • {action.finding?.category_display}
                  </span>
                </div>
                <h5 className="font-semibold text-on-surface mb-1">{t('Finding: {{title}}', { title: action.finding?.title })}</h5>
                <p className="text-sm text-on-surface-variant mb-2 line-clamp-2">{action.action_taken}</p>
                <div className="flex flex-wrap gap-4 text-[10px] text-outline">
                  <span>{t('Submitted:')} <span className="font-medium">{formatDate(action.submitted_at)}</span></span>
                  <span>{t('By:')} <span className="font-medium">{action.submitted_by_name || action.submitted_by}</span></span>
                  <span>{t('School:')} <span className="font-medium">{action.finding?.inspection?.school?.school_name}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2 md:ml-4">
                <button
                  onClick={() => window.location.href = `/admin/compliance/inspections/${action.finding?.inspection?.id}?action=${action.id}`}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {t('Review')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Severity Breakdown Chart
function SeverityBreakdownChart({ data, title }: { data: Record<string, number>; title: string }) {
  const { t } = useTranslation('adminGov');
  const severityOrder = ['critical', 'major', 'minor', 'observation', 'good_practice'];
  const severityLabels: Record<string, string> = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
    observation: 'Observation',
    good_practice: 'Good Practice',
  };
  const severityColors: Record<string, string> = {
    critical: '#EF4444',
    major: '#F59E0B',
    minor: '#3B82F6',
    observation: '#64748B',
    good_practice: '#10B981',
  };

  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
      <h4 className="text-lg font-bold text-on-surface mb-6">{title}</h4>
      {total === 0 ? (
        <div className="text-center py-8 text-on-surface-variant">{t('No findings data available')}</div>
      ) : (
        <div className="space-y-4">
          {severityOrder.map((severity) => {
            const count = data[severity] || 0;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={severity} className="flex items-center gap-4">
                <div className="w-24 text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
                  {t(severityLabels[severity])}
                </div>
                <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: severityColors[severity] }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-bold text-on-surface tabular-nums">
                  {count} ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Category Breakdown Chart
function CategoryBreakdownChart({ data, title }: { data: Record<string, number>; title: string }) {
  const { t } = useTranslation('adminGov');
  const categoryLabels: Record<string, string> = {
    governance: 'Governance',
    curriculum: 'Curriculum',
    teaching: 'Teaching Quality',
    learning: 'Learning Outcomes',
    assessment: 'Assessment',
    attendance: 'Attendance',
    safeguarding: 'Safeguarding',
    infrastructure: 'Infrastructure',
    finance: 'Finance',
    staffing: 'Staffing',
    data: 'Data & Reporting',
    compliance: 'Compliance',
  };

  const sortedCategories = Object.entries(data)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const total = sortedCategories.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
      <h4 className="text-lg font-bold text-on-surface mb-6">{title}</h4>
      {total === 0 ? (
        <div className="text-center py-8 text-on-surface-variant">{t('No category data available')}</div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map(([category, count]) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={category} className="flex items-center gap-4">
                <div className="w-32 text-[11px] font-medium text-on-surface-variant truncate">
                  {t(categoryLabels[category] || category)}
                </div>
                <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-primary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-bold text-on-surface tabular-nums">
                  {count} ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}