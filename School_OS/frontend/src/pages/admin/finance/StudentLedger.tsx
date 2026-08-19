import { useState, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiFetchAll } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { downloadPdf, openPdfInNewTab } from '../../../utils/pdf';

export default function StudentLedger() {
  const { t } = useTranslation('adminFinance');
  const { addToast } = useToastStore();
  const [years, setYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, any>>({});
  const [selectedStudent, setSelectedStudent] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [bulkReminding, setBulkReminding] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/academic/academic-years/'),
      api.get('/academic/classes/'),
    ]).then(([yRes, cRes]) => {
      const yearData = yRes.data.results || yRes.data;
      setYears(yearData);
      setClasses(cRes.data.results || cRes.data);
      const active = yearData.find((y: any) => y.is_active);
      setAcademicYear(active ? active.id : (yearData[0]?.id || ''));
    }).catch(console.error);
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setSelectedStudent('');
    setInvoices([]);
    setTransactions([]);
    setInvoiceMap({});
    try {
      const invoiceParams: any = { academic_year: academicYear };
      if (classFilter) {
        invoiceParams.student__current_class = classFilter;
      }
      const [studentsData, invData] = await Promise.all([
        apiFetchAll('/students/students/', classFilter ? { current_class: classFilter } : {}),
        apiFetchAll('/finance/invoices/', invoiceParams),
      ]);

      let invoicesData = invData;
      const missing = studentsData.filter((s: any) => !invoicesData.some((inv: any) => inv.student === s.id));
      if (missing.length > 0) {
        try {
          const ensureRes = await api.post('/finance/invoices/ensure-invoices/', {
            academic_year: academicYear || undefined,
            class_id: classFilter || undefined,
          });
          const created = ensureRes.data?.created || 0;
          const updated = ensureRes.data?.updated || 0;
          if (created > 0 || updated > 0) {
            invoicesData = await apiFetchAll('/finance/invoices/', invoiceParams);
            if (created > 0) {
              addToast(t('Fee invoices created for {{count}} student(s).', { count: created }), 'success');
            }
            if (updated > 0) {
              addToast(t('Fees topped up for {{count}} student(s).', { count: updated }), 'success');
            }
          }
        } catch (e) { console.error('ensure-invoices failed:', e); }
      }

      setStudents(studentsData);
      const map: Record<string, any> = {};
      invoicesData.forEach((inv: any) => { map[inv.student] = inv; });
      setInvoiceMap(map);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [academicYear, classFilter, addToast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filteredStudents = students.filter((s: any) => {
    if (paymentStatus === 'all') return true;
    const inv = invoiceMap[s.id];
    if (paymentStatus === 'unpaid') return !inv || inv.status === 'unpaid';
    return inv && inv.status === paymentStatus;
  });

  const remindableStudents = filteredStudents.filter((s: any) => {
    const inv = invoiceMap[s.id];
    return inv && inv.status !== 'paid';
  });

  const loadLedger = async (studentId: string) => {
    setLedgerLoading(true);
    try {
      const invoiceParams: any = { student: studentId };
      if (academicYear) invoiceParams.academic_year = academicYear;
      const [invData, txData] = await Promise.all([
        apiFetchAll('/finance/invoices/', invoiceParams),
        apiFetchAll('/finance/transactions/', { student: studentId }),
      ]);
      setInvoices(invData);
      setTransactions(txData.filter((tx: any) => tx.invoice && invData.some((i: any) => i.id === tx.invoice)));
    } catch (e) { console.error(e); } finally { setLedgerLoading(false); }
  };

  const toggleStudent = (studentId: string) => {
    if (selectedStudent === studentId) {
      setSelectedStudent('');
      return;
    }
    setSelectedStudent(studentId);
    loadLedger(studentId);
  };

  const totalBalance = invoices.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + parseFloat(i.amount_paid || 0), 0);
  const totalFees = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);

  const yearName = (inv: any) => inv?.academic_year_name || years.find((y: any) => y.id === inv?.academic_year)?.name || '—';

  const statusBadge = (inv: any) => {
    if (!inv) return (
      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-error-container text-on-error-container">{t('Unpaid')}</span>
    );
    switch (inv.status) {
      case 'paid':
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-secondary-container text-on-secondary-container">{t('Paid')}</span>;
      case 'partial':
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700">{t('Partial')}</span>;
      case 'unpaid':
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-error-container text-on-error-container">{t('Unpaid')}</span>;
      default:
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-surface-container-high text-on-surface-variant">{inv.status}</span>;
    }
  };

  const handleReset = () => {
    setPaymentStatus('all');
    setClassFilter('');
    const active = years.find((y: any) => y.is_active);
    setAcademicYear(active ? active.id : (years[0]?.id || ''));
  };

  const handleRemind = async (invoiceId: string, invoiceNumber: string) => {
    setReminding(invoiceId);
    try {
      const res = await api.post(`/finance/invoices/${invoiceId}/send-reminder/`);
      addToast(res.data.detail || t('Reminder sent for {{invoiceNumber}}.', { invoiceNumber }), 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to send reminder.'), 'error');
    } finally {
      setReminding(null);
    }
  };

  const handleRemindAll = async () => {
    const ids = remindableStudents.map((s: any) => invoiceMap[s.id].id);
    if (ids.length === 0) return;
    setBulkReminding(true);
    try {
      const res = await api.post('/finance/invoices/send-reminders/', { invoice_ids: ids });
      addToast(res.data.detail || t('Reminders sent.'), 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to send reminders.'), 'error');
    } finally {
      setBulkReminding(false);
    }
  };

  const handlePrintReceipt = async (tx: any) => {
    try {
      await openPdfInNewTab(`/finance/transactions/${tx.id}/receipt/`, `receipt_${tx.receipt_number}.pdf`);
    } catch (e) { console.error(e); }
  };

  const handleDownloadReceipt = async (tx: any) => {
    try {
      await downloadPdf(`/finance/transactions/${tx.id}/receipt/`, `receipt_${tx.receipt_number}.pdf`);
    } catch (e) { console.error(e); }
  };

  const filtersActive = classFilter || paymentStatus !== 'all';

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Student Accounts')}</span>
        <h1 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Student Ledger')}</h1>
        <p className="text-on-surface-variant mt-1">{t('View per-student fee summaries, balances and payment history.')}</p>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">{t('School Year')}</label>
          <select
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20"
          >
            {years.map((y: any) => <option key={y.id} value={y.id}>{y.is_active ? t('{{name}} (Active)', { name: y.name }) : y.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">{t('Class')}</label>
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('All Classes')}</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">{t('Payment Status')}</label>
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">{t('All Statuses')}</option>
            <option value="paid">{t('Fully Paid')}</option>
            <option value="partial">{t('Partially Paid')}</option>
            <option value="unpaid">{t('Unpaid')}</option>
            <option value="cancelled">{t('Cancelled')}</option>
            <option value="draft">{t('Draft')}</option>
          </select>
        </div>

        {filtersActive && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-sm">filter_alt_off</span> {t('Clear')}
          </button>
        )}
      </div>

      {/* Table + bulk action */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-on-surface text-sm">{t('Students')}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{loading ? t('Loading...') : t('{{count}} student(s) · {{remindCount}} with outstanding balance', { count: filteredStudents.length, remindCount: remindableStudents.length })}</p>
          </div>
          <button
            onClick={handleRemindAll}
            disabled={bulkReminding || remindableStudents.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">notifications_active</span>
            {bulkReminding ? t('Sending...') : t('Remind {{count}} Parent(s)', { count: remindableStudents.length })}
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-on-surface-variant text-sm">{t('Loading...')}</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant text-sm">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30 mx-auto">filter_alt_off</span>
            {t('No students match the selected filters.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                  <th className="px-6 py-4">{t('Student')}</th>
                  <th className="px-6 py-4">{t('Class')}</th>
                  <th className="px-6 py-4">{t('Year')}</th>
                  <th className="px-6 py-4">{t('Amount Paid')}</th>
                  <th className="px-6 py-4">{t('Amount Left')}</th>
                  <th className="px-6 py-4">{t('Status')}</th>
                  <th className="px-6 py-4 text-right">{t('Reminder')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredStudents.map((s: any) => {
                  const inv = invoiceMap[s.id];
                  const balance = inv ? parseFloat(inv.balance) : null;
                  const canRemind = !!inv && inv.status !== 'paid';
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleStudent(s.id)}
                        className={`cursor-pointer hover:bg-surface-container-low/50 transition-colors ${selectedStudent === s.id ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-sm text-on-surface">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">{s.admission_number}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{s.class_display || t('Unassigned')}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{yearName(inv)}</td>
                        <td className="px-6 py-4 text-sm">{inv ? `CFA ${parseFloat(inv.amount_paid).toLocaleString()}` : '—'}</td>
                        <td className="px-6 py-4 text-sm font-bold">
                          {balance === null ? (
                            '—'
                          ) : balance > 0 ? (
                            <span className="text-error">CFA {balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-secondary">{t('Settled')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{statusBadge(inv)}</td>
                        <td className="px-6 py-4 text-right">
                          {canRemind ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemind(inv.id, inv.invoice_number); }}
                              disabled={reminding === inv.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">campaign</span>
                              {reminding === inv.id ? t('Sending...') : t('Remind')}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">—</span>
                          )}
                        </td>
                      </tr>

                      {selectedStudent === s.id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-6 bg-surface-container-low/40">
                            {ledgerLoading ? (
                              <div className="py-12 text-center text-on-surface-variant text-sm">{t('Loading ledger...')}</div>
                            ) : (
                              <div className="space-y-6">
                                {/* Summary cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{t('Total Fees')}</span>
                                    <p className="text-2xl font-bold text-on-surface mt-1">CFA {totalFees.toLocaleString()}</p>
                                  </div>
                                  <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{t('Total Paid')}</span>
                                    <p className="text-2xl font-bold text-secondary mt-1">CFA {totalPaid.toLocaleString()}</p>
                                  </div>
                                  <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{t('Balance')}</span>
                                    <p className={`text-2xl font-bold mt-1 ${totalBalance > 0 ? 'text-error' : 'text-secondary'}`}>CFA {totalBalance.toLocaleString()}</p>
                                  </div>
                                </div>

                                {/* Fees */}
                                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                                  <div className="px-6 py-4 border-b border-outline-variant/10"><h3 className="font-bold text-on-surface">{t('Fees')}</h3></div>
                                  {invoices.length === 0 ? (
                                    <div className="p-8 text-center text-on-surface-variant text-sm">{t('No fees.')}</div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left">
                                        <thead>
                                          <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                                            <th className="px-6 py-3">{t('Ref')}</th>
                                            <th className="px-6 py-3">{t('Year')}</th>
                                            <th className="px-6 py-3">{t('Total')}</th>
                                            <th className="px-6 py-3">{t('Paid')}</th>
                                            <th className="px-6 py-3">{t('Balance')}</th>
                                            <th className="px-6 py-3">{t('Status')}</th>
                                            <th className="px-6 py-3">{t('Due')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant/5">
                                          {invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-surface-container-low/50">
                                              <td className="px-6 py-3 font-mono text-sm font-bold">{inv.invoice_number}</td>
                                              <td className="px-6 py-3 text-sm text-on-surface-variant">{yearName(inv)}</td>
                                              <td className="px-6 py-3 text-sm">CFA {parseFloat(inv.total_amount).toLocaleString()}</td>
                                              <td className="px-6 py-3 text-sm">CFA {parseFloat(inv.amount_paid).toLocaleString()}</td>
                                              <td className="px-6 py-3 text-sm font-bold">{parseFloat(inv.balance) === 0 ? <span className="text-secondary">{t('Settled')}</span> : `CFA ${parseFloat(inv.balance).toLocaleString()}`}</td>
                                              <td className="px-6 py-3">{statusBadge(inv)}</td>
                                              <td className="px-6 py-3 text-sm text-on-surface-variant">{new Date(inv.due_date).toLocaleDateString()}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                {/* Transactions */}
                                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                                  <div className="px-6 py-4 border-b border-outline-variant/10"><h3 className="font-bold text-on-surface">{t('Payment History')}</h3></div>
                                  {transactions.length === 0 ? (
                                    <div className="p-8 text-center text-on-surface-variant text-sm">{t('No payments recorded.')}</div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left">
                                        <thead>
                                          <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                                            <th className="px-6 py-3">{t('Receipt')}</th>
                                            <th className="px-6 py-3">{t('Date')}</th>
                                            <th className="px-6 py-3">{t('Method')}</th>
                                            <th className="px-6 py-3">{t('Amount')}</th>
                                            <th className="px-6 py-3">{t('Balance After')}</th>
                                            <th className="px-6 py-3 text-right">{t('Receipt')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant/5">
                                          {transactions.map((tx: any) => (
                                            <tr key={tx.id} className="hover:bg-surface-container-low/50">
                                              <td className="px-6 py-3 font-mono text-sm font-bold">{tx.receipt_number}</td>
                                              <td className="px-6 py-3 text-sm text-on-surface-variant">{new Date(tx.created_at || tx.payment_date).toLocaleDateString()}</td>
                                              <td className="px-6 py-3 text-sm capitalize">{tx.method || tx.payment_method}</td>
                                              <td className="px-6 py-3 text-sm font-bold">CFA {parseFloat(tx.amount).toLocaleString()}</td>
                                              <td className="px-6 py-3 text-sm">
                                                {tx.balance_after !== null && tx.balance_after !== undefined
                                                  ? (parseFloat(tx.balance_after) > 0 ? `CFA ${parseFloat(tx.balance_after).toLocaleString()}` : <span className="text-secondary">{t('Settled')}</span>)
                                                  : '—'}
                                              </td>
                                              <td className="px-6 py-3 text-right whitespace-nowrap">
                                                <button
                                                  onClick={() => handlePrintReceipt(tx)}
                                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-colors"
                                                >
                                                  <span className="material-symbols-outlined text-sm">print</span> {t('Print')}
                                                </button>
                                                <button
                                                  onClick={() => handleDownloadReceipt(tx)}
                                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low transition-colors"
                                                >
                                                  <span className="material-symbols-outlined text-sm">download</span>
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
