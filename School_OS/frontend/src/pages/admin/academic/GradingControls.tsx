import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Lock, Unlock, PlusCircle, Calendar } from 'lucide-react';

interface Sequence {
  id: number;
  name: string;
  order_number: number;
  term: number;
  term_name: string;
  academic_year_id: number;
}

interface Term {
  id: number;
  name: string;
  order_number: number;
  sequences: Sequence[];
}

interface MarkWindow {
  id: string;
  sequence: number;
  sequence_name: string;
  term_name: string;
  academic_year: number;
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
}

export default function GradingControls() {
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [terms, setTerms] = useState<Term[]>([]);
  const [windows, setWindows] = useState<MarkWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    sequence: '',
    start_date: '',
    end_date: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, wRes] = await Promise.all([
        api.get('/academic/terms/'),
        api.get('/assessments/mark-windows/'),
      ]);
      setTerms(tRes.data.results || tRes.data);
      setWindows(wRes.data.results || wRes.data);
    } catch {
      addToast('Failed to load grading data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sequence) {
      addToast('Please select a sequence.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      // Find academic_year from the selected sequence
      let academicYearId = '';
      for (const term of terms) {
        const seq = term.sequences?.find(s => String(s.id) === form.sequence);
        if (seq) { academicYearId = String(seq.academic_year_id); break; }
      }
      await api.post('/assessments/mark-windows/', {
        academic_year: academicYearId,
        sequence: form.sequence,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      addToast('Mark entry window created. Toggle Open to activate.', 'success');
      fetchData();
      setForm({ sequence: '', start_date: '', end_date: '' });
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.sequence?.[0] || 'Failed to create window.';
      addToast(msg, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (windowId: string, currentState: boolean) => {
    try {
      await api.post(`/assessments/mark-windows/${windowId}/toggle/`);
      addToast(`Window ${!currentState ? 'OPENED' : 'CLOSED'}. All teachers notified.`, 'success');
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Toggle failed.', 'error');
    }
  };

  const getWindowForSequence = (seqId: number) => windows.find(w => w.sequence === seqId);

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all mb-8 active:scale-95">
        <LayoutDashboard className="w-4 h-4" /> Overview Dashboard
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 block mb-3">Assessment Entry</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Mark Entry Control</h1>
        <p className="text-on-surface-variant mt-2 text-lg">
          Open or close mark entry windows per sequence. Each sequence is 50% of the term.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Create Window Form */}
        <form onSubmit={handleCreate} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Calendar className="text-primary w-6 h-6" /> New Mark Window
          </h3>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sequence</label>
            <select
              required
              value={form.sequence}
              onChange={e => setForm({ ...form, sequence: e.target.value })}
              className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold"
            >
              <option value="">Select Sequence...</option>
              {terms.map(term => (
                <optgroup key={term.id} label={term.name}>
                  {(term.sequences || []).map(seq => {
                    const hasWindow = getWindowForSequence(seq.id);
                    return (
                      <option key={seq.id} value={seq.id} disabled={!!hasWindow}>
                        {seq.name} {hasWindow ? '(configured)' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Window Opens</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Window Closes</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreating || !form.sequence}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          >
            {isCreating ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <PlusCircle className="w-4 h-4" />}
            {isCreating ? 'Creating...' : 'Create Window'}
          </button>
        </form>

        {/* Active Windows List */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Active Configuration</h3>
          {loading && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
            </div>
          )}
          {!loading && windows.length === 0 && (
            <div className="p-8 bg-surface-container-low rounded-2xl text-center">
              <p className="text-on-surface-variant text-sm font-medium">No mark windows yet. Create one to let teachers enter marks.</p>
            </div>
          )}
          {!loading && windows.map(w => (
            <div
              key={w.id}
              className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${w.is_open ? 'bg-secondary/5 border-secondary/20' : 'bg-surface-container-lowest border-outline-variant/10'}`}
            >
              <div>
                <div className="font-bold text-sm flex items-center gap-2">
                  {w.is_open ? <Unlock className="w-4 h-4 text-secondary" /> : <Lock className="w-4 h-4 text-outline" />}
                  {w.sequence_name || `Sequence ${w.sequence}`}
                </div>
                <div className="text-xs text-on-surface-variant mt-1">{w.term_name}</div>
                {w.start_date && (
                  <div className="text-xs text-outline mt-1 font-mono">
                    {w.start_date} → {w.end_date || 'open-ended'}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleToggle(w.id, w.is_open)}
                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${w.is_open
                  ? 'bg-error/10 text-error hover:bg-error/20'
                  : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                }`}
              >
                {w.is_open ? 'Close' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
