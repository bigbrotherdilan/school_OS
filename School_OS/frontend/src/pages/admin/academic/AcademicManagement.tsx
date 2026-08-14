import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';

export default function AcademicManagement() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { activeSectionId } = useSectionStore();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  const handlePendingFeature = (featureName: string) => {
    addToast(`${featureName} module is subject to deployment in upcoming sprint.`, 'info');
  };

  useEffect(() => {
    const closeMenu = () => setMenuOpenFor(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const activateStudent = async (studentId: string) => {
    try {
      const res = await api.post(`/students/students/${studentId}/verify/`);
      addToast(res.data.message || 'Student activated.', 'success');
      setStudents(prev => prev.map((s: any) => s.id === studentId ? { ...s, status: 'active' } : s));
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to activate student.', 'error');
    }
  };

  const updateStatus = async (studentId: string, status: string) => {
    if (updatingId) return;
    setUpdatingId(studentId);
    setMenuOpenFor(null);
    try {
      await api.post(`/students/students/${studentId}/set_status/`, { status });
      addToast(`Student marked as ${status}.`, 'success');
      setStudents(prev => prev.map((s: any) => s.id === studentId ? { ...s, status } : s));
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || 'Failed to update status.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await api.get('/students/students/', { params: activeSectionId ? { stream: activeSectionId } : undefined });
        setStudents(res.data.results || res.data);
      } catch (e) {
        console.error("Failed to fetch students", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [activeSectionId]);

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <section>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Studies Office</span>
        <h2 className="text-4xl font-semibold tracking-tight text-on-surface mb-4">Academic Registry & Records</h2>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Manage student enrollment, classes, sections, and academic records across both Anglophone and Francophone sections.
        </p>
      </section>

      {/* Academic Modules Navigation */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Setup', icon: 'account_tree', path: '/admin/academic/setup', color: 'bg-blue-500' },
          { label: 'Mark Entry & Exams', icon: 'assignment', path: '/admin/academic/exam-workflow', color: 'bg-emerald-500' },
          { label: 'Scheme of Work', icon: 'menu_book', path: '/admin/academic/curriculum', color: 'bg-amber-500' },
          { label: 'Report Cards', icon: 'description', path: '/admin/academic/report-cards', color: 'bg-rose-500' },
          { label: 'Class Promotion', icon: 'trending_up', path: '/admin/academic/promotions', color: 'bg-cyan-500' },
          { label: 'Analytics', icon: 'analytics', path: '/admin/academic/analytics', color: 'bg-indigo-500' },
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

      {/* Student Registry */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="text-2xl font-semibold text-primary">Student Registry</h3>
            <p className="text-sm text-on-surface-variant mt-1">Real-time status tracking for high-performance management</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handlePendingFeature('Registry Filtering')} className="flex items-center gap-2 border border-outline-variant/50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-all">
              <span className="material-symbols-outlined text-lg">filter_list</span>
              Filter Registry
            </button>
            <button 
              onClick={() => navigate('/admin/academic/students/import')}
              className="flex items-center gap-2 bg-surface-container-high text-on-surface px-6 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-highest transition-all"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Bulk Import
            </button>
            <button 
              onClick={() => navigate('/admin/academic/students/new')}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-lg active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              Add New Student
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                <th className="p-6">Student Information</th>
                <th className="p-6">Registry ID</th>
                <th className="p-6">Classification</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-on-surface-variant text-sm font-semibold">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl mb-2">sync</span>
                    <p>Loading Registry Data...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-on-surface-variant text-sm font-semibold">
                    No students registered yet. <button onClick={() => navigate('/admin/academic/students/new')} className="text-primary underline">Add a new student</button>.
                  </td>
                </tr>
              ) : students.map((stu, i) => (
                <tr key={stu.id ?? i} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center text-primary font-bold">
                        {stu.first_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-bold text-on-surface">{stu.first_name} {stu.last_name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-tighter text-outline mt-0.5">{stu.series_code || stu.section_display || 'No Section'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 font-mono text-xs text-on-surface-variant">{stu.admission_number || 'Pending'}</td>
                  <td className="p-6">
                    <div className="text-sm font-medium">{stu.current_class?.name || 'Pending Placement'}</div>
                    <div className="text-[10px] text-outline">Active Term</div>
                  </td>
                  <td className="p-6">
                    <div className={`flex items-center gap-2 ${stu.status === 'registered' || stu.status === 'active' ? 'text-secondary' : 'text-on-tertiary-container'}`}>
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {stu.status === 'registered' || stu.status === 'active' ? 'verified_user' : 'warning'}
                      </span>
                      <span className="text-xs font-semibold capitalize">{stu.status}</span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate('/admin/finance/transactions/new', { state: { studentId: stu.id } })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-secondary/10 text-secondary rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-secondary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">payments</span>
                        Record Payment
                      </button>
                      <button
                        onClick={() => navigate(`/admin/academic/students/${stu.id}/edit`)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      {stu.status === 'active' && (
                        <>
                          <button
                            onClick={() => updateStatus(stu.id, 'inactive')}
                            disabled={updatingId === stu.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-error/10 text-error rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-error/20 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">toggle_off</span>
                            Deactivate
                          </button>
                          <div className="relative">
                            <button
                              onClick={e => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === stu.id ? null : stu.id); }}
                              disabled={updatingId === stu.id}
                              title="More status actions"
                              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-highest text-on-surface-variant rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-surface-container-high transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">more_horiz</span>
                            </button>
                            {menuOpenFor === stu.id && (
                              <div className="absolute right-0 top-full mt-2 w-44 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/15 py-1 z-20 text-left">
                                {[
                                  { status: 'suspended', label: 'Suspend', icon: 'pause_circle' },
                                  { status: 'withdrawn', label: 'Withdraw', icon: 'person_remove' },
                                  { status: 'graduated', label: 'Graduate', icon: 'school' },
                                ].map(opt => (
                                  <button
                                    key={opt.status}
                                    onClick={() => updateStatus(stu.id, opt.status)}
                                    disabled={updatingId === stu.id}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold hover:bg-surface-container/60 transition-colors disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {stu.status === 'registered' && (
                        <button
                          onClick={() => activateStudent(stu.id)}
                          disabled={updatingId === stu.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">verified_user</span>
                          Activate
                        </button>
                      )}
                      {!['active', 'registered'].includes(stu.status) && (
                        <button
                          onClick={() => updateStatus(stu.id, 'active')}
                          disabled={updatingId === stu.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">verified_user</span>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-surface-container-low/50 p-4 border-t border-outline-variant/15">
            <span className="text-xs text-on-surface-variant font-medium">Showing {students.length} students</span>
          </div>
        </div>
      </section>
    </div>
  );
}
