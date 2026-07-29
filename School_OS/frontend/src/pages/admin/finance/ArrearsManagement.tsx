import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function ArrearsManagement() {
  const { addToast } = useToastStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  useEffect(() => {
    api.get('/academic/classes/')
      .then(r => setClasses(r.data.results || r.data))
      .catch(console.error);
    loadInvoices();
  }, []);

  const loadInvoices = async (cls = '') => {
    setLoading(true);
    try {
      const params: any = {};
      if (cls) params.student__current_class = cls;
      const res = await api.get('/finance/invoices/', { params });
      const data = res.data.results || res.data;
      setInvoices(data.filter((i: any) => parseFloat(i.balance) > 0));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadInvoices(filterClass); }, [filterClass]);

  const sendReminder = async (invoiceId: string, studentName: string) => {
    setReminderLoading(invoiceId);
    try {
      const res = await api.post(`/finance/invoices/${invoiceId}/send-reminder/`);
      addToast(res.data.detail || `Reminder sent for ${studentName}.`, 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to send reminder.', 'error');
    } finally {
      setReminderLoading(null);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Collections</span>
        <h1 className="text-4xl font-semibold tracking-tight text-on-surface">Arrears Management</h1>
        <p className="text-on-surface-variant mt-1">Track overdue accounts and send payment reminders.</p>
      </div>

      <div className="flex items-center gap-4">
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20">
          <option value="">All Classes</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-sm text-on-surface-variant font-medium">{invoices.length} outstanding bill{invoices.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30 mx-auto">check_circle</span>
            <p className="text-sm font-bold text-secondary">No outstanding arrears - all bills are settled!</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Bill #</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Days Overdue</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {invoices.map((inv: any) => {
                const due = new Date(inv.due_date);
                const days = Math.floor((Date.now() - due.getTime()) / 86400000);
                return (
                  <tr key={inv.id} className="hover:bg-surface-container-low/50">
                    <td className="px-6 py-4 font-bold text-sm">{inv.student_name}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{inv.student_class || '-'}</td>
                    <td className="px-6 py-4 font-mono text-sm">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm">CFA {inv.total_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-bold text-error">CFA {parseFloat(inv.balance).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{due.toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${days > 30 ? 'bg-error-container text-on-error-container' : days > 14 ? 'bg-amber-50 text-amber-700' : 'bg-surface-container-high text-on-surface-variant'}`}>{days}d</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => sendReminder(inv.id, inv.student_name)}
                        disabled={reminderLoading === inv.id}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline disabled:opacity-50"
                      >
                        {reminderLoading === inv.id ? 'Sending...' : 'Remind'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
