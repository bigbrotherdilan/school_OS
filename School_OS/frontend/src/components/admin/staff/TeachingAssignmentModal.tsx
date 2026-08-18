import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { 
  X, 
  Plus, 
  Trash2, 
  GraduationCap, 
  BookOpen, 
  Calendar,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface TeachingAssignmentModalProps {
  teacher: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TeachingAssignmentModal({ teacher, onClose, onUpdate }: TeachingAssignmentModalProps) {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>(teacher.assignments || []);
  const [metadata, setMetadata] = useState<{ classes: any[], subjects: any[], years: any[] }>({
    classes: [],
    subjects: [],
    years: []
  });

  const [formData, setFormData] = useState({
    subject: '',
    academic_class: '',
    academic_year: ''
  });

  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [classesRes, subjectsRes, yearsRes] = await Promise.all([
          api.get('/academic/classes/'),
          api.get('/academic/subjects/'),
          api.get('/academic/academic-years/')
        ]);
        setMetadata({
          classes: classesRes.data.results || classesRes.data,
          subjects: subjectsRes.data.results || subjectsRes.data,
          years: yearsRes.data.results || yearsRes.data
        });
      } catch (err) {
        addToast('Failed to load academic metadata.', 'error');
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (!formData.subject || !formData.academic_class || !formData.academic_year) {
      setConflictWarning(null);
      return;
    }
    const duplicate = assignments.find(
      a => a.subject === formData.subject
        && a.academic_class === formData.academic_class
        && a.academic_year === formData.academic_year
    );
    if (duplicate) {
      setConflictWarning(
        `This teacher already has an assignment for ${duplicate.subject_name} in ${duplicate.class_name} (${duplicate.academic_year_name}).`
      );
    } else {
      const sameSubject = assignments.find(
        a => a.subject === formData.subject && a.academic_year === formData.academic_year
      );
      const sameClass = assignments.find(
        a => a.academic_class === formData.academic_class && a.academic_year === formData.academic_year
      );
      if (sameSubject) {
        setConflictWarning(
          `Note: This teacher already teaches ${sameSubject.subject_name} in ${sameSubject.class_name} this year.`
        );
      } else if (sameClass) {
        setConflictWarning(
          `Note: This teacher already has a subject in ${sameClass.class_name} this year.`
        );
      } else {
        setConflictWarning(null);
      }
    }
  }, [formData, assignments]);

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/staff/assignments/', {
        teacher: teacher.id,
        ...formData
      });
      addToast('Teaching assignment saved.', 'success');
      setAssignments([...assignments, response.data]);
      setFormData({ subject: '', academic_class: '', academic_year: '' });
      setConflictWarning(null);
      onUpdate();
    } catch (error: any) {
      const data = error.response?.data;
      const msg = typeof data === 'string' ? data
        : data?.detail || data?.non_field_errors?.[0] || data?.subject?.[0] || data?.teacher?.[0] || data?.academic_class?.[0] || data?.academic_year?.[0] || JSON.stringify(data) || 'Failed to create assignment.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await api.delete(`/staff/assignments/${assignmentId}/`);
      addToast('Assignment removed.', 'success');
      setAssignments(assignments.filter(a => a.id !== assignmentId));
      onUpdate();
    } catch (error) {
      addToast('Failed to remove assignment.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-[40px] shadow-2xl border border-outline-variant/10 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-1">Strategic Oversight</span>
            <h2 className="text-2xl font-black text-on-surface tracking-tight">Assignment Manager</h2>
            <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-widest">Faculty: <span className="text-primary">{teacher.user_details?.full_name}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-surface-container-high rounded-2xl transition-colors text-on-surface-variant"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-10">
          
          {/* New Assignment Form */}
          <section className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Create New Assignment
            </h3>
            
            <form onSubmit={handleAddAssignment} className="bg-surface-container-low/50 p-6 rounded-3xl border border-outline-variant/5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Academic Year</label>
                <select 
                  required
                  value={formData.academic_year}
                  onChange={e => setFormData({ ...formData, academic_year: e.target.value })}
                  className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                >
                  <option value="">Select Year</option>
                  {metadata.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Class</label>
                <select 
                  required
                  value={formData.academic_class}
                  onChange={e => setFormData({ ...formData, academic_class: e.target.value })}
                  className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                >
                  <option value="">Select Class</option>
                  {metadata.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Subject</label>
                <select 
                  required
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                >
                  <option value="">Select Subject</option>
                  {metadata.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end pt-2">
                {conflictWarning && (
                  <div className="flex items-center gap-2 mr-auto px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {conflictWarning}
                  </div>
                )}
                <button 
                  type="submit"
                  disabled={loading || !formData.subject || !formData.academic_class || !formData.academic_year}
                  className="bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Deploy Assignment
                </button>
              </div>
            </form>
          </section>

          {/* Existing Assignments List */}
          <section className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> Current Deployment
            </h3>
            
            <div className="space-y-3">
              {assignments.length === 0 ? (
                <div className="py-12 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                  <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">No active assignments found</p>
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div key={assignment.id} className="group bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-sm hover:border-primary/30 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3 h-3 text-primary" />
                          <span className="text-sm font-black text-on-surface">{assignment.subject_name}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1.5 grayscale opacity-50">
                            <GraduationCap className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">{assignment.class_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 grayscale opacity-50">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">{assignment.academic_year_name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="p-3 bg-error/5 text-error rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-6 bg-surface-container-low/30 border-t border-outline-variant/10 flex justify-center">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-on-surface-variant/30 italic">Institutional Standard - Faculty Registry Protocol</p>
        </div>

      </div>
    </div>
  );
}
