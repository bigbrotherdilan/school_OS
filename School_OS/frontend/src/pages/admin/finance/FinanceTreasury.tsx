import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

const modules = [
  {
    icon: 'receipt_long',
    title: 'Fee Setup',
    desc: 'Configure fee categories, amounts per class and academic year.',
    path: '/admin/finance/fee-setup',
    color: 'from-blue-600 to-blue-700',
  },
  {
    icon: 'assignment',
    title: 'Fee Bills',
    desc: 'Generate fee bills individually or by class, view all issued bills.',
    path: '/admin/finance/invoices',
    color: 'from-emerald-600 to-emerald-700',
  },
  {
    icon: 'payments',
    title: 'Record Payment',
    desc: 'Process fee payments and generate official receipts.',
    path: '/admin/finance/transactions/new',
    color: 'from-violet-600 to-violet-700',
  },
  {
    icon: 'account_balance',
    title: 'Student Ledger',
    desc: 'View per-student fee balances, payment history, and bills.',
    path: '/admin/finance/ledger',
    color: 'from-amber-600 to-amber-700',
  },
  {
    icon: 'warning_amber',
    title: 'Arrears Management',
    desc: 'Track overdue accounts, send reminders, manage follow-ups.',
    path: '/admin/finance/arrears',
    color: 'from-rose-600 to-rose-700',
  },
  {
    icon: 'money_off',
    title: 'Expenses',
    desc: 'Record and track school expenditures by category.',
    path: '/admin/finance/expenses',
    color: 'from-cyan-600 to-cyan-700',
  },
];

export default function FinanceTreasury() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [summary, setSummary] = useState({
    total_revenue: 0, total_expected: 0, total_arrears: 0,
    collection_rate: 0, daily_volume: 0, total_expenses: 0,
    paid_count: 0, unpaid_count: 0, total_invoices: 0,
  });
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/finance/summary/'),
      api.get('/finance/transactions/'),
    ]).then(([sRes, txRes]) => {
      setSummary(sRes.data);
      setRecentTx((txRes.data.results || txRes.data).slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    try {
      addToast('Preparing export...', 'info');
      const res = await api.get('/finance/invoices/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `ledger_${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); a.remove();
      addToast('Ledger exported.', 'success');
    } catch { addToast('Export failed.', 'error'); }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Financial Management</span>
          <h1 className="text-4xl font-semibold tracking-tight text-on-surface">Finance & Treasury</h1>
          <p className="text-on-surface-variant mt-1">Manage fees, payments, bills, and expenses.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-5 py-3 bg-surface-container-highest text-on-surface font-bold rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">download</span> Export Ledger
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Revenue Collected</span>
            <p className="text-3xl font-bold text-primary mt-1">CFA {summary.total_revenue.toLocaleString()}</p>
            <div className="mt-3 w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: Math.min(summary.collection_rate, 100) + '%' }} />
            </div>
            <p className="text-xs text-on-surface-variant mt-1">{summary.collection_rate}% of goal (CFA {summary.total_expected.toLocaleString()})</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Outstanding Arrears</span>
            <p className="text-3xl font-bold text-error mt-1">CFA {summary.total_arrears.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-1">{summary.unpaid_count} of {summary.total_invoices} bills unpaid</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Today's Collections</span>
            <p className="text-3xl font-bold text-secondary mt-1">CFA {summary.daily_volume.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-1">Real-time daily total</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Total Expenses</span>
            <p className="text-3xl font-bold text-on-surface mt-1">CFA {summary.total_expenses.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-1">All-time expenditure</p>
          </div>
        </div>
      )}

      {/* Quick Navigation Modules */}
      <div>
        <h2 className="text-lg font-bold text-on-surface mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 text-left hover:shadow-md hover:border-outline-variant/30 transition-all group text-start"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shadow-sm mb-3`}>
                <span className="material-symbols-outlined text-white text-xl">{m.icon}</span>
              </div>
              <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">{m.title}</h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="font-bold text-on-surface">Recent Transactions</h3>
          <button onClick={() => navigate('/admin/finance/transactions/new')} className="text-xs font-bold text-primary hover:underline">
            + Record Payment
          </button>
        </div>
        {recentTx.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant text-sm font-medium">No payments recorded yet. Record your first payment to start tracking finances.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                <th className="px-6 py-3">Receipt</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {recentTx.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-sm font-bold">{tx.receipt_number}</td>
                  <td className="px-6 py-3 text-sm font-medium">{tx.student_name}</td>
                  <td className="px-6 py-3 text-sm font-bold">CFA {tx.amount.toLocaleString()}</td>
                  <td className="px-6 py-3 text-xs uppercase font-bold">{tx.method}</td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant">{new Date(tx.payment_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
