import React from 'react';
import { useTranslation } from 'react-i18next';

const GovSupport: React.FC = () => {
    const { t } = useTranslation('gov');
    return (
        <div className="max-w-[1600px] mx-auto space-y-8 text-center py-20">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-primary">support_agent</span>
            </div>
            <h1 className="text-4xl font-black text-on-surface tracking-tight mb-2">{t('Government Support Center')}</h1>
            <p className="text-on-surface-variant max-w-lg mx-auto mb-8">{t('Direct technical and administrative assistance for MINESEC delegates and inspectors.')}</p>
            <button className="bg-primary text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest shadow-lg hover:translate-y-[-2px] transition-all">{t('Open Support Ticket')}</button>
        </div>
    );
};

export default GovSupport;