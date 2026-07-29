import React, { useEffect, useState } from 'react';
import { useParentStore, type WardSummary, type AlertSummary, type ChildComparison } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';
import { parentApi } from '../../services/parentApi';
import { api } from '../../services/api';
import { Link, useNavigate } from 'react-router-dom';

const ParentDashboard: React.FC = () => {
    const { dashboardData, isLoading, error, setDashboardData, setLoading, setError, comparisonChildren, setComparisonChildren, comparisonLoading, setComparisonLoading } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();
    const [academicInfo, setAcademicInfo] = useState<any>(null);
    const [announcements, setAnnouncements] = useState<any[]>([]);

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

    const financialAlerts = dashboardData?.alerts.filter(a => a.type === 'financial') || [];
    const otherAlerts = dashboardData?.alerts.filter(a => a.type !== 'financial') || [];
    const totalOwed = financialAlerts.reduce((sum, a) => sum + (a.amount || 0), 0);

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
            {/* Greeting Header */}
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

            {/* Fee Alert Card */}
            {totalOwed > 0 ? (
                <Link
                    to="/parent/fees"
                    className="block bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/20 active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-white/90">payments</span>
                            <span className="text-sm font-semibold text-white/90">Fees Owed</span>
                        </div>
                        <span className="material-symbols-outlined text-white/70">arrow_forward</span>
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight">
                        {totalOwed.toLocaleString()} <span className="text-lg font-semibold text-white/80">{schoolConfig.currency_symbol}</span>
                    </p>
                    <div className="mt-3 flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2.5 w-fit">
                        <span className="material-symbols-outlined text-lg">smartphone</span>
                        <span className="text-sm font-bold">Pay with Mobile Money</span>
                    </div>
                </Link>
            ) : dashboardData.wards.length > 0 ? (
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-2xl">check_circle</span>
                        <div>
                            <p className="font-bold text-lg">All Fees Paid</p>
                            <p className="text-sm text-white/80">No outstanding balance</p>
                        </div>
                    </div>
                </div>
            ) : null}

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
                                onClick={() => navigate(`/parent/child/${child.id}`)}
                                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all text-left flex-shrink-0 w-56 active:scale-[0.98]"
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
                            <WardCard key={ward.id} ward={ward} />
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
        </div>
    );
};

function WardCard({ ward }: { ward: WardSummary }) {
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
                <Link
                    to={`/parent/child/${ward.id}`}
                    className="flex-1 py-2.5 bg-blue-900 text-white text-center rounded-xl text-sm font-bold active:scale-[0.98] transition-transform"
                >
                    See Grades
                </Link>
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
