import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parentApi, type ReceiptRecord } from '../../services/parentApi';
import { useParentStore } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';
import { downloadPdf, openPdfInNewTab } from '../../utils/pdf';

interface ChildReceiptGroup {
    student_id: string;
    student_name: string;
    receipts: ReceiptRecord[];
    totalPaid: number;
}

const ParentReceipts = () => {
    const { t } = useTranslation('parent');
    const { dashboardData } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const wards = dashboardData?.wards || [];
    const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    const fetchReceipts = async () => {
        setLoading(true);
        try {
            const data = await parentApi.getReceipts();
            setReceipts(Array.isArray(data) ? data : []);
        } catch {
            setReceipts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReceipts();
    }, []);

    const groups = useMemo(() => {
        const map = new Map<string, ChildReceiptGroup>();
        receipts.forEach(r => {
            const sid = r.student_id || 'unknown';
            if (!map.has(sid)) {
                map.set(sid, { student_id: sid, student_name: r.student_name || t('Unknown'), receipts: [], totalPaid: 0 });
            }
            const g = map.get(sid)!;
            g.receipts.push(r);
            g.totalPaid += parseFloat(r.amount || '0');
        });
        const arr = Array.from(map.values()).sort((a, b) => a.student_name.localeCompare(b.student_name));
        arr.forEach(g => g.receipts.sort((a, b) => b.payment_date.localeCompare(a.payment_date)));
        return arr;
    }, [receipts]);

    const selectedGroup = groups.find(g => g.student_id === selectedChildId) || groups[0];

    useEffect(() => {
        if (!selectedChildId && groups.length > 0) {
            setSelectedChildId(groups[0].student_id);
        }
    }, [groups, selectedChildId]);

    const totalPaidAll = groups.reduce((s, g) => s + g.totalPaid, 0);

    if (loading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-28 bg-slate-200 rounded-2xl" />
                    <div className="h-28 bg-slate-200 rounded-2xl" />
                </div>
                <div className="h-64 bg-slate-200 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 pb-6">
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{t('Payment Receipts')}</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {wards.length > 0 ? t('For {{names}}', { names: wards.map(w => w.first_name).join(', ') }) : t('Receipt archive')}
                </p>
            </header>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-blue-900 text-xl mb-2 block">receipt_long</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">{t('Receipts')}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{receipts.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-500 text-xl mb-2 block">payments</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">{t('Total Paid')}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{totalPaidAll.toLocaleString()} <span className="text-sm font-semibold text-slate-500">{schoolConfig.currency_symbol}</span></p>
                </div>
            </div>

            {groups.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {groups.map(g => (
                        <button
                            key={g.student_id}
                            onClick={() => setSelectedChildId(g.student_id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                                selectedGroup?.student_id === g.student_id
                                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {g.student_name.split(' ')[0]}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedGroup?.student_id === g.student_id ? 'bg-white/20' : 'bg-slate-100'}`}>{g.receipts.length}</span>
                        </button>
                    ))}
                </div>
            )}

            {selectedGroup && (
                <div className="flex flex-col gap-2">
                    {selectedGroup.receipts.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">receipt</span>
                            <p className="text-slate-500 font-medium">{t('No receipts yet')}</p>
                            <p className="text-xs text-slate-400 mt-1">{t('Once a fee payment is recorded, its official receipt appears here and can be downloaded or printed at any time.')}</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-900">{selectedGroup.student_name}</p>
                                    <p className="text-xs text-slate-400">{t(selectedGroup.receipts.length > 1 ? '{{count}} receipts' : '{{count}} receipt', { count: selectedGroup.receipts.length })}</p>
                                </div>
                                <p className="font-black text-emerald-600">{selectedGroup.totalPaid.toLocaleString()} {schoolConfig.currency_symbol}</p>
                            </div>
                            {selectedGroup.receipts.map(r => (
                                <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-mono font-bold text-slate-900">{r.receipt_number}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {new Date(r.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {' · '}{r.invoice_number}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">{r.method}{r.reference ? ` · ${r.reference}` : ''}</p>
                                            {r.academic_year && <p className="text-xs text-slate-400 mt-0.5">{r.academic_year}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-slate-900">{parseFloat(r.amount).toLocaleString()} {schoolConfig.currency_symbol}</p>
                                            {r.balance_after !== null && (
                                                <p className={`text-[11px] font-semibold mt-0.5 ${Number(r.balance_after) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {Number(r.balance_after) > 0 ? t('Balance: {{amount}}', { amount: Number(r.balance_after).toLocaleString() }) : t('Fully settled')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => openPdfInNewTab(parentApi.receiptDownloadUrl(r.id), `receipt_${r.receipt_number}.pdf`)}
                                            className="flex-1 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">print</span>
                                            {t('Print')}
                                        </button>
                                        <button
                                            onClick={() => downloadPdf(parentApi.receiptDownloadUrl(r.id), `receipt_${r.receipt_number}.pdf`)}
                                            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">download</span>
                                            {t('Download')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {groups.length === 0 && (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
                    <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">receipt_long</span>
                    <p className="text-slate-500 font-medium">{t('No payment receipts yet')}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{t('When the school records a fee payment — whether cash at the office or paid online — the official receipt will appear here, ready to download or print at any time.')}</p>
                </div>
            )}
        </div>
    );
};

export default ParentReceipts;
