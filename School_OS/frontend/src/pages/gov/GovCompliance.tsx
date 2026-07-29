import React, { useEffect, useState } from 'react';
import { useGovStore } from '../../stores/govStore';
import { api } from '../../services/api';

const GovCompliance: React.FC = () => {
    const { dashboardData, fetchDashboard } = useGovStore();
    const [_complianceScore, setComplianceScore] = useState<string>('...');
    const [recalculating, setRecalculating] = useState(false);
    const [recalcResult, setRecalcResult] = useState<any>(null);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleRecalculate = async () => {
        setRecalculating(true);
        try {
            const res = await api.post('/gov/recalculate/');
            setRecalcResult(res.data);
            setComplianceScore(res.data.overall_score);
        } catch {
            setComplianceScore('Error');
        } finally {
            setRecalculating(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/gov/export/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ministry_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            // silent
        }
    };

    const alerts = dashboardData?.alerts || [];

    return (
        <div className="max-w-[1600px] mx-auto space-y-12">
            <div className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-primary tracking-tight mb-2">Finance & Compliance</h1>
                    <p className="text-on-surface-variant font-medium">Governance oversight and national financial transparency matrix.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-white shadow-sm border border-outline-variant/20 text-on-surface text-sm font-semibold rounded hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Export Report
                    </button>
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="px-6 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined text-lg ${recalculating ? 'animate-spin' : ''}`}>refresh</span>
                        {recalculating ? 'Recalculating...' : 'Recalculate Compliance'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <section className="bg-primary-container p-8 rounded-xl shadow-lg relative overflow-hidden">
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col">
                        <span className="text-on-primary-container text-[10px] font-bold tracking-widest uppercase mb-2">Total Schools</span>
                        <div className="text-4xl font-black text-white tracking-tighter">{dashboardData?.overview.total_schools || 0}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-on-primary-container text-[10px] font-bold tracking-widest uppercase mb-2">Total Students</span>
                        <div className="text-4xl font-black text-white tracking-tighter">{dashboardData?.overview.total_students || 0}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-on-primary-container text-[10px] font-bold tracking-widest uppercase mb-2">National Attendance</span>
                        <div className="text-4xl font-black text-white tracking-tighter">{dashboardData?.overview.national_attendance_rate || 0}%</div>
                        <div className="h-2 w-full bg-white/20 rounded-full mt-4">
                            <div className="h-full bg-white rounded-full" style={{ width: `${dashboardData?.overview.national_attendance_rate || 0}%` }}></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Compliance Scores */}
            {recalcResult && (
                <section className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                    <h3 className="text-xl font-bold mb-6">Compliance Breakdown</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {Object.entries(recalcResult.scores || {}).map(([key, value]) => (
                            <div key={key} className="p-4 bg-slate-50 rounded-lg">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant capitalize">{key}</p>
                                <p className="text-2xl font-black text-on-surface mt-1">{value as number}%</p>
                            </div>
                        ))}
                        <div className="p-4 bg-primary-container rounded-lg">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-primary-container">Overall</p>
                            <p className="text-2xl font-black text-primary mt-1">{recalcResult.overall_score}</p>
                        </div>
                    </div>
                </section>
            )}

            {/* Alerts */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-primary"></div>
                    <h3 className="text-2xl font-bold">Compliance Alerts</h3>
                </div>
                <div className="space-y-4">
                    {alerts.length === 0 ? (
                        <div className="p-8 bg-white rounded-xl text-center shadow-sm border border-outline-variant/10">
                            <span className="material-symbols-outlined text-4xl text-emerald-300 mb-2 block">check_circle</span>
                            <p className="text-on-surface-variant font-medium">No compliance alerts.</p>
                        </div>
                    ) : (
                        alerts.map(alert => (
                            <div key={alert.id} className={`p-5 rounded-r-lg shadow-sm border-l-4 ${
                                alert.type === 'error' ? 'bg-error-container border-error' :
                                alert.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                                alert.type === 'success' ? 'bg-emerald-50 border-emerald-500' :
                                'bg-blue-50 border-blue-500'
                            }`}>
                                <div className="flex gap-4">
                                    <span className={`material-symbols-outlined ${
                                        alert.type === 'error' ? 'text-error' :
                                        alert.type === 'warning' ? 'text-amber-600' :
                                        alert.type === 'success' ? 'text-emerald-600' :
                                        'text-blue-600'
                                    }`}>
                                        {alert.type === 'error' ? 'dangerous' : alert.type === 'warning' ? 'warning' : alert.type === 'success' ? 'check_circle' : 'info'}
                                    </span>
                                    <div>
                                        <h6 className="font-bold leading-tight">{alert.title}</h6>
                                        <p className="text-xs opacity-80 mt-1">{alert.message}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default GovCompliance;
