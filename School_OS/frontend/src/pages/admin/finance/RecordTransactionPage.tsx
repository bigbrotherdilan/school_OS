import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Wallet, Receipt, CheckCircle, Loader2, Lock, User, GraduationCap, Search, RefreshCw } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { useCanRecordFinance } from '../../../hooks/useCanRecordFinance';
import { downloadPdf, openPdfInNewTab } from '../../../utils/pdf';

export default function RecordTransactionPage() {
  const { t } = useTranslation('adminFinance');
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();
  const { roles } = useAuthStore();
  const isBursar = roles?.some((r) => r.role === 'bursar');
  const canRecord = useCanRecordFinance();
  const backPath = isBursar ? '/bursar' : '/admin/finance';
  const preSelectedStudentId = (location.state as any)?.studentId || '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const [sections, setSections] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [feeCategories, setFeeCategories] = useState<any[]>([]);

  const [selectedSection, setSelectedSection] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(preSelectedStudentId);
  const [quote, setQuote] = useState<any | null>(null);
  const [quoteError, setQuoteError] = useState('');

  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    notes: '',
    fee_category: ''
  });

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const [sectionsRes, classesRes, categoriesRes] = await Promise.all([
          api.get('/academic/sections/'),
          api.get('/academic/classes/'),
          api.get('/finance/categories/')
        ]);
        setSections(sectionsRes.data.results || sectionsRes.data);
        setClasses(classesRes.data.results || classesRes.data);
        setFeeCategories(categoriesRes.data.results || categoriesRes.data);
      } catch (error: any) {
        addToast(error.response?.data?.detail || t('Failed to load academic data.'), 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, [addToast]);

  const fetchQuote = useCallback(async (studentId: string) => {
    if (!studentId) return;
    setIsLoading(true);
    setQuoteError('');
    try {
      const response = await api.get(`/finance/payments/quote/?student=${studentId}`);
      setQuote(response.data);
      const invoice = response.data.invoice;
      const categories = response.data.categories || [];
      const due = invoice ? invoice.balance : response.data.total;
      if (due && parseFloat(due) > 0) {
        setFormData(prev => ({ ...prev, amount: due }));
      }
      if (categories.length > 0) {
        const first = categories[0];
        const prefilled = parseFloat(first.remaining) > 0 ? first.remaining : due;
        setFormData(prev => ({ ...prev, fee_category: first.id, amount: prefilled }));
      }
    } catch (error: any) {
      console.error("Quote error:", error);
      setQuoteError(error.response?.data?.detail || t('Failed to load fee breakdown.'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (preSelectedStudentId) {
      setSelectedStudentId(preSelectedStudentId);
      fetchQuote(preSelectedStudentId);
    }
  }, [preSelectedStudentId, fetchQuote]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setSelectedStudentId('');
      setQuote(null);
      return;
    }
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/students/students/?current_class=${selectedClass}&page_size=100`);
        setStudents(response.data.results || response.data);
      } catch (error: any) {
        addToast(error.response?.data?.detail || t('Failed to load students.'), 'error');
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClass, addToast]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setQuote(null);
    setFormData(prev => ({ ...prev, amount: '' }));
    fetchQuote(studentId);
  };

  const resetLocator = () => {
    setSelectedSection('');
    setSelectedClass('');
    setSelectedStudentId('');
    setQuote(null);
    setQuoteError('');
    setFormData({ amount: '', method: 'cash', reference: '', notes: '', fee_category: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'fee_category') {
      const selected = quote?.categories?.find((c: any) => c.id === value);
      if (selected && parseFloat(selected.remaining) > 0) {
        setFormData(prev => ({ ...prev, fee_category: value, amount: selected.remaining }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      addToast(t('Select a student first.'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post('/finance/payments/record/', {
        student_id: selectedStudentId,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference,
        notes: formData.notes,
        fee_category_id: formData.fee_category || undefined
      });
      setSuccess(response.data);
      addToast(t('Payment of CFA {{amount}} recorded. Receipt: {{receipt}}', { amount: response.data.transaction.amount, receipt: response.data.transaction.receipt_number }), 'success');
    } catch (error: any) {
      console.error("Payment error:", error);
      const data = error.response?.data;
      const detail = data?.detail || data?.amount?.[0] || t('Failed to record payment.');
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStudent = quote?.student || students.find((s: any) => s.id === selectedStudentId);
  const amountDue = quote?.invoice ? quote.invoice.balance : quote?.total || '';
  const noFeeConfig = quote && !quote.has_invoice && ((!quote.fees || quote.fees.length === 0) && (!quote.categories || quote.categories.length === 0));

  const handlePrintReceipt = async () => {
    const txn = success?.transaction;
    if (!txn?.id) return;
    setIsPrinting(true);
    try {
      await openPdfInNewTab(`/finance/transactions/${txn.id}/receipt/`, `receipt_${txn.receipt_number}.pdf`);
    } catch (error: any) {
      console.error("Receipt error:", error);
      addToast(error.response?.data?.detail || t('Failed to open receipt.'), 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadReceipt = async () => {
    const txn = success?.transaction;
    if (!txn?.id) return;
    setIsPrinting(true);
    try {
      await downloadPdf(`/finance/transactions/${txn.id}/receipt/`, `receipt_${txn.receipt_number}.pdf`);
    } catch (error: any) {
      console.error("Receipt error:", error);
      addToast(error.response?.data?.detail || t('Failed to download receipt.'), 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={() => navigate(backPath)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {t('Back to Treasury')}
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary/80 block mb-3">{t('Treasury Operations')}</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">{t('Record Payment')}</h1>
        <p className="text-on-surface-variant mt-2 text-lg">{t('Locate a student by class and collect their fees instantly — no invoice needed.')}</p>
      </section>

      {!canRecord && (
        <div className="mb-10 max-w-3xl bg-amber-50 border border-amber-200 rounded-3xl p-10 flex items-start gap-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-900">{t('Recording is restricted to the bursar')}</h3>
            <p className="text-sm text-amber-800/80 font-medium mt-2 leading-relaxed">
              {t('This school has enabled')} <strong>{t('Bursar Only')}</strong>{' '}
              {t('finance recording. Payments, expenses and fee generation can only be recorded by the bursar account. You can still view the treasury, invoices, and the student ledger.')}
            </p>
            <button
              onClick={() => navigate('/admin/finance')}
              className="mt-5 px-6 py-3 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all"
            >
              {t('Back to Treasury')}
            </button>
          </div>
        </div>
      )}

      {success ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="bg-emerald-600 p-10 text-center text-white">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/15 flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">{t('Payment Recorded')}</h2>
            <p className="text-emerald-100 mt-2 font-bold">
              {t('CFA {{amount}} credited to {{student}}', { amount: parseFloat(success.transaction.amount).toLocaleString(), student: success.transaction.student_name })}
            </p>
            <p className="mt-6 inline-block px-5 py-2 bg-white/10 rounded-full font-mono text-sm tracking-widest">
              {t('Official Receipt: {{receipt}}', { receipt: success.transaction.receipt_number })}
            </p>
            {success.transaction.fee_category_name && (
              <p className="mt-3 inline-block px-5 py-2 bg-white/10 rounded-full text-xs font-black uppercase tracking-widest">
                {t('Fee Category: {{category}}', { category: success.transaction.fee_category_name })}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {success.created_invoice && (
                <span className="px-4 py-1.5 bg-white/15 rounded-full text-xs font-black uppercase tracking-widest">
                  {t('Invoice auto-created')}
                </span>
              )}
              {success.activated && (
                <span className="px-4 py-1.5 bg-white/15 rounded-full text-xs font-black uppercase tracking-widest">
                  {t('Student activated')}
                </span>
              )}
            </div>
          </div>
          <div className="p-10 flex flex-col gap-3">
            <button
              onClick={handlePrintReceipt}
              disabled={isPrinting}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
              {t('Print Receipt Now')}
            </button>
            <button
              onClick={handleDownloadReceipt}
              disabled={isPrinting}
              className="flex items-center justify-center gap-3 px-8 py-4 border-2 border-secondary/30 text-secondary rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/5 active:scale-95 transition-all disabled:opacity-50"
            >
              <Wallet className="w-5 h-5" />
              {t('Download Receipt PDF')}
            </button>
            <button
              onClick={() => { setSuccess(null); resetLocator(); }}
              className="flex items-center justify-center gap-3 px-8 py-4 text-on-surface-variant rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all"
            >
              {t('Record Another Payment')}
            </button>
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center justify-center gap-3 px-8 py-4 text-on-surface-variant rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all"
            >
              {t('Back to Treasury')}
            </button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Form Area */}
        <div className={`md:col-span-2 space-y-8 ${!canRecord ? 'pointer-events-none opacity-40 select-none' : ''}`}>
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8">

            {/* Step 1: Locate student */}
            <div className="space-y-6 border-b border-outline-variant/10 pb-8">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <User className="text-secondary w-6 h-6" /> {t('Locate Student')}
              </h3>

              {selectedStudent ? (
                <div className="rounded-2xl border border-secondary/20 bg-secondary-container/15 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center">
                        <User className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="font-black text-on-surface">{selectedStudent.full_name || `${selectedStudent.first_name} ${selectedStudent.last_name}`}</p>
                        <p className="text-xs font-bold text-on-surface-variant">
                          {selectedStudent.admission_number || '—'}
                          {selectedStudent.class_display ? ` · ${selectedStudent.class_display}` : ''}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={resetLocator} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary hover:underline">
                      <RefreshCw className="w-3 h-3" /> {t('Change')}
                    </button>
                  </div>

                  {isLoading && (
                    <p className="flex items-center gap-2 text-xs font-bold text-secondary"><Loader2 className="w-3 h-3 animate-spin" /> {t('Loading fee breakdown...')}</p>
                  )}

                  {quote && !noFeeConfig && (
                    <div className="pt-3 border-t border-secondary/10 space-y-3">
                      {quote.invoice && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t('Invoice {{number}}', { number: quote.invoice.invoice_number })} · {quote.invoice.status === 'partial' ? t('Incomplete Payment') : quote.invoice.status}</span>
                          <span className="font-black text-secondary">{t('Due: CFA {{amount}}', { amount: parseFloat(quote.invoice.balance).toLocaleString() })}</span>
                        </div>
                      )}
                      {(quote.categories?.length > 0 || quote.fees?.length > 0) && (
                        <div className="rounded-xl border border-secondary/10 bg-secondary-container/20 divide-y divide-secondary/10 overflow-hidden">
                          {quote.categories?.map((cat: any) => (
                            <div key={cat.id} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-on-surface truncate">
                                {cat.name}
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cat.is_mandatory ? 'bg-secondary/15 text-secondary' : 'bg-amber-100 text-amber-700'}`}>
                                  {cat.is_mandatory ? t('Mandatory') : t('Optional')}
                                </span>
                              </span>
                              <span className="font-black text-on-surface-variant shrink-0">
                                CFA {parseFloat(cat.amount).toLocaleString()}
                                {parseFloat(cat.paid) > 0 && (
                                  <span className="text-[10px] font-bold text-secondary/70 ml-1.5">{t('paid {{amount}}', { amount: parseFloat(cat.paid).toLocaleString() })}</span>
                                )}
                                {parseFloat(cat.remaining) > 0 && (
                                  <span className="text-[10px] font-bold text-amber-600 ml-1.5">{t('remaining {{amount}}', { amount: parseFloat(cat.remaining).toLocaleString() })}</span>
                                )}
                              </span>
                            </div>
                          ))}
                          {!quote.categories?.length && quote.fees?.map((fee: any, idx: number) => (
                            <div key={idx} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-on-surface truncate">{fee.category}</span>
                              <span className="font-black text-on-surface-variant shrink-0">CFA {parseFloat(fee.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="px-4 py-2 flex items-center justify-between gap-3 text-xs bg-secondary/5">
                            <span className="font-black uppercase tracking-widest text-on-surface-variant">{t('Total')}</span>
                            <span className="font-black text-secondary">CFA {parseFloat(quote.total).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {noFeeConfig && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">info</span>
                      <p className="text-xs font-medium text-amber-700">
                        {t("No fee structure is configured for this student's class yet. Set one up under Finance → Fee Setup before collecting payment.")}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Section')}</label>
                    <select
                      value={selectedSection}
                      onChange={(e) => { setSelectedSection(e.target.value); setSelectedClass(''); setStudents([]); setQuote(null); }}
                      disabled={isLoading}
                      className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{t('All Sections')}</option>
                      {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Grade Level / Class')}</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      disabled={isLoading}
                      className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{t('-- Select Class --')}</option>
                      {classes
                        .filter((c: any) => !selectedSection || c.stream == selectedSection)
                        .map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Student')}</label>
                    <div className="relative">
                      <select
                        value={selectedStudentId}
                        onChange={(e) => handleSelectStudent(e.target.value)}
                        disabled={isLoading || !selectedClass || students.length === 0}
                        className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {isLoading ? t('Loading...') : students.length === 0 ? t('No students in this class') : t('-- Choose Student --')}
                        </option>
                        {students.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.admission_number || '—'})
                          </option>
                        ))}
                      </select>
                      {!isLoading && selectedClass && students.length > 0 && (
                        <Search className="w-4 h-4 text-on-surface-variant/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {quoteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="material-symbols-outlined text-red-600 text-sm mt-0.5">error</span>
                  <p className="text-xs font-medium text-red-700">{quoteError}</p>
                </div>
              )}
            </div>

            {/* Step 2: Payment details */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <Wallet className="text-secondary w-6 h-6" /> {t('Payment Details')}
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Amount Received (CFA)')}</label>
                  <input required type="number" step="0.01" min="1" name="amount" value={formData.amount} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-black text-secondary shadow-inner transition-all placeholder:text-secondary/40" placeholder="0.00" />
                  {amountDue && parseFloat(amountDue) > 0 && (
                    <p className="text-[11px] font-bold text-secondary/70">
                      {t('Balance due: CFA {{amount}}', { amount: parseFloat(amountDue).toLocaleString() })}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Payment Method')}</label>
                  <select name="method" value={formData.method} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                    <option value="cash">{t('Cash Tender')}</option>
                    <option value="bank">{t('Bank Transfer')}</option>
                    <option value="momo">{t('Mobile Money')}</option>
                    <option value="cheque">{t('Certified Cheque')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Fee Category')}</label>
                <select name="fee_category" value={formData.fee_category} onChange={handleChange} disabled={isLoading || feeCategories.length === 0} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">{t('Whole balance / Not specified')}</option>
                  {feeCategories.map((cat: any) => {
                    const quoteCat = quote?.categories?.find((c: any) => c.id === cat.id);
                    const status = quoteCat
                      ? parseFloat(quoteCat.remaining) > 0
                        ? t('— remaining CFA {{amount}}', { amount: parseFloat(quoteCat.remaining).toLocaleString() })
                        : t('— paid in full')
                      : t('— not on this invoice');
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {status}
                      </option>
                    );
                  })}
                </select>
                {feeCategories.length > 0 && (
                  <p className="text-[11px] font-bold text-secondary/70">
                    {t('Pick which fee this payment settles (Tuition, Registration, etc.). The receipt will show it.')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Transaction Reference (Optional)')}</label>
                <input type="text" name="reference" value={formData.reference} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('e.g. MOMO Trans ID or Cheque No.')} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Internal Notes')}</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all resize-none placeholder:text-on-surface-variant/40" placeholder={t('Additional details...')} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button disabled={isSubmitting || !formData.amount || !selectedStudentId || noFeeConfig} type="submit" className="flex items-center gap-3 px-8 py-4 bg-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {isSubmitting ? t('Processing...') : t('Process Payment')}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Context */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-secondary-container/30 p-8 rounded-[2rem] border border-secondary/10 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-on-secondary-container mb-6 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> {t('Class → Student Flow')}
            </h4>
            <ul className="space-y-6 text-xs font-bold text-on-secondary-container/70 leading-relaxed">
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                {t('Pick a section and class, then choose the student. Their fee balance is shown automatically.')}
              </li>
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                {t('No manual invoice step — the payable is built from the class fee structures the moment payment is recorded.')}
              </li>
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                {t('The first payment automatically activates a newly registered student.')}
              </li>
            </ul>
          </div>

          <div className="p-8 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 shadow-inner">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('System Advisory')}</span>
             </div>
             <p className="text-xs font-medium text-on-surface-variant leading-relaxed opacity-80">
                {t('Ensure the tender matches the physical cash or bank reference before confirming. Errors require administrative reversal.')}
             </p>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}