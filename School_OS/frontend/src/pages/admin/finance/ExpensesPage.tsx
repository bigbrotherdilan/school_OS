import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useCanRecordFinance } from '../../../hooks/useCanRecordFinance';

export default function ExpensesPage() {
  const { t } = useTranslation('adminFinance');
  const { addToast } = useToastStore();
  const canRecord = useCanRecordFinance();
  const [categories, setCategories] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'categories'>('list');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0,10) });

  useEffect(() => {
    Promise.all([
      api.get('/finance/expense-categories/'),
      api.get('/finance/expenses/'),
    ]).then(([cRes, eRes]) => {
      setCategories(cRes.data.results || cRes.data);
      setExpenses(eRes.data.results || eRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.category || !form.amount || !form.description) return addToast(t('Fill all fields.'), 'error');
    try {
      await api.post('/finance/expenses/', { ...form, amount: parseFloat(form.amount) });
      addToast(t('Expense recorded.'), 'success');
      setShowForm(false);
      setForm({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0,10) });
      const res = await api.get('/finance/expenses/');
      setExpenses(res.data.results || res.data);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed.'), 'error');
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Finance')}</span>
          <h1 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Expenses')}</h1>
          <p className="text-on-surface-variant mt-1">{t('Record and track school operating expenses.')}</p>
        </div>
        {canRecord && (
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all">
            {t('+ New Expense')}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-outline-variant/10">
        <button onClick={() => setTab('list')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'list' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t('All Expenses')}</button>
        <button onClick={() => setTab('categories')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'categories' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t('Categories ({{num}})', { num: categories.length })}</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-on-surface mb-4">{t('Record Expense')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Category')}</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                  <option value="">{t('Select')}</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Amount (CFA)')}</label>
                <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Description')}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Date')}</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs uppercase tracking-widest">{t('Cancel')}</button>
                <button onClick={handleSubmit} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest">{t('Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
          <div className="p-6">
            <h3 className="font-bold text-on-surface mb-4">{t('Expense Categories')}</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((c: any) => (
                <span key={c.id} className="px-4 py-2 bg-surface-container-high rounded-xl text-sm font-bold">{c.name}</span>
              ))}
              {categories.length === 0 && <p className="text-on-surface-variant text-sm">{t('No categories defined.')}</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{t('Total Expenses')}</span>
            <p className="text-3xl font-bold text-on-surface mt-1">CFA {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-on-surface-variant">{t('Loading...')}</div>
            ) : expenses.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-30 mx-auto">receipt_long</span>
                <p className="text-sm font-bold">{t('No expenses recorded.')}</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container-low">
                    <th className="px-6 py-4">{t('Date')}</th>
                    <th className="px-6 py-4">{t('Category')}</th>
                    <th className="px-6 py-4">{t('Description')}</th>
                    <th className="px-6 py-4">{t('Amount')}</th>
                    <th className="px-6 py-4">{t('Recorded By')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {expenses.map((e: any) => (
                    <tr key={e.id} className="hover:bg-surface-container-low/50">
                      <td className="px-6 py-4 text-sm">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4"><span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold uppercase">{e.category_name}</span></td>
                      <td className="px-6 py-4 text-sm">{e.description}</td>
                      <td className="px-6 py-4 font-bold text-sm">CFA {e.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{e.recorded_by_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}