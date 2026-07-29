import React, { useEffect } from 'react';
import { useGovStore } from '../../stores/govStore';

const GovMonitoring: React.FC = () => {
    const { monitoringData, fetchMonitoring } = useGovStore();

    useEffect(() => {
        fetchMonitoring();
    }, [fetchMonitoring]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-primary"></div>
                <h1 className="text-4xl font-black text-on-surface tracking-tight">Institutional Monitoring</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logbook Status */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary text-3xl">menu_book</span>
                        <h3 className="font-bold text-lg">Logbook Activity</h3>
                    </div>
                    {monitoringData ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Entries</p>
                                <p className="text-3xl font-black text-on-surface">{monitoringData.logbook.total_entries}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Last 30 Days</p>
                                <p className="text-3xl font-black text-primary">{monitoringData.logbook.recent_entries}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined animate-spin text-primary text-2xl block">sync</span>
                        </div>
                    )}
                </div>

                {/* Attendance Status */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary text-3xl">fact_check</span>
                        <h3 className="font-bold text-lg">Attendance Submission</h3>
                    </div>
                    {monitoringData ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sessions (30d)</p>
                                <p className="text-3xl font-black text-on-surface">{monitoringData.attendance.total_sessions_30d}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Submission Rate</p>
                                <p className={`text-3xl font-black ${monitoringData.attendance.submission_rate >= 80 ? 'text-emerald-600' : monitoringData.attendance.submission_rate >= 50 ? 'text-amber-600' : 'text-error'}`}>
                                    {monitoringData.attendance.submission_rate}%
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined animate-spin text-primary text-2xl block">sync</span>
                        </div>
                    )}
                </div>

                {/* Curriculum Coverage */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary text-3xl">school</span>
                        <h3 className="font-bold text-lg">Curriculum Coverage</h3>
                    </div>
                    {monitoringData ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Coverage Rate</p>
                                <p className={`text-3xl font-black ${monitoringData.curriculum.coverage_percent >= 80 ? 'text-emerald-600' : monitoringData.curriculum.coverage_percent >= 50 ? 'text-amber-600' : 'text-error'}`}>
                                    {monitoringData.curriculum.coverage_percent}%
                                </p>
                            </div>
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${monitoringData.curriculum.coverage_percent >= 80 ? 'bg-emerald-500' : monitoringData.curriculum.coverage_percent >= 50 ? 'bg-amber-500' : 'bg-error'}`}
                                    style={{ width: `${monitoringData.curriculum.coverage_percent}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined animate-spin text-primary text-2xl block">sync</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GovMonitoring;
