import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parentApi, type ReceiptRecord } from '../../services/parentApi';
import { useParentStore } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';
import { downloadPdf, openPdfInNewTab } from '../../utils/pdf';

interface Invoice {
    id: string;
    invoice_number: string;
    total_amount: string;
    amount_paid: string;
    balance: string;
    status: string;
    due_date: string | null;
    academic_year?: string;
    student_name?: string;
    student_id?: string;
}

interface ChildFeeGroup {
    student_id: string;
    student_name: string;
    invoices: Invoice[];
    totalBalance: number;
    totalBilled: number;
    totalPaid: number;
}

interface PaymentModalProps {
    invoice: Invoice;
    onClose: () => void;
    onSuccess: () => void;
}

const ParentFees: React.FC = () => {
    const { t } = useTranslation('parent');
    const { dashboardData } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const wards = dashboardData?.wards || [];
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    const fetchFees = async () => {
        try {
            const [data, receiptData] = await Promise.all([parentApi.getFees(), parentApi.getReceipts()]);
            setInvoices(Array.isArray(data) ? data : []);
            setReceipts(Array.isArray(receiptData) ? receiptData : []);
        } catch {
            setInvoices([]);
            setReceipts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFees();
    }, []);

    const childGroups = useMemo(() => {
        const map = new Map<string, ChildFeeGroup>();
        invoices.forEach(inv => {
            const sid = inv.student_id || 'unknown';
            if (!map.has(sid)) {
                map.set(sid, {
                    student_id: sid,
                    student_name: inv.student_name || t('Unknown'),
                    invoices: [],
                    totalBalance: 0,
                    totalBilled: 0,
                    totalPaid: 0,
                });
            }
            const group = map.get(sid)!;
            group.invoices.push(inv);
            group.totalBalance += parseFloat(inv.balance || '0');
            group.totalBilled += parseFloat(inv.total_amount || '0');
            group.totalPaid += parseFloat(inv.amount_paid || '0');
        });
        return Array.from(map.values()).sort((a, b) => a.student_name.localeCompare(b.student_name));
    }, [invoices]);

    const selectedGroup = childGroups.find(g => g.student_id === selectedChildId) || childGroups[0];

    useEffect(() => {
        if (!selectedChildId && childGroups.length > 0) {
            setSelectedChildId(childGroups[0].student_id);
        }
    }, [childGroups, selectedChildId]);

    const totalBalance = childGroups.reduce((s, g) => s + g.totalBalance, 0);
    const totalBilled = childGroups.reduce((s, g) => s + g.totalBilled, 0);
    const totalPaid = childGroups.reduce((s, g) => s + g.totalPaid, 0);
    const unpaidCount = invoices.filter(i => i.status !== 'paid').length;

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
            {/* Header */}
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{t('School Fees')}</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {wards.length > 0 ? t('For {{names}}', { names: wards.map(w => w.first_name).join(', ') }) : t('Fee overview')}
                </p>
            </header>

            {/* Overall Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-red-500 text-xl mb-2 block">account_balance_wallet</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">{t('Outstanding')}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{totalBalance.toLocaleString()} <span className="text-sm font-semibold text-slate-500">{t('XAF')}</span></p>
                    {unpaidCount > 0 && (
                        <p className="text-xs text-red-500 font-semibold mt-1">{t('{{count}} unpaid', { count: unpaidCount })}</p>
                    )}
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-500 text-xl mb-2 block">check_circle</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">{t('Paid')}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{totalPaid.toLocaleString()} <span className="text-sm font-semibold text-slate-500">{t('XAF')}</span></p>
                    <p className="text-xs text-slate-400 mt-1">{t('of {{amount}} {{currency}} total', { amount: totalBilled.toLocaleString(), currency: schoolConfig.currency_symbol })}</p>
                </div>
            </div>

            {/* Child Tabs */}
            {childGroups.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {childGroups.map(group => {
                        const isSelected = group.student_id === selectedGroup?.student_id;
                        const hasBalance = group.totalBalance > 0;
                        return (
                            <button
                                key={group.student_id}
                                onClick={() => setSelectedChildId(group.student_id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                                    isSelected
                                        ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                                        : hasBalance
                                            ? 'bg-red-50 text-red-700 border-red-200'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {group.student_name.split(' ')[0]}
                                {hasBalance && <span className="w-2 h-2 rounded-full bg-red-500" />}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Selected Child Section */}
            {selectedGroup && (
                <>
                    {/* Child Summary */}
                    {selectedGroup.totalBalance > 0 ? (
                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/20">
                            <p className="text-sm text-red-100 font-medium">{selectedGroup.student_name}</p>
                            <p className="text-2xl font-black tracking-tight mt-1">
                                {selectedGroup.totalBalance.toLocaleString()} <span className="text-base font-bold text-red-200">{schoolConfig.currency_symbol}</span>
                            </p>
                            <p className="text-xs text-red-100 mt-0.5">{t(selectedGroup.invoices.length > 1 ? '{{count}} invoices outstanding' : '{{count}} invoice outstanding', { count: selectedGroup.invoices.length })}</p>
                            <button
                                onClick={() => {
                                    const firstUnpaid = selectedGroup.invoices.find(i => i.status !== 'paid');
                                    if (firstUnpaid) setPayingInvoice(firstUnpaid);
                                }}
                                className="mt-4 w-full py-3 bg-white text-red-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-lg"
                            >
                                <span className="material-symbols-outlined text-lg">smartphone</span>
                                {t('Pay {{amount}} {{currency}} Now', { amount: selectedGroup.totalBalance.toLocaleString(), currency: schoolConfig.currency_symbol })}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                                <div>
                                    <p className="font-bold text-lg">{selectedGroup.student_name}</p>
                                    <p className="text-sm text-white/80">{t('All fees paid')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Invoices for this child */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-900 mb-3">{t('Invoices')}</h2>
                        <div className="flex flex-col gap-2">
                            {selectedGroup.invoices.map((inv) => (
                                <InvoiceCard
                                    key={inv.id}
                                    invoice={inv}
                                    receipts={receipts.filter(r => r.invoice === inv.id)}
                                    onPay={() => setPayingInvoice(inv)}
                                />
                            ))}
                        </div>
                    </section>
                </>
            )}

            {childGroups.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">receipt</span>
                    <p className="text-slate-500 font-medium">{t('No fees found')}</p>
                </div>
            )}

            {/* Payment Modal */}
            {payingInvoice && (
                <PaymentModal
                    invoice={payingInvoice}
                    onClose={() => setPayingInvoice(null)}
                    onSuccess={() => {
                        setPayingInvoice(null);
                        fetchFees();
                    }}
                />
            )}
        </div>
    );
};

function InvoiceCard({ invoice, receipts, onPay }: { invoice: Invoice; receipts: ReceiptRecord[]; onPay: () => void }) {
    const { t } = useTranslation('parent');
    const { schoolConfig } = useTenantStore();
    const balance = parseFloat(invoice.balance || '0');
    const total = parseFloat(invoice.total_amount || '0');
    const paid = parseFloat(invoice.amount_paid || '0');
    const isPaid = invoice.status === 'paid';

    const handleStatement = () => {
        openPdfInNewTab(parentApi.statementUrl(invoice.id), `statement_${invoice.invoice_number}.pdf`);
    };

    return (
        <div className={`bg-white rounded-2xl p-4 border shadow-sm ${isPaid ? 'border-slate-100' : 'border-red-200'}`}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                    {invoice.academic_year && (
                        <p className="text-xs text-slate-400 mt-0.5">{invoice.academic_year}</p>
                    )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isPaid ? 'bg-emerald-100 text-emerald-700' :
                    invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {isPaid ? t('Paid') : invoice.status === 'partial' ? t('Incomplete Payment') : t('Unpaid')}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                    <p className="text-xs text-slate-500">{t('Total')}</p>
                    <p className="text-sm font-bold text-slate-900">{total.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">{t('Paid')}</p>
                    <p className="text-sm font-bold text-emerald-600">{paid.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">{t('Balance')}</p>
                    <p className="text-sm font-bold text-red-600">{balance.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
            </div>

            {invoice.due_date && (
                <p className="text-xs text-slate-400 mb-3">
                    {t('Due: {{date}}', { date: new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) })}
                </p>
            )}

            {receipts.length > 0 && (
                <div className="border-t border-slate-100 pt-3 mt-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        {t('Receipts ({{count}})', { count: receipts.length })}
                    </p>
                    <div className="flex flex-col gap-1.5">
                        {receipts.map(r => (
                            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-xl bg-slate-50">
                                <div className="min-w-0">
                                    <p className="font-mono text-xs font-bold text-slate-800 truncate">{r.receipt_number}</p>
                                    <p className="text-[11px] text-slate-400">
                                        {new Date(r.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        {' · '}{r.method}{r.balance_after !== null && Number(r.balance_after) > 0 ? ` · ${t('bal {{amount}}', { amount: Number(r.balance_after).toLocaleString() })}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => downloadPdf(parentApi.receiptDownloadUrl(r.id), `receipt_${r.receipt_number}.pdf`)}
                                        className="p-2 rounded-lg text-blue-900 hover:bg-blue-50 transition-colors"
                                        title={t('Download receipt')}
                                    >
                                        <span className="material-symbols-outlined text-lg">download</span>
                                    </button>
                                    <button
                                        onClick={() => openPdfInNewTab(parentApi.receiptDownloadUrl(r.id), `receipt_${r.receipt_number}.pdf`)}
                                        className="p-2 rounded-lg text-blue-900 hover:bg-blue-50 transition-colors"
                                        title={t('Print receipt')}
                                    >
                                        <span className="material-symbols-outlined text-lg">print</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleStatement}
                        className="mt-2 w-full py-2 text-xs font-bold text-blue-900 border border-blue-100 bg-blue-50/50 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-base">description</span>
                        {t('Download Statement')}
                    </button>
                </div>
            )}

            {!isPaid && (
                <button
                    onClick={onPay}
                    className="w-full py-2.5 bg-blue-900 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">smartphone</span>
                    {t('Pay Now')}
                </button>
            )}
        </div>
    );
}

function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
    const { t } = useTranslation('parent');
    const balance = parseFloat(invoice.balance || '0');
    const { schoolConfig } = useTenantStore();
    const [method, setMethod] = useState<string>(schoolConfig.payment_methods[0] || 'mtn_momo');
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState(String(balance));
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<'form' | 'confirming' | 'success' | 'error'>('form');
    const [refNumber, setRefNumber] = useState('');
    const [transactionId, setTransactionId] = useState('');

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await parentApi.initiatePayment({
                invoice_id: invoice.id,
                amount: parseFloat(amount),
                payment_method: method,
                phone_number: phone,
            });
            setRefNumber(res.reference_number || 'N/A');
            setTransactionId(res.transaction_id || '');
            setStep('success');
        } catch {
            setStep('error');
        } finally {
            setSubmitting(false);
        }
    };

    const methodLabels: Record<string, string> = {
        mtn_momo: 'MTN Mobile Money',
        orange_money: 'Orange Money',
        bank_transfer: 'Bank Transfer',
    };

    const isMobileMoney = method === 'mtn_momo' || method === 'orange_money';

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                {step === 'form' && (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-900">{t('Pay Fees')}</h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>

                        {/* Fee Info */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-5">
                            <p className="text-sm font-medium text-slate-500">{invoice.invoice_number}</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{balance.toLocaleString()} {schoolConfig.currency_symbol}</p>
                            <p className="text-xs text-slate-400 mt-1">{t('Outstanding balance')}</p>
                        </div>

                        {/* Payment Method */}
                        <p className="text-sm font-bold text-slate-700 mb-2">{t('Payment Method')}</p>
                        <div className="flex flex-col gap-2 mb-5">
                            {schoolConfig.payment_methods.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMethod(m)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                        method === m
                                            ? 'border-blue-900 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined ${method === m ? 'text-blue-900' : 'text-slate-400'}`}>
                                        {m === 'mtn_momo' ? 'smartphone' : m === 'orange_money' ? 'phone_android' : 'account_balance'}
                                    </span>
                                    <span className={`font-semibold text-sm ${method === m ? 'text-blue-900' : 'text-slate-700'}`}>
                                        {t(methodLabels[m])}
                                    </span>
                                    {method === m && <span className="material-symbols-outlined text-blue-900 ml-auto text-lg">check_circle</span>}
                                </button>
                            ))}
                        </div>

                        {/* Phone Number (for Mobile Money) */}
                        {isMobileMoney && (
                            <div className="mb-5">
                                <label className="text-sm font-bold text-slate-700 mb-1.5 block">{t('Phone Number')}</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={schoolConfig.phone_format_placeholder}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none"
                                />
                            </div>
                        )}

                        {/* Amount */}
                        <div className="mb-6">
                            <label className="text-sm font-bold text-slate-700 mb-1.5 block">{t('Amount (XAF)')}</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={1}
                                max={balance}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">{t('Maximum: {{amount}} {{currency}}', { amount: balance.toLocaleString(), currency: schoolConfig.currency_symbol })}</p>
                            <p className="text-xs text-blue-900/70 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">install_mobile</span>
                                {t('You can pay in installments — each payment gets its own official receipt.')}
                            </p>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!amount || parseFloat(amount) <= 0 || (isMobileMoney && !phone) || submitting}
                            className="w-full py-4 bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-xl font-bold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <span className="material-symbols-outlined animate-spin">sync</span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">lock</span>
                                    {t('Confirm Payment')}
                                </>
                            )}
                        </button>
                    </>
                )}

                {step === 'confirming' && (
                    <div className="flex flex-col items-center py-12 gap-4">
                        <span className="material-symbols-outlined animate-spin text-blue-900 text-4xl">sync</span>
                        <p className="text-slate-700 font-semibold">{t('Processing payment...')}</p>
                        <p className="text-sm text-slate-400">{t('Please do not close this window')}</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{t('Payment Received')}</h3>
                        <p className="text-sm text-slate-500">
                            {t('Your payment of {{amount}} {{currency}} via {{method}} has been recorded.', {
                                amount: parseFloat(amount).toLocaleString(),
                                currency: schoolConfig.currency_symbol,
                                method: t(methodLabels[method]),
                            })}
                        </p>
                        <div className="bg-slate-50 rounded-xl px-4 py-3 mt-2">
                            <p className="text-xs text-slate-500">{t('Receipt Number')}</p>
                            <p className="font-mono font-bold text-slate-900">{refNumber}</p>
                        </div>
                        {transactionId && (
                            <div className="w-full flex flex-col gap-2 mt-1">
                                <button
                                    onClick={() => openPdfInNewTab(parentApi.receiptDownloadUrl(transactionId), `receipt_${refNumber}.pdf`)}
                                    className="w-full py-3 bg-blue-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">print</span>
                                    {t('Print Receipt')}
                                </button>
                                <button
                                    onClick={() => downloadPdf(parentApi.receiptDownloadUrl(transactionId), `receipt_${refNumber}.pdf`)}
                                    className="w-full py-3 border border-slate-200 rounded-xl font-semibold text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    {t('Download Receipt')}
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-slate-400">
                            {t('Your receipts are always available under Receipts on the parent portal.')}
                        </p>
                        <button
                            onClick={() => { onSuccess(); }}
                            className="mt-1 px-8 py-3 bg-blue-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
                        >
                            {t('Done')}
                        </button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{t('Payment Failed')}</h3>
                        <p className="text-sm text-slate-500">{t('Something went wrong. Please try again.')}</p>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                {t('Cancel')}
                            </button>
                            <button
                                onClick={() => setStep('form')}
                                className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
                            >
                                {t('Try Again')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ParentFees;
