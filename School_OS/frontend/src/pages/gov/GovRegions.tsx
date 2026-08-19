import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGovStore } from '../../stores/govStore';

const GovRegions: React.FC = () => {
    const { t } = useTranslation('gov');
    const { dashboardData, isLoading, fetchDashboard } = useGovStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const regions = dashboardData?.regional_distribution || [];
    const maxSchools = Math.max(...regions.map(r => r.schools_count), 1);

    return (
        <div className="max-w-[1600px] mx-auto space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <nav className="flex text-xs text-on-secondary-container mb-2 space-x-2">
                            <nav className="flex text-xs text-on-secondary-container mb-2 space-x-2">
                        <span>{t('National Dashboard')}</span>
                        <span className="opacity-50">/</span>
                        <span className="font-semibold text-primary">{t('Regional Monitoring')}</span>
                    </nav>
                    <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">{t('Regional & Institutional Monitoring')}</h1>
                    <p className="text-on-surface-variant mt-2">{t('Scope: {{scope}}', { scope: dashboardData?.overview.scope || t('National') })}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-outline-variant/10">
                    <span className="material-symbols-outlined animate-spin text-primary text-3xl mb-4 block">sync</span>
                    <p className="text-on-surface-variant font-medium">{t('Loading regional data...')}</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('Total Schools')}</p>
                            <h3 className="text-4xl font-black text-on-surface">{dashboardData?.overview.total_schools || 0}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('Total Students')}</p>
                            <h3 className="text-4xl font-black text-on-surface">{dashboardData?.overview.total_students || 0}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('National Attendance')}</p>
                            <h3 className="text-4xl font-black text-primary">{dashboardData?.overview.national_attendance_rate || 0}%</h3>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white p-8 rounded-xl flex flex-col shadow-sm border border-outline-variant/10">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1 h-6 bg-primary rounded-full"></div>
                            <h3 className="text-lg font-bold">{t('Regional Distribution')}</h3>
                        </div>
                        <div className="flex-1 flex items-end justify-between gap-4 px-4" style={{ minHeight: '200px' }}>
                            {regions.map(reg => (
                                <div key={reg.name} className="flex-1 flex flex-col items-center gap-3">
                                    <div className="w-full bg-primary/10 rounded-t-sm relative h-full flex items-end">
                                        <div
                                            className="w-full bg-primary rounded-t-sm transition-all"
                                            style={{ height: `${(reg.schools_count / maxSchools) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter text-center">{reg.name}</span>
                                    <span className="text-xs font-bold text-primary">{reg.schools_count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Regional Comparison Table */}
                    {regions.length > 0 && (
                        <section className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-primary"></div>
                                <h2 className="text-2xl font-extrabold text-on-surface">{t('Regional Comparison Table')}</h2>
                            </div>
                            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-outline-variant/10">
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-600">{t('Region')}</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-600">{t('Schools')}</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-600">{t('Students')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant/10">
                                        {regions.map(reg => (
                                            <tr key={reg.name} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-5 font-bold text-primary">{reg.name}</td>
                                                <td className="px-6 py-5 font-medium">{reg.schools_count}</td>
                                                <td className="px-6 py-5 font-medium">{reg.students_count || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default GovRegions;
