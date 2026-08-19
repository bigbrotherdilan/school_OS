import React from 'react';
import { useTranslation } from 'react-i18next';

const GovPolicy: React.FC = () => {
    const { t } = useTranslation('gov');
    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-primary"></div>
                <h1 className="text-4xl font-black text-on-surface tracking-tight">{t('National Education Policy')}</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/10">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">gavel</span> {t('Legislative Framework')}
                    </h3>
                    <ul className="space-y-4">
                        <li className="p-4 bg-slate-50 rounded border border-outline-variant/10 flex justify-between items-center">
                            <span className="text-sm font-medium italic">{t('2024 Curriculum Standardization Act')}</span>
                            <span className="material-symbols-outlined text-outline">download</span>
                        </li>
                        <li className="p-4 bg-slate-50 rounded border border-outline-variant/10 flex justify-between items-center">
                            <span className="text-sm font-medium italic">{t('School Fee Regulation (Decree No. 401)')}</span>
                            <span className="material-symbols-outlined text-outline">download</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default GovPolicy;