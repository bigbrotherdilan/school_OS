import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useCanRecordFinance } from '../../../hooks/useCanRecordFinance';

export default function InvoiceManagement() {
  const { addToast } = useToastStore();
  const canRecord = useCanRecordFinance();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [_structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [tab, setTab] = useState<'list' | 'generate'>('list');
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [genForm, setGenForm] = useState({ class_id: '', due_date: '', student_id: '', mode: 'class' });

  useEffect(() => {
    Promise.all([
      api.get('/finance/invoices/'),
      api.get('/academic/classes/'),
      api.get('/finance/structures/'),
    ]).then(([iRes, cRes, sRes]) => {
      setInvoices(iRes.data.results || iRes.data);
      setClasses(cRes.data.results || cRes.data);
      setStructures(sRes.data.results || sRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (genForm.class_id) {
      api.get(`/students/students/?current_class=${genForm.class_id}`)
        .then(r => setStudents(r.data.results || r.data))
        .catch(() => {});
    }
  }, [genForm.class_id]);

  const handleGenerate = async () => {
    if (!genForm.due_date) return addToast('Due date is required.', 'error');
    setGenLoading(true);
    try {
      if (genForm.mode === 'class') {
        if (!genForm.class_id) return addToast('Select a class.', 'error');
        const res = await api.post('/finance/invoices/batch-generate/', {
          class_id: genForm.class_id,
          due_date: genForm.due_date,
        });
        addToast(`Fees generated for the entire class!${res.data.skipped ? ` ${res.data.skipped} student(s) skipped (already billed).` : ''}`, 'success');
      } else {
        if (!genForm.student_id) return addToast('Select a student.', 'error');
        await api.post('/finance/invoices/generate/', {
          student_id: genForm.student_id,
          due_date: genForm.due_date,
        });
        addToast('Fee created for the student. Ready to share with the parent.', 'success');
      }
      const res = await api.get('/finance/invoices/');
      setInvoices(res.data.results || res.data);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Generation failed.', 'error');
    } finally {
      setGenLoading(false);
    }
  };

  const handleSendReminder = async (invoiceId: string) => {
    setReminderLoading(invoiceId);
    try {
      const res = await api.post(`/finance/invoices/${invoiceId}/send-reminder/`);
      addToast(res.data.detail || 'Reminder sent to parents.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to send reminder.', 'error');
    } finally {
      setReminderLoading(null);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-secondary-container text-on-secondary-container';
      case 'partial': return 'bg-amber-50 text-amber-700';
      case 'unpaid': return 'bg-error-container text-on-error-container';
      case 'draft': return 'bg-surface-container-high text-on-surface-variant';
      default: return 'bg-surface-container-high text-on-surface-variant';
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Fees</span>
        <h1 className="text-4xl font-semibold tracking-tight text-on-surface">Fees</h1>
        <p className="text-on-surface-variant mt-1">View, generate, and manage student fees.</p>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/10">
        <button onClick={() => setTab('list')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'list' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>All Fees ({invoices.length})</button>
        {canRecord && (
          <button onClick={() => setTab('generate')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'generate' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Generate Fees</button>
        )}
      </div>

      {tab === 'generate' && !canRecord && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-sm font-semibold">Fee generation is restricted to the bursar for this school.</div>}

      {tab === 'generate' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 max-w-xl">
          <h3 className="font-bold text-on-surface mb-4">Generate New Fees</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium"><input type="radio" checked={genForm.mode === 'class'} onChange={() => setGenForm({ ...genForm, mode: 'class' })} className="w-4 h-4" /> Entire Class</label>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="radio" checked={genForm.mode === 'single'} onChange={() => setGenForm({ ...genForm, mode: 'single' })} className="w-4 h-4" /> Single Student</label>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Class</label>
              <select value={genForm.class_id} onChange={e => setGenForm({ ...genForm, class_id: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all">
                <option value="">Select class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {genForm.mode === 'single' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Student</label>
                <select value={genForm.student_id} onChange={e => setGenForm({ ...genForm, student_id: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="">Select student</option>
                  {students.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Due Date</label>
              <input type="date" value={genForm.due_date} onChange={e => setGenForm({ ...genForm, due_date: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <button onClick={handleGenerate} disabled={genLoading} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50">
              {genLoading ? 'Generating...' : 'Generate Fees'}
            </button>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">receipt_long</span>
              <p className="text-sm font-bold">No fees yet. Set up your fee structure to start billing.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                  <th className="px-6 py-4">Ref</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Paid</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Due</th>
                  <th className="px-6 py-4">Fees</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {invoices.map((inv: any) => (
                  <>
                    <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-bold">{inv.invoice_number}</td>
                      <td className="px-6 py-4 text-sm font-medium">{inv.student_name}</td>
                      <td className="px-6 py-4 text-sm">CFA {inv.total_amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">CFA {inv.amount_paid.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-bold">{inv.balance === '0.00' ? <span className="text-secondary">Settled</span> : `CFA ${parseFloat(inv.balance).toLocaleString()}`}</td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColor(inv.status)}`}>{inv.status}</span></td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{new Date(inv.due_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
                          className="px-3 py-1.5 bg-surface-container-high rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">{expanded === inv.id ? 'expand_less' : 'expand_more'}</span>
                          {expanded === inv.id ? 'Hide' : 'View'} ({inv.line_items?.length || 0})
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleSendReminder(inv.id)}
                            disabled={reminderLoading === inv.id}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">{reminderLoading === inv.id ? 'sync' : 'mail'}</span>
                            {reminderLoading === inv.id ? 'Sending...' : 'Remind'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === inv.id && (
                      <tr key={`${inv.id}-items`} className="bg-surface-container-low/40">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {inv.line_items?.length ? inv.line_items.map((li: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-xs font-bold">
                                <span className="text-on-surface">{li.label || li.category}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${li.is_mandatory ? 'bg-secondary/15 text-secondary' : 'bg-amber-100 text-amber-700'}`}>
                                  {li.is_mandatory ? 'Mandatory' : 'Optional'}
                                </span>
                                <span className="text-on-surface-variant font-black">CFA {parseFloat(li.amount).toLocaleString()}</span>
                              </span>
                            )) : <span className="text-xs text-on-surface-variant font-medium">No line items on this fee.</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
