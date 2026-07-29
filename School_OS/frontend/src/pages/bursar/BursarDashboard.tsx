import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface Summary {
  total_revenue: number;
  total_expected: number;
  total_arrears: number;
  collection_rate: number;
  daily_volume: number;
  total_expenses: number;
  paid_count: number;
  unpaid_count: number;
  total_invoices: number;
}

interface Transaction {
  id: string;
  receipt_number: string;
  student_name: string;
  amount: number;
  method: string;
  payment_date: string;
  notes?: string;
}

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  module: string;
  description: string;
  status_code: number | null;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatCFA(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M CFA`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K CFA`;
  return `${val.toLocaleString()} CFA`;
}

const MODULE_ICONS: Record<string, string> = {
  STUDENT: 'school', STAFF: 'person', ACADEMIC: 'menu_book',
  ASSESSMENT: 'grading', FINANCE: 'payments', ATTENDANCE: 'how_to_reg',
  TIMETABLE: 'calendar_month', REPORT: 'description', LOGBOOK: 'book',
  NOTIFICATION: 'notifications', DOCUMENT: 'folder', AUTH: 'lock',
  SYSTEM: 'settings', GOVERNMENT: 'account_balance',
};

export default function BursarDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.first_name ?? user?.full_name?.split(' ')[0] ?? 'Bursar';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/finance/summary/'),
      api.get('/finance/transactions/'),
      api.get('/audit/logs/'),
    ]).then(([sRes, txRes, auditRes]) => {
      if (sRes.status === 'fulfilled') setSummary(sRes.value.data);
      if (txRes.status === 'fulfilled') {
        const data = txRes.value.data.results ?? txRes.value.data ?? [];
        setTransactions(Array.isArray(data) ? data.slice(0, 5) : []);
      }
      if (auditRes.status === 'fulfilled') {
        const data = auditRes.value.data.results ?? auditRes.value.data ?? [];
        setAuditLogs(Array.isArray(data) ? data.slice(0, 8) : []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const netBalance = summary ? summary.total_revenue - summary.total_expenses : 0;
  const collectionRate = summary?.collection_rate ?? 0;

  return (
    <div className="p-4 lg:p-10 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">

      {/* ─── Welcome Header ─── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-emerald-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          <span className="text-emerald-600 font-bold tracking-widest text-xs uppercase">Bursar Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-on-surface">
          Welcome back, <span className="text-emerald-600">{userName}</span>
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">Here's your financial overview at a glance.</p>
      </div>

      {/* ─── KPI Strip ─── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 animate-pulse h-28" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Collected */}
          <button
            onClick={() => navigate('/bursar/ledger')}
            className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 text-left hover:border-emerald-500/30 hover:shadow-md hover:shadow-emerald-500/5 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Revenue Collected</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-emerald-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-on-surface">{formatCFA(summary.total_revenue)}</p>
            <div className="mt-2 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, collectionRate)}%` }} />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1.5">{collectionRate}% of {formatCFA(summary.total_expected)}</p>
          </button>

          {/* Outstanding Arrears */}
          <button
            onClick={() => navigate('/bursar/arrears')}
            className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 text-left hover:border-rose-500/30 hover:shadow-md hover:shadow-rose-500/5 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Outstanding</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-rose-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-error">{formatCFA(summary.total_arrears)}</p>
            <p className="text-[11px] text-on-surface-variant mt-1.5">{summary.unpaid_count} of {summary.total_invoices} bills unpaid</p>
          </button>

          {/* Today's Collections */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Today's Collections</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>today</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-on-surface">{formatCFA(summary.daily_volume)}</p>
            <p className="text-[11px] text-on-surface-variant mt-1.5">Real-time daily total</p>
          </div>

          {/* Net Balance */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Net Balance</span>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
              </div>
            </div>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-error'}`}>
              {netBalance >= 0 ? '+' : ''}{formatCFA(netBalance)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1.5">{formatCFA(summary.total_expenses)} in expenses</p>
          </div>
        </div>
      )}

      {/* ─── Quick Actions ─── */}
      <section>
        <h3 className="text-sm font-bold text-on-surface mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Record Payment', icon: 'payments', path: '/bursar/transactions/new', color: 'bg-emerald-600' },
            { label: 'View Arrears', icon: 'trending_down', path: '/bursar/arrears', color: 'bg-rose-600' },
            { label: 'Student Ledger', icon: 'account_balance_wallet', path: '/bursar/ledger', color: 'bg-blue-600' },
            { label: 'Expenses', icon: 'money_off', path: '/bursar/expenses', color: 'bg-amber-600' },
          ].map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 hover:border-primary/30 hover:shadow-md transition-all group text-left flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg ${a.color} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
              </div>
              <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Recent Payments + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Payments — 3 cols */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface">Recent Payments</h3>
            <button onClick={() => navigate('/bursar/transactions/new')} className="text-xs font-bold text-emerald-600 hover:underline">+ Record</button>
          </div>
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">receipt_long</span>
              <p className="text-on-surface-variant text-sm font-medium">No payments recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                  <th className="px-5 py-2.5">Receipt</th>
                  <th className="px-5 py-2.5">Student</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5 hidden sm:table-cell">Method</th>
                  <th className="px-5 py-2.5 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-on-surface">{tx.receipt_number}</td>
                    <td className="px-5 py-3 text-sm font-medium text-on-surface">{tx.student_name}</td>
                    <td className="px-5 py-3 text-sm font-bold text-emerald-600 text-right">CFA {tx.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs uppercase font-bold text-on-surface-variant hidden sm:table-cell">{tx.method}</td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant hidden sm:table-cell">{new Date(tx.payment_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity Feed — 2 cols */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="text-sm font-bold text-on-surface">Recent Activity</h3>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">history</span>
              <p className="text-on-surface-variant text-sm font-medium">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/5 max-h-[380px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-container/20 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    log.status_code && log.status_code < 400 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                  }`}>
                    <span className={`material-symbols-outlined text-xs ${
                      log.status_code && log.status_code < 400 ? 'text-emerald-600' : 'text-rose-600'
                    }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {MODULE_ICONS[log.module] || 'circle'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{log.description || log.action}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{log.user_name} · {timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
