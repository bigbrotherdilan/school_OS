import React, { useEffect, useState } from 'react';
import { useParentStore, type WardSummary, type AlertSummary } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';
import { parentApi, type ChildSummary } from '../../services/parentApi';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

const ParentDashboard: React.FC = () => {
    const { dashboardData, isLoading, error, setDashboardData, setLoading, setError, comparisonChildren, setComparisonChildren, setComparisonLoading } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const [refreshing, setRefreshing] = useState(false);
    const [academicInfo, setAcademicInfo] = useState<any>(null);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
    const [childSummaryLoading, setChildSummaryLoading] = useState(false);
    const [selectedTerm, setSelectedTerm] = useState(0);
    const [selectedSequence, setSelectedSequence] = useState(0);

    const fetchDashboard = async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await parentApi.getDashboard();
            setDashboardData(data);
        } catch (err) {
            console.error("Failed to fetch parent dashboard", err);
            setError("Failed to load dashboard data. Please try again later.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    useEffect(() => {
        api.get('/reports/analytics/metadata/').then((res) => {
            const activeYear = (res.data.academic_years || []).find((y: any) => y.is_active);
            const allTerms = res.data.terms || [];
            const yearTerms = activeYear ? allTerms.filter((t: any) => t.academic_year_id === activeYear.id) : allTerms;
            const sorted = yearTerms.sort((a: any, b: any) => a.order_number - b.order_number);
            setAcademicInfo({ academicYear: activeYear, terms: sorted });
        }).catch(() => {});
        api.get('/notifications/announcements/?audience=parents&limit=5').then((res) => {
            setAnnouncements(res.data.results || res.data || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (dashboardData && dashboardData.wards.length > 1) {
            setComparisonLoading(true);
            parentApi.getComparison()
                .then(data => setComparisonChildren(data.children || []))
                .catch(() => {})
                .finally(() => setComparisonLoading(false));
        }
    }, [dashboardData]);

    useEffect(() => {
        if (!selectedChildId) {
            setChildSummary(null);
            return;
        }
        setChildSummaryLoading(true);
        setSelectedTerm(0);
        setSelectedSequence(0);
        parentApi.getChildSummary(selectedChildId)
            .then(data => {
                setChildSummary(data);
                if (data.terms.length > 0) {
                    const lastTermIdx = data.terms.length - 1;
                    setSelectedTerm(lastTermIdx);
                    const lastTerm = data.terms[lastTermIdx];
                    if (lastTerm.sequences.length > 0) {
                        setSelectedSequence(lastTerm.sequences.length - 1);
                    }
                }
            })
            .catch(() => setChildSummary(null))
            .finally(() => setChildSummaryLoading(false));
    }, [selectedChildId]);

    const financialAlerts = dashboardData?.alerts.filter(a => a.type === 'financial') || [];
    const otherAlerts = dashboardData?.alerts.filter(a => a.type !== 'financial') || [];

    const childFeeMap = new Map<string, { name: string; amount: number; alerts: AlertSummary[] }>();
    financialAlerts.forEach(a => {
        const sid = a.student_id || 'unknown';
        if (!childFeeMap.has(sid)) {
            childFeeMap.set(sid, { name: `${a.student_first_name || ''} ${a.student_last_name || ''}`.trim() || 'Your child', amount: 0, alerts: [] });
        }
        const entry = childFeeMap.get(sid)!;
        entry.amount += (a.amount || 0);
        entry.alerts.push(a);
    });
    const childFees = Array.from(childFeeMap.values());

    if (isLoading && !refreshing) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-24 bg-slate-200 rounded-2xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-40 bg-slate-200 rounded-2xl" />
                    <div className="h-40 bg-slate-200 rounded-2xl" />
                </div>
                <div className="h-32 bg-slate-200 rounded-2xl" />
            </div>
        );
    }

    if (error && !dashboardData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
                <span className="material-symbols-outlined text-5xl text-slate-300">cloud_off</span>
                <p className="text-slate-500 text-center text-lg">{error}</p>
                <button
                    onClick={() => fetchDashboard()}
                    className="px-6 py-3 bg-blue-900 text-white rounded-xl font-semibold text-base active:scale-95 transition-transform"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!dashboardData) return null;

    return (
        <div className="flex flex-col gap-5 pb-6">
            {/* Fee Owed — Per-Child Red Alert Banners */}
            {childFees.length > 0 ? (
                <>
                    {/* Top bar with greeting + refresh */}
                    <div className="flex items-start justify-between mb-1">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-0.5">
                                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'},
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                {dashboardData.parent_name}
                            </h1>
                            {dashboardData.wards.length > 0 && (
                                <p className="text-sm text-slate-500 mt-1">{dashboardData.wards[0].campus}</p>
                            )}
                        </div>
                        <button
                            onClick={() => fetchDashboard(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <span className={`material-symbols-outlined text-xl ${refreshing ? 'animate-spin' : ''}`}>
                                refresh
                            </span>
                        </button>
                    </div>

                    {childFees.map((child, idx) => (
                        <div key={idx} className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg shadow-red-500/30">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-xl text-red-100">warning</span>
                                <span className="text-sm font-bold text-red-100 uppercase tracking-wider">Fee Balance Due</span>
                            </div>
                            <p className="text-lg font-bold mb-1">{child.name}</p>
                            <p className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
                                {child.amount.toLocaleString()} <span className="text-xl font-bold text-red-200">{schoolConfig.currency_symbol}</span>
                            </p>
                            {child.alerts.map((a, i) => (
                                <p key={i} className="text-sm text-red-100">{a.message}</p>
                            ))}
                            <Link
                                to="/parent/fees"
                                className="mt-4 inline-flex items-center gap-2 bg-white text-red-700 rounded-xl px-6 py-3 font-bold text-sm active:scale-95 transition-transform shadow-lg"
                            >
                                <span className="material-symbols-outlined text-lg">payments</span>
                                Pay Now with Mobile Money
                                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            </Link>
                        </div>
                    ))}
                </>
            ) : (
                <>
                    {/* Greeting Header — Normal State */}
                    <header className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-0.5">
                                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'},
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                {dashboardData.parent_name}
                            </h1>
                            {dashboardData.wards.length > 0 && (
                                <p className="text-sm text-slate-500 mt-1">
                                    {dashboardData.wards[0].campus}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => fetchDashboard(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <span className={`material-symbols-outlined text-xl ${refreshing ? 'animate-spin' : ''}`}>
                                refresh
                            </span>
                        </button>
                    </header>

                    {/* All Paid — Green Card */}
                    {dashboardData.wards.length > 0 && (
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                                <div>
                                    <p className="font-bold text-lg">All Fees Paid</p>
                                    <p className="text-sm text-white/80">No outstanding balance</p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Academic Year / Term Status */}
            {academicInfo && academicInfo.academicYear && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-blue-600 text-xl">calendar_today</span>
                        <h3 className="text-sm font-bold text-blue-900">Current Academic Year</h3>
                    </div>
                    <p className="text-lg font-extrabold text-blue-900 mb-2">{academicInfo.academicYear.name}</p>
                    <div className="flex flex-wrap gap-2">
                        {academicInfo.terms.map((t: any) => (
                            <span key={t.id} className="px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-bold text-blue-800">
                                {t.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Parent Announcements */}
            {announcements.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Announcements</h2>
                    <div className="flex flex-col gap-2">
                        {announcements.map((a: any) => (
                            <div key={a.id} className="bg-blue-50 border-l-4 border-blue-400 rounded-xl p-4">
                                <h4 className="font-bold text-sm text-blue-900">{a.title}</h4>
                                <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{a.message}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Multi-child Comparison Strip */}
            {comparisonChildren.length > 1 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Compare Children</h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                        {comparisonChildren.map(child => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                className={`bg-white rounded-2xl p-4 border shadow-sm transition-all text-left flex-shrink-0 w-56 active:scale-[0.98] ${
                                    selectedChildId === child.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-100 hover:border-blue-200 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    {child.photo_url && child.photo_url.startsWith('http') && !child.photo_url.includes('aida-public') ? (
                                        <img src={child.photo_url} alt={child.name} className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xs">
                                            {child.name[0]}{child.last_name[0]}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{child.name}</p>
                                        <p className="text-[11px] text-slate-500">{child.grade}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">Attendance</span>
                                        <span className={`text-xs font-bold ${
                                            (child.attendance_pct ?? 0) >= 80 ? 'text-emerald-600' : (child.attendance_pct ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600'
                                        }`}>
                                            {child.attendance_pct !== null ? `${child.attendance_pct}%` : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">Marks available</span>
                                        <span className="text-xs font-bold text-slate-900">{child.sequences_with_marks}/{child.sequences_total}</span>
                                    </div>
                                    {child.subjects_with_scores.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {child.subjects_with_scores.slice(0, 3).map(s => (
                                                <span key={s.name} className="text-[10px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded">
                                                    {s.name}
                                                </span>
                                            ))}
                                            {child.subjects_with_scores.length > 3 && (
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                    +{child.subjects_with_scores.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Student Performance Cards */}
            {dashboardData.wards.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-900">Your Children</h2>
                        <Link to="/parent/reports" className="text-sm font-semibold text-blue-900 hover:underline">
                            Reports
                        </Link>
                    </div>
                    <div className="flex flex-col gap-3">
                        {dashboardData.wards.map((ward: WardSummary) => (
                            <WardCard key={ward.id} ward={ward} onSelect={(id) => setSelectedChildId(id)} />
                        ))}
                    </div>
                </section>
            )}

            {dashboardData.wards.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">child_care</span>
                    <p className="text-slate-500 font-medium">No children linked to your account yet.</p>
                    <p className="text-sm text-slate-400 mt-1">Contact your school to link your children.</p>
                </div>
            )}

            {/* Recent Alerts */}
            {otherAlerts.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-900 mb-3">School Announcements</h2>
                    <div className="flex flex-col gap-2">
                        {otherAlerts.map((alert: AlertSummary) => (
                            <AlertCard key={alert.id} alert={alert} />
                        ))}
                    </div>
                </section>
            )}

            {/* Quick Actions */}
            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <QuickAction icon="receipt_long" label="Pay Fees" to="/parent/fees" color="red" />
                    <QuickAction icon="description" label="Report Cards" to="/parent/reports" color="blue" />
                    <QuickAction icon="analytics" label="Grades" to="/parent/analytics" color="emerald" />
                    <QuickAction icon="settings" label="Settings" to="/parent/settings" color="slate" />
                </div>
            </section>

            {/* Financial Alerts Detail */}
            {financialAlerts.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Fee Details</h2>
                    <div className="flex flex-col gap-2">
                        {financialAlerts.map((alert: AlertSummary) => (
                            <AlertCard key={alert.id} alert={alert} />
                        ))}
                    </div>
                </section>
            )}

            {/* Inline Child Detail */}
            {selectedChildId && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-900">Child Details</h2>
                        <button
                            onClick={() => setSelectedChildId(null)}
                            className="text-sm font-semibold text-blue-900 hover:underline"
                        >
                            Close
                        </button>
                    </div>
                    {childSummaryLoading ? (
                        <div className="flex flex-col gap-4 animate-pulse">
                            <div className="h-32 bg-slate-200 rounded-2xl" />
                            <div className="h-12 bg-slate-200 rounded-xl" />
                            <div className="h-64 bg-slate-200 rounded-2xl" />
                        </div>
                    ) : childSummary ? (
                        <ChildDetailPanel
                            summary={childSummary}
                            schoolConfig={schoolConfig}
                            selectedTerm={selectedTerm}
                            selectedSequence={selectedSequence}
                            onTermChange={setSelectedTerm}
                            onSequenceChange={setSelectedSequence}
                        />
                    ) : null}
                </section>
            )}
        </div>
    );
};

function WardCard({ ward, onSelect }: { ward: WardSummary; onSelect: (id: string) => void }) {
    const initials = `${ward.first_name[0]}${ward.last_name[0]}`.toUpperCase();
    const hasAttendance = ward.attendance_percentage !== null && ward.attendance_percentage !== undefined;
    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
                {ward.photo_url && ward.photo_url.startsWith('http') && !ward.photo_url.includes('aida-public') ? (
                    <img src={ward.photo_url} alt={ward.first_name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100" />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm">
                        {initials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate">{ward.first_name} {ward.last_name}</h3>
                    <p className="text-sm text-slate-500">{ward.grade}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Attendance</p>
                    {hasAttendance ? (
                        <>
                            <div className="flex items-end gap-1.5">
                                <span className="text-xl font-extrabold text-slate-900">{ward.attendance_percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                                <div
                                    className={`h-1.5 rounded-full ${ward.attendance_percentage! >= 80 ? 'bg-emerald-500' : ward.attendance_percentage! >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${ward.attendance_percentage}%` }}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">No data</p>
                    )}
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Latest Results</p>
                    {ward.recent_grade ? (
                        <>
                            <p className="text-sm font-bold text-slate-900 truncate">{ward.recent_grade.subject}</p>
                            <span className="inline-block mt-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                {ward.recent_grade.score_label}
                            </span>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">No scores yet</p>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => onSelect(ward.id)}
                    className="flex-1 py-2.5 bg-blue-900 text-white text-center rounded-xl text-sm font-bold active:scale-[0.98] transition-transform"
                >
                    See Grades
                </button>
                <Link
                    to="/parent/reports"
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-center rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                    Report Card
                </Link>
            </div>
        </div>
    );
}

function AlertCard({ alert }: { alert: AlertSummary }) {
    const config = {
        financial: { bg: 'bg-red-50', border: 'border-red-400', icon: 'payments', iconColor: 'text-red-500', textColor: 'text-red-900' },
        event: { bg: 'bg-amber-50', border: 'border-amber-400', icon: 'event', iconColor: 'text-amber-500', textColor: 'text-amber-900' },
        general: { bg: 'bg-blue-50', border: 'border-blue-400', icon: 'info', iconColor: 'text-blue-500', textColor: 'text-blue-900' },
    }[alert.type];

    return (
        <div className={`${config.bg} border-l-4 ${config.border} rounded-xl p-4 flex items-start gap-3`}>
            <span className={`material-symbols-outlined ${config.iconColor} mt-0.5`}>{config.icon}</span>
            <div className="flex-1 min-w-0">
                <h4 className={`font-bold text-sm ${config.textColor}`}>{alert.title}</h4>
                <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{alert.message}</p>
            </div>
        </div>
    );
}

function ChildDetailPanel({ summary, schoolConfig, selectedTerm, selectedSequence, onTermChange, onSequenceChange }: {
    summary: ChildSummary;
    schoolConfig: any;
    selectedTerm: number;
    selectedSequence: number;
    onTermChange: (idx: number) => void;
    onSequenceChange: (idx: number) => void;
}) {
    const currentTerm = summary.terms[selectedTerm];
    const currentSequence = currentTerm?.sequences[selectedSequence];
    const scaleMax = currentSequence?.subjects[0]?.out_of || schoolConfig.grading_scale_max;

    return (
        <div className="flex flex-col gap-4">
            {/* Child Header */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                    {summary.student.photo_url && summary.student.photo_url.startsWith('http') && !summary.student.photo_url.includes('aida-public') ? (
                        <img src={summary.student.photo_url} alt={summary.student.first_name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xl">
                            {summary.student.first_name[0]}{summary.student.last_name[0]}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-900">{summary.student.first_name} {summary.student.last_name}</h1>
                        <p className="text-sm text-slate-500">{summary.student.grade} · {summary.student.campus}</p>
                        <p className="text-xs text-slate-400 mt-0.5">#{summary.student.admission_number}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                            <circle
                                cx="32" cy="32" r="28" fill="none"
                                stroke={summary.attendance.percentage !== null && summary.attendance.percentage >= 80 ? '#10b981' : summary.attendance.percentage !== null && summary.attendance.percentage >= 60 ? '#f59e0b' : '#ef4444'}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${(summary.attendance.percentage || 0) * 1.759} 175.9`}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
                            {summary.attendance.percentage !== null ? `${summary.attendance.percentage}%` : '-'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">Attendance</p>
                        <p className="text-xs text-slate-500">
                            {summary.attendance.present_days} / {summary.attendance.total_days} days present
                        </p>
                    </div>
                </div>
            </div>

            {/* Term Tabs */}
            {summary.terms.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {summary.terms.map((term, idx) => (
                        <button
                            key={term.term_id}
                            onClick={() => {
                                onTermChange(idx);
                                onSequenceChange(Math.min(selectedSequence, term.sequences.length - 1));
                            }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${idx === selectedTerm ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                        >
                            {term.term_name}
                        </button>
                    ))}
                </div>
            )}

            {/* Sequence Tabs */}
            {currentTerm && currentTerm.sequences.length > 0 && (
                <div className="flex gap-2">
                    {currentTerm.sequences.map((seq, idx) => (
                        <button
                            key={seq.sequence_id}
                            onClick={() => onSequenceChange(idx)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${idx === selectedSequence ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                        >
                            {seq.sequence_name}
                            {!seq.is_locked && <span className="w-2 h-2 rounded-full bg-amber-400" title="Not yet finalised" />}
                            {seq.is_locked && !seq.is_shared && <span className="w-2 h-2 rounded-full bg-slate-300" title="Marks finalised - not yet shared" />}
                            {seq.is_locked && seq.is_shared && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Results visible" />}
                        </button>
                    ))}
                </div>
            )}

            {/* Subject Marks Table */}
            {currentSequence ? (
                currentSequence.is_locked && currentSequence.is_shared ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="font-bold text-slate-900">{currentSequence.sequence_name} - {currentTerm.term_name}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Subject scores (out of {scaleMax})</p>
                        </div>
                        {currentSequence.subjects.length === 0 ? (
                            <div className="p-8 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">analytics</span>
                                <p className="text-sm text-slate-500">No results available for this sequence.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {currentSequence.subjects.map((subj, i) => {
                                    const pct = (subj.score / subj.out_of) * 100;
                                    const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';
                                    return (
                                        <div key={`${subj.name}-${i}`} className="px-5 py-4 flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-blue-900">{i + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-800 truncate">{subj.name}</span>
                                                    <span className="text-sm font-bold text-blue-900 ml-2">{subj.score} / {subj.out_of}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                                </div>
                                                {subj.coefficient !== 1 && (
                                                    <p className="text-[10px] text-slate-400 mt-1">Coefficient: {subj.coefficient}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                        <span className="material-symbols-outlined text-4xl text-amber-300 mb-3 block">
                            {currentSequence.is_locked ? 'visibility_off' : 'lock_open'}
                        </span>
                        <p className="text-sm font-bold text-slate-900 mb-1">
                            {currentSequence.is_locked ? 'Results not yet shared' : 'Results pending'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {currentSequence.is_locked
                                ? 'Marks have been finalised but are not yet visible to parents. The school admin will share them soon.'
                                : 'Results will appear here once the exam session closes and marks are finalised by the admin.'}
                        </p>
                    </div>
                )
            ) : (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">school</span>
                    <p className="text-sm text-slate-500">No sequences available for this term.</p>
                </div>
            )}

            {/* Quick Nav */}
            <div className="flex gap-3">
                <Link to="/parent/analytics" className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 text-center hover:bg-slate-50 transition-colors">
                    View All Grades
                </Link>
                <Link to="/parent/reports" className="flex-1 py-3 bg-blue-900 rounded-xl text-sm font-bold text-white text-center active:scale-[0.98] transition-transform">
                    Report Cards
                </Link>
            </div>
        </div>
    );
}

function QuickAction({ icon, label, to, color }: { icon: string; label: string; to: string; color: string }) {
    const colors = {
        red: 'bg-red-50 text-red-600',
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate: 'bg-slate-100 text-slate-600',
    }[color];

    return (
        <Link
            to={to}
            className={`${colors} rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform`}
        >
            <span className="material-symbols-outlined text-2xl">{icon}</span>
            <span className="text-xs font-bold">{label}</span>
        </Link>
    );
}

export default ParentDashboard;
