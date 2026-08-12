import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';
import { api } from '../../services/api';

interface VerifyResult {
    valid: boolean;
    receipt_number?: string;
    verification_code?: string;
    school?: string;
    student?: string;
    amount?: string;
    payment_date?: string;
    method?: string;
    currency?: string;
    detail?: string;
}

export default function ReceiptVerify() {
    const [value, setValue] = useState('');
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const normalize = (raw: string) => raw.trim().toUpperCase().replace(/^RCT[-/]?/, '');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        const num = normalize(value);
        if (!num) { setError('Enter a receipt number to verify.'); return; }
        setError('');
        setLoading(true);
        setResult(null);
        try {
            const res = await api.get(`/finance/receipts/verify/${encodeURIComponent(num)}/`);
            setResult(res.data);
        } catch (err) {
            const httpErr = err as { response?: { status?: number; data?: VerifyResult } };
            if (httpErr.response?.status === 404 && httpErr.response?.data) {
                setResult(httpErr.response.data);
            } else {
                setResult({ valid: false, detail: 'Could not reach the verification service. Check your connection and try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface text-on-surface min-h-screen flex flex-col">
            <PublicNavbar />

            <main className="flex-1 pt-28 pb-20 px-6">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full mb-5">
                            <span className="material-symbols-outlined text-primary text-base">verified</span>
                            <span className="text-xs font-bold tracking-widest text-primary uppercase">Public Authenticity Check</span>
                        </span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tighter">
                            Verify a Fee Receipt
                        </h1>
                        <p className="max-w-lg mx-auto text-on-surface-variant mt-4 leading-relaxed">
                            Enter the receipt number printed on any fee receipt issued by a school on School OS.
                            We will confirm whether the receipt is genuine and show a few details so you can
                            compare them with your paper copy.
                        </p>
                    </div>

                    {/* Lookup card */}
                    <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-8">
                        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">receipt_long</span>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => { setValue(e.target.value); setResult(null); }}
                                    placeholder="e.g. RCT-X6MYBNUP"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    className="w-full bg-surface-container-low border border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl pl-12 pr-4 py-4 text-sm font-bold uppercase tracking-widest transition-all placeholder:text-on-surface-variant/40"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !value.trim()}
                                className="px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-lg">verified</span>
                                )}
                                {loading ? 'Checking...' : 'Verify'}
                            </button>
                        </form>

                        {error && (
                            <p className="mt-4 text-sm font-semibold text-error">{error}</p>
                        )}

                        {result && (
                            result.valid ? (
                                <div className="mt-8">
                                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
                                        <span className="material-symbols-outlined text-emerald-600 text-2xl">verified</span>
                                        <div>
                                            <p className="font-black text-emerald-800">Genuine receipt</p>
                                            <p className="text-xs text-emerald-700 font-medium">This receipt number matches an official payment record.</p>
                                        </div>
                                    </div>

                                    <dl className="mt-6 rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/10 overflow-hidden bg-surface-container-lowest">
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Receipt No.</dt>
                                            <dd className="col-span-2 font-mono text-sm font-bold text-on-surface">{result.receipt_number}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">School</dt>
                                            <dd className="col-span-2 text-sm font-bold text-on-surface">{result.school}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Student</dt>
                                            <dd className="col-span-2 text-sm font-bold text-on-surface">{result.student}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Amount</dt>
                                            <dd className="col-span-2 text-sm font-black text-on-surface">{Number(result.amount).toLocaleString()} {result.currency}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Paid On</dt>
                                            <dd className="col-span-2 text-sm font-bold text-on-surface">{result.payment_date}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Method</dt>
                                            <dd className="col-span-2 text-sm font-bold text-on-surface capitalize">{result.method}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 px-5 py-3.5 bg-surface-container-low/60">
                                            <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Security Code</dt>
                                            <dd className="col-span-2 font-mono text-sm font-black text-primary">{result.verification_code}</dd>
                                        </div>
                                    </dl>

                                    <p className="mt-4 text-xs text-on-surface-variant/70 leading-relaxed">
                                        Compare the student name and amount above with your paper receipt. The security code
                                        is a machine-readable authenticity signature — a valid code confirms the receipt was
                                        issued by the school named above.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-8 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                                    <span className="material-symbols-outlined text-error text-2xl">gpp_bad</span>
                                    <div>
                                        <p className="font-black text-red-800">Not found</p>
                                        <p className="text-xs text-red-700 font-medium mt-0.5">{result.detail || 'No official receipt matches this number.'}</p>
                                        <p className="text-xs text-red-600/70 mt-1">Double-check the number on your paper copy, or ask the school's bursar for the correct receipt number.</p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <p className="mt-6 text-center text-xs text-on-surface-variant/70">
                        Don't have a receipt to check?{' '}
                        <Link to="/login" className="font-bold text-primary hover:underline">Sign in to your portal</Link> to view or print your receipts.
                    </p>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}
