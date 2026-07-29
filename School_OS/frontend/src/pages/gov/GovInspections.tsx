import React from 'react';

const GovInspections: React.FC = () => (
    <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex items-center gap-4">
            <div className="w-1.5 h-10 bg-primary"></div>
            <h1 className="text-4xl font-black text-on-surface tracking-tight">Inspectorate Command</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 className="font-bold">Active Inspection Missions</h3>
                <button className="bg-primary text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">Deploy Inspector</button>
            </div>
            <div className="p-8 text-center text-on-surface-variant italic">
                No active missions currently in the field.
            </div>
        </div>
    </div>
);

export default GovInspections;
