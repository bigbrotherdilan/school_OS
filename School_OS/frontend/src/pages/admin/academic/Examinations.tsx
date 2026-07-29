import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function Examinations() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [terms, setTerms] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', term: '', weight: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [examsRes, termsRes] = await Promise.all([
        api.get('/assessments/exams/'),
        api.get('/academic/terms/')
      ]);
      setExams(examsRes.data.results || examsRes.data);
      setTerms(termsRes.data.results || termsRes.data);
    } catch {
      console.error('Failed to fetch exams');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.term || !form.weight) {
      addToast('Please fill in all required fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/assessments/exams/', {
        name: form.name,
        term: form.term,
        weight: parseFloat(form.weight),
        is_published: false,
      });
      addToast('Examination scheduled. Students will be notified.', 'success');
      setShowModal(false);
      setForm({ name: '', term: '', weight: '' });
      fetchData();
    } catch {
      addToast('Failed to create examination.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Student Assessment</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Examinations & Reporting</h2>
          <p className="text-on-surface-variant text-lg mt-2">Configure exams, manage reporting windows, and generate official transcript records.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          New Examination
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">Registered Examinations</h3>
            <div className="flex gap-2">
              <button className="p-2 text-outline hover:text-primary transition-colors">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mb-4">sync</span>
              <p>Loading assessment records...</p>
            </div>
          ) : exams.length === 0 ? (
            <div className="p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-4">assignment_add</span>
              <h4 className="text-lg font-bold text-on-surface mb-2">No Exams Configured</h4>
              <p className="text-sm text-on-surface-variant mb-6">Create the first examination entry to begin tracking sequence marks and final results.</p>
              <button onClick={() => setShowModal(true)} className="text-primary font-semibold hover:underline border border-primary/20 px-6 py-2 rounded-lg">Create Exam</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Exam Name</th>
                  <th className="p-4">Academic Term</th>
                  <th className="p-4">Weighting</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {exams.map((exam: any) => (
                  <tr key={exam.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-on-surface">{exam.name}</td>
                    <td className="p-4 text-sm text-on-surface-variant">{exam.term_name || 'Current Term'}</td>
                    <td className="p-4 text-sm font-medium text-primary">{exam.weight}%</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${exam.is_published ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                        {exam.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button className="text-primary hover:underline text-sm font-semibold">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h3 className="font-bold text-on-surface">Generate Reports</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">Compile official termly report cards and class master sheets once marks are validated.</p>
            <button onClick={() => navigate('/admin/academic/report-cards')} className="w-full bg-primary text-white hover:opacity-90 transition-all font-semibold py-3 rounded-xl flex justify-center items-center gap-2 shadow-md">
              <span className="material-symbols-outlined">description</span>
              Generate Report Cards
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary">
              <div>
                <h3 className="text-2xl font-bold text-white">New Examination</h3>
                <p className="text-blue-100 text-sm">Configure a new exam entry for the current term</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Exam Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. First Term Examination 2026"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Term *</label>
                <select
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">Select Term</option>
                  {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Weight (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Examination'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
