import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function FinanceFeeSetup() {
  const { t } = useTranslation('adminFinance');
  const { addToast } = useToastStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [catForm, setCatForm] = useState({ name: '', is_mandatory: true, description: '' });
  const [structForm, setStructForm] = useState({ category: '', target_class: '', amount: '' });
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingStruct, setEditingStruct] = useState<string | null>(null);
  const [tab, setTab] = useState<'categories' | 'structures'>('categories');

  useEffect(() => {
    Promise.all([
      api.get('/finance/categories/'),
      api.get('/finance/structures/'),
      api.get('/academic/classes/'),
      api.get('/academic/academic-years/'),
    ]).then(([cRes, sRes, clRes, yRes]) => {
      setCategories(cRes.data.results || cRes.data);
      setStructures(sRes.data.results || sRes.data);
      setClasses(clRes.data.results || clRes.data);
      setAcademicYears(yRes.data.results || yRes.data);
    }).catch(console.error);
  }, []);

  const saveCategory = async () => {
    if (!catForm.name.trim()) return addToast(t('Category name is required.'), 'error');
    try {
      if (editingCat) {
        await api.patch(`/finance/categories/${editingCat}/`, catForm);
        addToast(t('Category updated.'), 'success');
      } else {
        await api.post('/finance/categories/', catForm);
        addToast(t('Category created.'), 'success');
      }
      setCatForm({ name: '', is_mandatory: true, description: '' });
      setEditingCat(null);
      const res = await api.get('/finance/categories/');
      setCategories(res.data.results || res.data);
    } catch { addToast(t('Failed to save category.'), 'error'); }
  };

  const deleteCategory = async (id: string) => {
    try {
      await api.delete(`/finance/categories/${id}/`);
      setCategories(categories.filter(c => c.id !== id));
      addToast(t('Category deleted.'), 'success');
    } catch { addToast(t('Failed to delete category.'), 'error'); }
  };

  const saveStructure = async () => {
    if (!structForm.category || !structForm.amount) return addToast(t('Category and amount required.'), 'error');
    const yearId = academicYears[0]?.id;
    if (!yearId) return addToast(t('No academic year available.'), 'error');
    try {
      const payload = {
        category: structForm.category,
        target_class: structForm.target_class || null,
        amount: structForm.amount,
        academic_year: yearId,
      };
      if (editingStruct) {
        await api.patch(`/finance/structures/${editingStruct}/`, payload);
        addToast(t('Structure updated.'), 'success');
      } else {
        await api.post('/finance/structures/', payload);
        addToast(t('Fee structure created.'), 'success');
      }
      setStructForm({ category: '', target_class: '', amount: '' });
      setEditingStruct(null);
      const res = await api.get('/finance/structures/');
      setStructures(res.data.results || res.data);
    } catch { addToast(t('Failed to save fee structure.'), 'error'); }
  };

  const deleteStructure = async (id: string) => {
    try {
      await api.delete(`/finance/structures/${id}/`);
      setStructures(structures.filter(s => s.id !== id));
      addToast(t('Fee structure deleted.'), 'success');
    } catch { addToast(t('Failed to delete fee structure.'), 'error'); }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Financial Configuration')}</span>
        <h1 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Fee Setup')}</h1>
        <p className="text-on-surface-variant mt-1">{t('Configure fee categories and set amounts per class and academic year.')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-outline-variant/10">
        <button onClick={() => setTab('categories')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'categories' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t('Fee Categories')}</button>
        <button onClick={() => setTab('structures')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${tab === 'structures' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t('Fee Structures (Amounts)')}</button>
      </div>

      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <h3 className="font-bold text-on-surface mb-4">{editingCat ? t('Edit Category') : t('New Category')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Name')}</label>
                <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all" placeholder={t('e.g. Tuition Fee')} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={catForm.is_mandatory} onChange={e => setCatForm({ ...catForm, is_mandatory: e.target.checked })} className="w-5 h-5 rounded" />
                <label className="text-sm font-medium text-on-surface">{t('Mandatory fee')}</label>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Description (optional)')}</label>
                <textarea value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={2} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveCategory} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all">{editingCat ? t('Update') : t('Create')}</button>
                {editingCat && <button onClick={() => { setEditingCat(null); setCatForm({ name: '', is_mandatory: true, description: '' }); }} className="px-6 py-3 bg-surface-container-high rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">{t('Cancel')}</button>}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10"><h3 className="font-bold text-on-surface">{t('Existing Categories')}</h3></div>
            {categories.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm font-medium">{t('No fee categories yet. Create categories to organize your fee structure.')}</div>
            ) : (
              <div className="divide-y divide-outline-variant/5">
                {categories.map((c: any) => (
                  <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors">
                    <div>
                      <p className="font-bold text-on-surface">{c.name}</p>
                      <p className="text-xs text-on-surface-variant">{c.is_mandatory ? t('Mandatory') : t('Optional')} - {c.description || t('No description')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingCat(c.id); setCatForm({ name: c.name, is_mandatory: c.is_mandatory, description: c.description }); }} className="text-xs font-bold text-primary hover:underline">{t('Edit')}</button>
                      <button onClick={() => deleteCategory(c.id)} className="text-xs font-bold text-error hover:underline">{t('Delete')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'structures' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
            <h3 className="font-bold text-on-surface mb-4">{editingStruct ? t('Edit Fee Structure') : t('New Fee Structure')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Fee Category')}</label>
                <select value={structForm.category} onChange={e => setStructForm({ ...structForm, category: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="">{t('Select category')}</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Class (leave blank for all)')}</label>
                <select value={structForm.target_class} onChange={e => setStructForm({ ...structForm, target_class: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="">{t('All Classes')}</option>
                  {classes.map((cl: any) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">{t('Amount (CFA)')}</label>
                <input type="number" value={structForm.amount} onChange={e => setStructForm({ ...structForm, amount: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all" placeholder="0.00" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveStructure} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all">{editingStruct ? t('Update') : t('Create')}</button>
                {editingStruct && <button onClick={() => { setEditingStruct(null); setStructForm({ category: '', target_class: '', amount: '' }); }} className="px-6 py-3 bg-surface-container-high rounded-xl font-bold text-xs uppercase tracking-widest transition-all">{t('Cancel')}</button>}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10"><h3 className="font-bold text-on-surface">{t('Existing Structures')}</h3></div>
            {structures.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm font-medium">{t('No fee structures yet. Set up your first fee structure to start billing.')}</div>
            ) : (
              <div className="divide-y divide-outline-variant/5">
                {structures.map((s: any) => (
                  <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors">
                    <div>
                      <p className="font-bold text-on-surface">{s.category_display}</p>
                      <p className="text-xs text-on-surface-variant">{s.class_display || t('All Classes')} - CFA {s.amount.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingStruct(s.id); setStructForm({ category: s.category, target_class: s.target_class || '', amount: s.amount }); }} className="text-xs font-bold text-primary hover:underline">{t('Edit')}</button>
                      <button onClick={() => deleteStructure(s.id)} className="text-xs font-bold text-error hover:underline">{t('Delete')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}