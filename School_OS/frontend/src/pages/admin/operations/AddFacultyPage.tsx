import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../../stores/toastStore';
import { ArrowLeft, UserCircle, BadgeCheck, CheckCircle, GraduationCap } from 'lucide-react';
import { api } from '../../../services/api';

export default function AddFacultyPage() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [metadata, setMetadata] = useState<{ classes: any[], subjects: any[], years: any[] }>({
    classes: [],
    subjects: [],
    years: []
  });
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    employee_id: '',
    department: 'science',
    qualification: '',
    default_language: 'en',
    subject_id: '',
    class_id: '',
    academic_year_id: ''
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [classesRes, subjectsRes, yearsRes] = await Promise.all([
          api.get('/academic/classes/'),
          api.get('/academic/subjects/'),
          api.get('/academic/academic-years/')
        ]);
        const years = yearsRes.data.results || yearsRes.data;
        setMetadata({
          classes: classesRes.data.results || classesRes.data,
          subjects: subjectsRes.data.results || subjectsRes.data,
          years: years
        });
        const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
          const now = new Date();
          return now >= new Date(y.start_date) && now <= new Date(y.end_date);
        });
        if (activeYear) setFormData(f => ({ ...f, academic_year_id: activeYear.id }));
      } catch (err) {
        addToast('Failed to load academic metadata.', 'error');
      }
    };
    fetchMetadata();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject_id || !formData.class_id || !formData.academic_year_id) {
      addToast('Initial academic assignment is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const res = await api.post('/staff/teachers/onboard/', formData);
      
      setResult(res.data);
      addToast(`Teacher member ${formData.first_name} onboarded successfully.`, 'success');
    } catch (error: any) {
      const data = error.response?.data;
      let detail = 'Failed to onboard teacher.';
      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = data.detail;
      } else if (data?.message) {
        detail = data.message;
      } else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          detail = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
      }
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
        <button onClick={() => navigate('/admin/operations')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Operations
        </button>

        <div className="bg-surface-container-lowest p-12 rounded-3xl border border-outline-variant/10 shadow-sm max-w-lg mx-auto text-center space-y-8">
          <div className="w-20 h-20 rounded-3xl bg-secondary-container/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-on-surface mb-2">Teacher Onboarded</h2>
            <p className="text-on-surface-variant">{result.teacher?.user_details?.full_name || formData.first_name} has been added to the system.</p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Email</span>
              <span className="font-bold text-on-surface">{result.teacher?.user_details?.email || formData.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Staff ID</span>
              <span className="font-bold text-on-surface">{result.teacher?.employee_id || 'Generated'}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-outline-variant/15 pt-3">
              <span className="text-on-surface-variant">Status</span>
              <span className="font-bold text-success text-sm">Credentials sent to email</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            A temporary password has been sent to the teacher's email. They will be prompted to change it on first login.
          </p>

          <button onClick={() => navigate('/admin/operations')} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
            Return to Operations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
      <button 
        onClick={() => navigate('/admin/operations')}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Administration
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 block mb-3">Staff Records</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Add Staff Member</h1>
        <p className="text-on-surface-variant mt-2 text-lg leading-relaxed max-w-2xl">
          Register a new staff member and assign their role and access credentials.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Form Body */}
        <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8">
            
            {/* Personal Details */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                <UserCircle className="text-primary w-6 h-6" /> Personal Details
              </h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First Name</label>
                  <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Last Name</label>
                  <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Official Email Address</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. name@school.edu" />
              </div>
            </div>

            {/* Professional Details */}
            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                <BadgeCheck className="text-primary w-6 h-6" /> Professional Credentials
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Staff ID Number</label>
                  <input type="text" name="employee_id" value={formData.employee_id} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:font-normal placeholder:text-on-surface-variant/40" placeholder="Auto-generated if blank" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Primary Department</label>
                  <select name="department" value={formData.department} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                    <option value="science">Science & Technology</option>
                    <option value="arts">Arts & Humanities</option>
                    <option value="languages">Languages (Bilingual)</option>
                    <option value="mathematics">Mathematics</option>
                    <option value="physical_ed">Physical Education</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Highest Qualification</label>
                  <input type="text" name="qualification" value={formData.qualification} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. MS.c Physics" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">System Language</label>
                  <select name="default_language" value={formData.default_language} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                    <option value="en">English</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Strategic Assignment */}
            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                <GraduationCap className="text-primary w-6 h-6" /> Initial Academic Assignment
              </h3>
              
              <div className="space-y-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Required for Onboarding</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Academic Year</label>
                    <select required name="academic_year_id" value={formData.academic_year_id} onChange={handleChange} className="w-full bg-white border border-outline-variant/20 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold transition-all appearance-none cursor-pointer">
                      <option value="">Select Year</option>
                      {metadata.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Primary Class</label>
                    <select required name="class_id" value={formData.class_id} onChange={handleChange} className="w-full bg-white border border-outline-variant/20 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold transition-all appearance-none cursor-pointer">
                      <option value="">Select Class</option>
                      {metadata.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subject Specialization</label>
                    <select required name="subject_id" value={formData.subject_id} onChange={handleChange} className="w-full bg-white border border-outline-variant/20 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold transition-all appearance-none cursor-pointer">
                      <option value="">Select Subject</option>
                      {metadata.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8">
              <button disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email || !formData.subject_id} type="submit" className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {isSubmitting ? 'Provisioning Agent...' : 'Complete Onboarding'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="lg:col-span-1">
          <div className="bg-primary-container/30 p-8 rounded-3xl border border-primary/10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary text-3xl">admin_panel_settings</span>
            </div>
            <h4 className="text-sm font-bold tracking-tight text-on-surface mb-3">Identity Provisioning</h4>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Completing this form will create a global system identity and bind it to the school's active tenant. The teacher will receive an email to finalize their password and log into the teacher's portal.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
