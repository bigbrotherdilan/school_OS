import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

export default function OperationsCenter() {
  const navigate = useNavigate();
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await api.get('/staff/teachers/');
        const data = response.data.results || response.data;
        setTeacherCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setTeacherCount(null);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-outline-variant/15 pb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined text-3xl">settings_input_component</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block">Administration Hub</span>
              <h2 className="text-4xl font-bold tracking-tight text-on-surface">School Administration</h2>
            </div>
          </div>
          <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
            Staff management, discipline records, and daily school logistics oversight.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-surface-container-low px-6 py-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col items-end">
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Teachers on Staff</span>
            {loading ? (
              <span className="text-2xl font-black text-primary">...</span>
            ) : teacherCount !== null ? (
              <span className="text-2xl font-black text-primary">{teacherCount}</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Operations Modules Navigation */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Staff Directory', icon: 'badge', path: '/admin/operations/faculty', color: 'bg-blue-500' },
          { label: 'Teacher Appraisal', icon: 'groups', path: '/admin/operations/faculty-performance', color: 'bg-emerald-500' },
          { label: 'Discipline & Transfers', icon: 'gavel', path: '/admin/operations/discipline', color: 'bg-amber-500' },
          { label: 'Add Staff', icon: 'person_add', path: '/admin/operations/faculty/new', color: 'bg-violet-500' },
          { label: 'Add Bursar', icon: 'account_balance', path: '/admin/operations/bursars/new', color: 'bg-emerald-600' },
        ].map((mod) => (
          <button
            key={mod.path}
            onClick={() => navigate(mod.path)}
            className="bg-surface-container-lowest p-4 lg:p-5 rounded-xl border border-outline-variant/15 hover:border-primary/30 hover:shadow-md transition-all group text-left"
          >
            <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center text-white mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{mod.icon}</span>
            </div>
            <span className="text-xs font-bold text-on-surface block leading-tight">{mod.label}</span>
          </button>
        ))}
      </section>

      <footer className="mt-20 py-20 border-t border-outline-variant/15 text-center flex flex-col items-center gap-8">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center grayscale opacity-30 shadow-inner">
          <span className="material-symbols-outlined text-4xl">factory</span>
        </div>
        <p className="text-on-surface-variant italic font-serif text-2xl max-w-2xl leading-relaxed">
          "School administration is the backbone of educational excellence."
        </p>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/30">- School Administration</p>
          <div className="flex gap-1 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
