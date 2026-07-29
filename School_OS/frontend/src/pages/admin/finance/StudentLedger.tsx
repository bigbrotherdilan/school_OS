import { useState, useEffect } from 'react';
import { api } from '../../../services/api';

export default function StudentLedger() {
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [_transactions, setTransactions] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students/students/')
      .then(r => setStudents(r.data.results || r.data))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const loadLedger = async (studentId: string) => {
    setSelectedStudent(studentId);
    try {
      const [invRes, txRes] = await Promise.all([
        api.get(`/finance/invoices/?student=${studentId}`),
        api.get(`/finance/transactions/`),
      ]);
      const allTx = txRes.data.results || txRes.data;
      const invData = invRes.data.results || invRes.data;
      setInvoices(invData);
      setTransactions(allTx.filter((tx: any) => tx.invoice && invData.some((i: any) => i.id === tx.invoice)));
    } catch (e) { console.error(e); }
  };

  const totalBalance = invoices.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Student Accounts</span>
        <h1 className="text-4xl font-semibold tracking-tight text-on-surface">Student Ledger</h1>
        <p className="text-on-surface-variant mt-1">View per-student fee summaries, bills, and payment history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Student list */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden h-fit lg:sticky lg:top-4">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="font-bold text-on-surface text-sm">Students</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
          ) : (
            <div className="divide-y divide-outline-variant/5 max-h-[600px] overflow-y-auto">
              {students.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => loadLedger(s.id)}
                  className={`w-full px-5 py-3 text-left hover:bg-surface-container-low/50 transition-colors ${selectedStudent === s.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                >
                  <p className="font-bold text-sm text-on-surface">{s.first_name} {s.last_name}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">{s.admission_number} - {s.current_class_name || '-'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ledger detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedStudent ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-12 text-center">
              <span className="material-symbols-outlined text-5xl block mb-3 opacity-30 mx-auto">account_balance</span>
              <p className="text-on-surface-variant font-medium">Select a student to view their ledger.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Total Billed</span>
                  <p className="text-2xl font-bold text-on-surface mt-1">CFA {invoices.reduce((s, i) => s + i.total_amount, 0).toLocaleString()}</p>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Total Paid</span>
                  <p className="text-2xl font-bold text-secondary mt-1">CFA {totalPaid.toLocaleString()}</p>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Balance</span>
                  <p className={`text-2xl font-bold mt-1 ${totalBalance > 0 ? 'text-error' : 'text-secondary'}`}>CFA {totalBalance.toLocaleString()}</p>
                </div>
              </div>

              {/* Fee Bills */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/10"><h3 className="font-bold text-on-surface">Fee Bills</h3></div>
                {invoices.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm">No fee bills.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                        <th className="px-6 py-3">Bill</th>
                        <th className="px-6 py-3">Total</th>
                        <th className="px-6 py-3">Paid</th>
                        <th className="px-6 py-3">Balance</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-surface-container-low/50">
                          <td className="px-6 py-3 font-mono text-sm font-bold">{inv.invoice_number}</td>
                          <td className="px-6 py-3 text-sm">CFA {inv.total_amount.toLocaleString()}</td>
                          <td className="px-6 py-3 text-sm">CFA {inv.amount_paid.toLocaleString()}</td>
                          <td className="px-6 py-3 text-sm font-bold">{inv.balance === '0.00' ? <span className="text-secondary">Settled</span> : `CFA ${parseFloat(inv.balance).toLocaleString()}`}</td>
                          <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'bg-secondary-container text-on-secondary-container' : inv.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-error-container text-on-error-container'}`}>{inv.status}</span></td>
                          <td className="px-6 py-3 text-sm text-on-surface-variant">{new Date(inv.due_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
