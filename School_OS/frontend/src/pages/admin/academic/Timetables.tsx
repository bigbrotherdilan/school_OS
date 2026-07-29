import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function Timetables() {
  const [timetables, setTimetables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: '', termId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ttRes, classesRes, termsRes] = await Promise.all([
        api.get('/timetable/timetables/'),
        api.get('/academic/classes/'),
        api.get('/academic/terms/')
      ]);
      setTimetables(ttRes.data.results || ttRes.data);
      setClasses(classesRes.data.results || classesRes.data);
      setTerms(termsRes.data.results || termsRes.data);
    } catch {
      console.error('Failed to fetch timetables');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.classId || !form.termId) {
      addToast('Please select a class and term.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/timetable/timetables/', {
        class_obj: form.classId,
        term: form.termId,
        is_active: true,
      });
      addToast('Timetable published. Classes are now scheduled.', 'success');
      setShowModal(false);
      setForm({ classId: '', termId: '' });
      fetchData();
    } catch {
      addToast('Failed to create timetable.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Academic Scheduling</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Timetables & Deployment</h2>
          <p className="text-on-surface-variant text-lg mt-2">Manage class schedules, assign teaching faculty, and resolve scheduling conflicts.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          Create Timetable
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-8">
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary mb-4">sync</span>
            <p>Loading timetables...</p>
          </div>
        ) : timetables.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-low/30 rounded-xl border border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-outline mb-4 block">event_busy</span>
            <h3 className="text-lg font-bold text-on-surface mb-2">No Timetables Configured</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto mb-6">There are no academic timetables set up for the current term. Create a new timetable to assign classes to time slots.</p>
            <button onClick={() => setShowModal(true)} className="bg-surface-container-high text-on-surface px-6 py-2 rounded-lg font-medium hover:bg-surface-container-highest transition-colors">
              Create Timetable
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {timetables.map((tt: any) => (
              <div key={tt.id} className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/15 hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-primary-container text-primary rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined">calendar_month</span>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${tt.is_active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                    {tt.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-on-surface">{tt.class_details?.name || 'Unknown Class'}</h3>
                <p className="text-sm text-on-surface-variant mb-6">{tt.term?.name || 'Current Term'}</p>
                <div className="pt-4 border-t border-outline-variant/15 flex justify-between items-center group-hover:border-primary/20">
                  <span className="text-xs text-outline">{tt.slots?.length || 0} Slots Configured</span>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_forward</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Timetable Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary">
              <div>
                <h3 className="text-2xl font-bold text-white">Create Timetable</h3>
                <p className="text-blue-100 text-sm">Set up a new class schedule</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Academic Class *</label>
                <select
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">Select Class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Term / Sequence *</label>
                <select
                  value={form.termId}
                  onChange={(e) => setForm({ ...form, termId: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">Select Term</option>
                  {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                Time slots can be added after creating the timetable.
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Timetable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
