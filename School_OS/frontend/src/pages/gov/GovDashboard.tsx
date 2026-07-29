import React, { useEffect } from 'react';
import { useGovStore } from '../../stores/govStore';

const GovDashboard: React.FC = () => {
    const { dashboardData, isLoading, error, fetchDashboard } = useGovStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-error-container p-6 rounded-xl border-l-4 border-error">
                <h3 className="text-error font-bold mb-2">Failed to Load Dashboard</h3>
                <p className="text-on-error-container text-sm">{error}</p>
            </div>
        );
    }

    const { overview, regional_distribution, alerts } = dashboardData || {
        overview: { total_schools: 0, total_students: 0, national_attendance_rate: 0, scope: 'Loading...' },
        regional_distribution: [],
        alerts: []
    };

    return (
        <div className="flex flex-col">
            {/* National Header Section */}
            <div className="mb-12">
                <div className="flex items-baseline gap-4 mb-2">
                    <div className="w-1 h-8 bg-primary"></div>
                    <h1 className="text-4xl font-black tracking-tight text-on-surface">National Education Dashboard</h1>
                </div>
                <p className="text-on-surface-variant font-medium ml-5 italic opacity-70">
                    Reporting Scope: {overview.scope} • Live Data
                </p>
            </div>

            {/* National KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {/* Connected Schools */}
                <div className="bg-primary-container p-6 shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-on-primary-container/70 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Schools Connected</p>
                        <h3 className="text-3xl font-black text-white">{overview.total_schools.toLocaleString()}</h3>
                        <div className="flex items-center gap-1 mt-4 text-[#6ffbbe]">
                            <span className="material-symbols-outlined text-sm">trending_up</span>
                            <span className="text-[10px] font-bold">Active Nodes</span>
                        </div>
                    </div>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl text-white/5 group-hover:scale-110 transition-transform duration-500">school</span>
                </div>

                {/* Students Nationwide */}
                <div className="bg-white p-6 shadow-sm rounded-xl border-l-4 border-primary">
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Total Students</p>
                    <h3 className="text-3xl font-black text-on-surface">{overview.total_students.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 mt-4 text-primary">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        <span className="text-[10px] font-medium">National Census</span>
                    </div>
                </div>

                {/* Attendance Rate */}
                <div className="bg-white p-6 shadow-sm rounded-xl border-l-4 border-primary">
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Attendance Rate</p>
                    <h3 className="text-3xl font-black text-on-surface">{overview.national_attendance_rate}%</h3>
                    <div className="flex items-center gap-1 mt-4 text-[#006c49]">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-[10px] font-medium">National Average</span>
                    </div>
                </div>

                {/* Program Coverage */}
                <div className="bg-white p-6 shadow-sm rounded-xl border-l-4 border-primary">
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Program Coverage</p>
                    <h3 className="text-3xl font-black text-on-surface">{overview.program_coverage_percent}%</h3>
                    <div className="flex items-center gap-1 mt-4 text-primary">
                        <span className="material-symbols-outlined text-sm">map</span>
                        <span className="text-[10px] font-medium">Curriculum Progress</span>
                    </div>
                </div>
            </div>

            {/* Secondary Layout: Map and Indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Regional Stats */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-xl p-8 h-full shadow-sm border border-outline-variant/15 flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-6 bg-primary"></div>
                                <h2 className="text-xl font-bold tracking-tight">Regional Distribution</h2>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {regional_distribution.map((region) => (
                                <div key={region.name} className="p-4 bg-surface rounded-lg border border-outline-variant/10">
                                    <h4 className="text-xs font-black uppercase text-on-surface mb-1">{region.name}</h4>
                                    <p className="text-2xl font-black text-primary">{region.schools_count}</p>
                                    <p className="text-[10px] text-on-surface-variant">Active Schools</p>
                                </div>
                            ))}
                            {regional_distribution.length === 0 && (
                                <p className="text-on-surface-variant italic">No regional data available.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Education Health Indicators (Sidebar Column) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Academic Performance Gauge */}
                    <div className="bg-white rounded-xl p-8 shadow-sm border border-outline-variant/15">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">analytics</span> Performance Average
                        </h4>
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative w-48 h-24 overflow-hidden">
                                <div className="absolute top-0 left-0 w-48 h-48 border-[16px] border-surface-container-high rounded-full"></div>
                                <div className="absolute top-0 left-0 w-48 h-48 border-[16px] border-primary rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', transform: 'rotate(140deg)' }}></div>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                                    <span className="text-4xl font-black text-on-surface">{overview.performance_average}/{overview.max_scale}</span>
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">National Grade</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alerts Heatmap */}
                    {alerts.map((alert) => (
                        <div key={alert.id} className={`${alert.type === 'error' ? 'bg-error-container' : 'bg-tertiary-container text-on-tertiary-container'} rounded-xl p-6 shadow-sm`}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {alert.type === 'error' ? 'warning' : 'info'}
                                </span>
                                <h4 className="text-xs font-black uppercase">{alert.title}</h4>
                            </div>
                            <p className="text-sm mb-4 font-medium">{alert.message}</p>
                            <button className={`w-full py-2 ${alert.type === 'error' ? 'bg-error text-white' : 'bg-tertiary text-white'} text-[10px] font-bold uppercase tracking-widest rounded`}>
                                Investigate
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GovDashboard;
