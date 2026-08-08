import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Wallet, Receipt, CheckCircle, Loader2, Lock } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { useCanRecordFinance } from '../../../hooks/useCanRecordFinance';

export default function RecordTransactionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();
  const { roles } = useAuthStore();
  const isBursar = roles?.some((r) => r.role === 'bursar');
  const canRecord = useCanRecordFinance();
  const backPath = isBursar ? '/bursar' : '/admin/finance';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  
  const [formData, setFormData] = useState({
    invoice_id: (location.state as any)?.invoiceId || '',
    amount: '',
    method: 'cash',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoadingInvoices(true);
      setInvoiceError('');
      try {
        const response = await api.get('/finance/invoices/');
        const data = response.data.results || response.data;
        const unpaid = data.filter((inv: any) => inv.status !== 'paid');
        setInvoices(unpaid);
        if (unpaid.length === 0) {
          setInvoiceError('No unpaid fees found. Generate fees first from the Fees page.');
        }
      } catch (error: any) {
        console.error("Failed to fetch invoices:", error);
        setInvoiceError('Failed to load invoices. Check your connection and try again.');
      } finally {
        setIsLoadingInvoices(false);
      }
    };
    fetchInvoices();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        // If invoice is selected, we could potentially pre-fill the balance
        if (name === 'invoice_id') {
            const selectedInv = invoices.find(inv => inv.id === value);
            if (selectedInv) newData.amount = selectedInv.balance;
        }
        return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await api.post('/finance/transactions/', {
        invoice: formData.invoice_id,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference,
        notes: formData.notes
      });
      
      addToast(`Payment of CFA ${response.data.amount} recorded. Receipt: ${response.data.receipt_number}`, 'success');
      navigate(backPath);
    } catch (error: any) {
      console.error("Payment error:", error);
      const detail = error.response?.data?.detail || error.response?.data?.amount?.[0] || 'Failed to record payment.';
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedInvoiceDetails = invoices.find(inv => inv.id === formData.invoice_id);

  return (
    <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate(backPath)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Treasury
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary/80 block mb-3">Treasury Operations</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Record Payment</h1>
        <p className="text-on-surface-variant mt-2 text-lg">Process institutional fee collections and generate official receipts.</p>
      </section>

      {!canRecord && (
        <div className="mb-10 max-w-3xl bg-amber-50 border border-amber-200 rounded-3xl p-10 flex items-start gap-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-900">Recording is restricted to the bursar</h3>
            <p className="text-sm text-amber-800/80 font-medium mt-2 leading-relaxed">
              This school has enabled <strong>Bursar Only</strong> finance recording. Payments, expenses and fee
              generation can only be recorded by the bursar account. You can still view the
              treasury, invoices, and the student ledger.
            </p>
            <button
              onClick={() => navigate('/admin/finance')}
              className="mt-5 px-6 py-3 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all"
            >
              Back to Treasury
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Form Area */}
        <div className={`md:col-span-2 space-y-8 ${!canRecord ? 'pointer-events-none opacity-40 select-none' : ''}`}>
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8">
            
            <div className="space-y-6 border-b border-outline-variant/10 pb-8">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <Wallet className="text-secondary w-6 h-6" /> Payment Details
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Select Fee</label>
                <div className="relative">
                    <select
                        required
                        name="invoice_id"
                        value={formData.invoice_id}
                        onChange={handleChange}
                        disabled={isLoadingInvoices || invoices.length === 0}
                        className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">
                          {isLoadingInvoices ? 'Loading fees...' : '-- Choose Fee to Credit --'}
                        </option>
                        {invoices.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                {inv.student_name} - {inv.invoice_number} (Bal: CFA {parseFloat(inv.balance).toLocaleString()})
                            </option>
                        ))}
                    </select>
                    {isLoadingInvoices && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                        </div>
                    )}
                </div>
                {invoiceError && !isLoadingInvoices && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">info</span>
                        <p className="text-xs font-medium text-amber-700">{invoiceError}</p>
                    </div>
                )}
                {selectedInvoiceDetails && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-secondary flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      Selected: {selectedInvoiceDetails.student_name} - Amount Due: CFA {parseFloat(selectedInvoiceDetails.balance).toLocaleString()}
                    </p>
                    {selectedInvoiceDetails.line_items?.length > 0 && (
                      <div className="mt-3 rounded-xl border border-secondary/10 bg-secondary-container/20 divide-y divide-secondary/10 overflow-hidden">
                        {selectedInvoiceDetails.line_items.map((li: any, idx: number) => (
                          <div key={idx} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold text-on-surface truncate">
                              {li.label || li.category}
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${li.is_mandatory ? 'bg-secondary/15 text-secondary' : 'bg-amber-100 text-amber-700'}`}>
                                {li.is_mandatory ? 'Mandatory' : 'Optional'}
                              </span>
                            </span>
                            <span className="font-black text-on-surface-variant shrink-0">CFA {parseFloat(li.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Amount Received (CFA)</label>
                  <input required type="number" step="0.01" min="1" name="amount" value={formData.amount} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-black text-secondary shadow-inner transition-all placeholder:text-secondary/40" placeholder="0.00" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Payment Method</label>
                  <select name="method" value={formData.method} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                    <option value="cash">Cash Tender</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="momo">Mobile Money</option>
                    <option value="cheque">Certified Cheque</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Transaction Reference (Optional)</label>
                <input type="text" name="reference" value={formData.reference} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. MOMO Trans ID or Cheque No." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Internal Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all resize-none placeholder:text-on-surface-variant/40" placeholder="Additional details..." />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button disabled={isSubmitting || !formData.amount || !formData.invoice_id} type="submit" className="flex items-center gap-3 px-8 py-4 bg-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {isSubmitting ? 'Processing...' : 'Process Payment'}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Context */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-secondary-container/30 p-8 rounded-[2rem] border border-secondary/10 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-on-secondary-container mb-6 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Ledger Rules
            </h4>
            <ul className="space-y-6 text-xs font-bold text-on-secondary-container/70 leading-relaxed">
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                Transactions are immutable once processed to ensure audit compliance.
              </li>
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                Official receipts are automatically dispatched to parent contact emails upon success.
              </li>
              <li className="flex items-start gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 shrink-0 shadow-[0_0_8px_rgba(0,107,95,0.4)]"></span>
                Mobile money transactions must wait for gateway confirmation.
              </li>
            </ul>
          </div>

          <div className="p-8 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 shadow-inner">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">System Advisory</span>
             </div>
             <p className="text-xs font-medium text-on-surface-variant leading-relaxed opacity-80">
                Ensure the tender matches the physical cash or bank reference before confirming. Errors require administrative reversal.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
