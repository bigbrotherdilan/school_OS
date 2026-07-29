import React, { useEffect } from 'react';
import { useGovStore } from '../../stores/govStore';

const GovAlerts: React.FC = () => {
    const { dashboardData, isLoading, fetchDashboard } = useGovStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const alerts = dashboardData?.alerts || [];

    const alertTypeConfig: Record<string, { icon: string; color: string; border: string }> = {
        warning: { icon: 'warning', color: 'text-amber-600', border: 'border-l-4 border-amber-500' },
        error: { icon: 'dangerous', color: 'text-error', border: 'border-l-4 border-error' },
        info: { icon: 'info', color: 'text-blue-600', border: 'border-l-4 border-blue-500' },
        success: { icon: 'check_circle', color: 'text-emerald-600', border: 'border-l-4 border-emerald-500' },
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-error"></div>
                <h1 className="text-4xl font-black text-on-surface tracking-tight">National Security Alerts</h1>
            </div>

            {isLoading ? (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm">
                    <span className="material-symbols-outlined animate-spin text-primary text-3xl mb-4 block">sync</span>
                    <p className="text-on-surface-variant font-medium">Loading alerts...</p>
                </div>
            ) : alerts.length === 0 ? (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-outline-variant/10">
                    <span className="material-symbols-outlined text-5xl text-emerald-300 mb-4 block">check_circle</span>
                    <h2 className="text-xl font-bold mb-2">No Active Alerts</h2>
                    <p className="text-on-surface-variant">All systems operating normally.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {alerts.map(alert => {
                        const config = alertTypeConfig[alert.type] || alertTypeConfig.info;
                        return (
                            <div key={alert.id} className={`bg-white p-6 rounded-xl shadow-sm border border-outline-variant/10 ${config.border}`}>
                                <div className={`flex items-center gap-2 ${config.color} font-bold text-xs uppercase tracking-widest mb-2`}>
                                    <span className="material-symbols-outlined text-sm">{config.icon}</span>
                                    {alert.type} Alert
                                </div>
                                <h3 className="text-lg font-bold mb-1">{alert.title}</h3>
                                <p className="text-sm text-on-surface-variant mb-4">{alert.message}</p>
                                <p className="text-[10px] text-on-surface-variant">{new Date(alert.date).toLocaleDateString()}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GovAlerts;
