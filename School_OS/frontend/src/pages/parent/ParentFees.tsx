import React, { useEffect, useState } from 'react';
import { parentApi } from '../../services/parentApi';
import { useParentStore } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';

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
}

interface PaymentModalProps {
    invoice: Invoice;
    onClose: () => void;
    onSuccess: () => void;
}

const ParentFees: React.FC = () => {
    const { dashboardData } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const wards = dashboardData?.wards || [];
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

    const fetchFees = async () => {
        try {
            const data = await parentApi.getFees();
            setInvoices(Array.isArray(data) ? data : []);
        } catch {
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFees();
    }, []);

    const totalPaid = invoices.reduce((sum, i) => sum + parseFloat(i.amount_paid || '0'), 0);
    const totalBilled = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || '0'), 0);
    const totalBalance = invoices.reduce((sum, i) => sum + parseFloat(i.balance || '0'), 0);
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
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">School Fees</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {wards.length > 0 ? `For ${wards.map(w => w.first_name).join(', ')}` : 'Fee overview'}
                </p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-red-500 text-xl mb-2 block">account_balance_wallet</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Outstanding</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{totalBalance.toLocaleString()} <span className="text-sm font-semibold text-slate-500">XAF</span></p>
                    {unpaidCount > 0 && (
                        <p className="text-xs text-red-500 font-semibold mt-1">{unpaidCount} unpaid</p>
                    )}
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-500 text-xl mb-2 block">check_circle</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Paid</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{totalPaid.toLocaleString()} <span className="text-sm font-semibold text-slate-500">XAF</span></p>
                    <p className="text-xs text-slate-400 mt-1">of {totalBilled.toLocaleString()} {schoolConfig.currency_symbol} total</p>
                </div>
            </div>

            {/* Big Pay Button (if outstanding) */}
            {totalBalance > 0 && (
                <button
                    onClick={() => {
                        const firstUnpaid = invoices.find(i => i.status !== 'paid');
                        if (firstUnpaid) setPayingInvoice(firstUnpaid);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-500/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-xl">smartphone</span>
                    Pay {totalBalance.toLocaleString()} {schoolConfig.currency_symbol} Now
                </button>
            )}

            {totalBalance <= 0 && invoices.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                    <span className="material-symbols-outlined text-emerald-500 text-3xl mb-1 block">check_circle</span>
                    <p className="font-bold text-emerald-900">All Fees Paid</p>
                    <p className="text-sm text-emerald-600">No outstanding balance</p>
                </div>
            )}

            {/* Fee Bills List */}
            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Fee Bills</h2>
                {invoices.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">receipt</span>
                        <p className="text-slate-500 font-medium">No fee bills found</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {invoices.map((inv) => (
                            <InvoiceCard
                                key={inv.id}
                                invoice={inv}
                                onPay={() => setPayingInvoice(inv)}
                            />
                        ))}
                    </div>
                )}
            </section>

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

function InvoiceCard({ invoice, onPay }: { invoice: Invoice; onPay: () => void }) {
    const { schoolConfig } = useTenantStore();
    const balance = parseFloat(invoice.balance || '0');
    const total = parseFloat(invoice.total_amount || '0');
    const paid = parseFloat(invoice.amount_paid || '0');
    const isPaid = invoice.status === 'paid';

    return (
        <div className={`bg-white rounded-2xl p-4 border shadow-sm ${isPaid ? 'border-slate-100' : 'border-red-200'}`}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                    {invoice.student_name && (
                        <p className="text-xs text-slate-500 mt-0.5">{invoice.student_name}</p>
                    )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isPaid ? 'bg-emerald-100 text-emerald-700' :
                    invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {isPaid ? 'Paid' : invoice.status === 'partial' ? 'Partial' : 'Unpaid'}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-sm font-bold text-slate-900">{total.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Paid</p>
                    <p className="text-sm font-bold text-emerald-600">{paid.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Balance</p>
                    <p className="text-sm font-bold text-red-600">{balance.toLocaleString()} {schoolConfig.currency_symbol}</p>
                </div>
            </div>

            {invoice.due_date && (
                <p className="text-xs text-slate-400 mb-3">
                    Due: {new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
            )}

            {!isPaid && (
                <button
                    onClick={onPay}
                    className="w-full py-2.5 bg-blue-900 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">smartphone</span>
                    Pay Now
                </button>
            )}
        </div>
    );
}

function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
    const balance = parseFloat(invoice.balance || '0');
    const { schoolConfig } = useTenantStore();
    const [method, setMethod] = useState<string>(schoolConfig.payment_methods[0] || 'mtn_momo');
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState(String(balance));
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<'form' | 'confirming' | 'success' | 'error'>('form');
    const [refNumber, setRefNumber] = useState('');

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
                            <h3 className="text-xl font-bold text-slate-900">Pay Fees</h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>

                        {/* Bill Info */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-5">
                            <p className="text-sm font-medium text-slate-500">{invoice.invoice_number}</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{balance.toLocaleString()} {schoolConfig.currency_symbol}</p>
                            <p className="text-xs text-slate-400 mt-1">Outstanding balance</p>
                        </div>

                        {/* Payment Method */}
                        <p className="text-sm font-bold text-slate-700 mb-2">Payment Method</p>
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
                                        {methodLabels[m]}
                                    </span>
                                    {method === m && <span className="material-symbols-outlined text-blue-900 ml-auto text-lg">check_circle</span>}
                                </button>
                            ))}
                        </div>

                        {/* Phone Number (for Mobile Money) */}
                        {isMobileMoney && (
                            <div className="mb-5">
                                <label className="text-sm font-bold text-slate-700 mb-1.5 block">Phone Number</label>
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
                            <label className="text-sm font-bold text-slate-700 mb-1.5 block">Amount (XAF)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={1}
                                max={balance}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">Maximum: {balance.toLocaleString()} {schoolConfig.currency_symbol}</p>
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
                                    Confirm Payment
                                </>
                            )}
                        </button>
                    </>
                )}

                {step === 'confirming' && (
                    <div className="flex flex-col items-center py-12 gap-4">
                        <span className="material-symbols-outlined animate-spin text-blue-900 text-4xl">sync</span>
                        <p className="text-slate-700 font-semibold">Processing payment...</p>
                        <p className="text-sm text-slate-400">Please do not close this window</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Payment Initiated</h3>
                        <p className="text-sm text-slate-500">
                            Your payment of {parseFloat(amount).toLocaleString()} {schoolConfig.currency_symbol} via {methodLabels[method]} is being processed.
                        </p>
                        <div className="bg-slate-50 rounded-xl px-4 py-3 mt-2">
                            <p className="text-xs text-slate-500">Reference Number</p>
                            <p className="font-mono font-bold text-slate-900">{refNumber}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                            You will receive an SMS confirmation shortly.
                        </p>
                        <button
                            onClick={() => { onSuccess(); }}
                            className="mt-4 px-8 py-3 bg-blue-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
                        >
                            Done
                        </button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Payment Failed</h3>
                        <p className="text-sm text-slate-500">Something went wrong. Please try again.</p>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep('form')}
                                className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ParentFees;
