import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { BookOpen, Calendar, CalendarDays, PlusCircle, LayoutDashboard, Globe, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AcademicSetup() {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [activeTab, setActiveTab] = useState<'years' | 'terms' | 'sections' | 'classes' | 'subjects'>('years');
  const [loading, setLoading] = useState(false);

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' });
  const [termForm, setTermForm] = useState({ academic_year: '', name: '', order_number: 1 });
  const [classForm, setClassForm] = useState({ name: '', cycle: '', stream: '', level_order: 1 });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', cycle: '', default_coefficient: 1.0 });
  const [sectionForm, setSectionForm] = useState({ name: '', language: 'en' });

  const fetchData = async () => {
    if (!activeTenantId) {
      setLoading(false);
      addToast("No school selected. Please select a school from the sidebar first.", "error");
      return;
    }
    setLoading(true);
    try {
      const [yRes, tRes, cRes, secRes, sRes, clRes] = await Promise.all([
        api.get('/academic/academic-years/'),
        api.get('/academic/terms/'),
        api.get('/academic/cycles/'),
        api.get('/academic/sections/'),
        api.get('/academic/subjects/'),
        api.get('/academic/classes/')
      ]);
      const years = yRes.data.results || yRes.data;
      setAcademicYears(years);
      setTerms(tRes.data.results || tRes.data);
      setCycles(cRes.data.results || cRes.data);
      setSections(secRes.data.results || secRes.data);
      setSubjects(sRes.data.results || sRes.data);
      setClasses(clRes.data.results || clRes.data);
      const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
        const now = new Date();
        return now >= new Date(y.start_date) && now <= new Date(y.end_date);
      });
      if (activeYear) setTermForm(f => ({ ...f, academic_year: activeYear.id }));
    } catch (error) {
      console.error(error);
      addToast("Failed to sync configuration data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/academic-years/', yearForm);
      addToast("Academic year created! Your school calendar is taking shape.", "success");
      fetchData();
      setYearForm({ name: '', start_date: '', end_date: '' });
    } catch (error: any) {
      const data = error.response?.data;
      const status = error.response?.status;
      const msg = data?.detail || data?.error || (typeof data === 'string' ? `Server error (${status})` : `Failed to create Year`);
      addToast(msg, "error");
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/terms/', termForm);
      addToast("Term added. Students and teachers can now plan ahead.", "success");
      fetchData();
      setTermForm({ ...termForm, name: '', order_number: termForm.order_number + 1 });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || `Failed to create Term`, "error");
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/classes/', classForm);
      addToast("Class created! Ready to enroll students.", "success");
      fetchData();
      setClassForm({ ...classForm, name: '' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || `Failed to create Class`, "error");
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/subjects/', subjectForm);
      addToast("Subject added to your curriculum.", "success");
      fetchData();
      setSubjectForm({ ...subjectForm, name: '', code: '' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || `Failed to create Subject`, "error");
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/sections/', sectionForm);
      addToast("Section created! You can now assign classes to it.", "success");
      fetchData();
      setSectionForm({ name: '', language: 'en' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || `Failed to create Section`, "error");
    }
  };

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <LayoutDashboard className="w-4 h-4" /> Overview Dashboard
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 block mb-3">Academic Base Configuration</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Institutional Setup</h1>
        <p className="text-on-surface-variant mt-2 text-lg">Define foundational academic structures: Years, Terms, Cycles, Classes, and Curriculum.</p>
      </section>

      <div className="flex gap-4 mb-8 border-b border-outline-variant/20 pb-4 overflow-x-auto">
        {[
          { id: 'years', label: 'Academic Years', icon: Calendar },
          { id: 'terms', label: 'Terms', icon: CalendarDays },
          { id: 'sections', label: 'Sections', icon: Layers },
          { id: 'classes', label: 'Classes & Grade Levels', icon: Globe },
          { id: 'subjects', label: 'Curriculum Subjects', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12"><span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>}

      {!loading && !activeTenantId && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-7xl mb-4 block">domain_disabled</span>
          <h2 className="text-2xl font-bold text-primary mb-2">No School Selected</h2>
          <p className="text-on-surface-variant">Select a school from the sidebar before configuring academic settings.</p>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'years' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateYear} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">Open New Academic Year</h3>
            <input required type="text" placeholder="e.g. 2026-2027" value={yearForm.name} onChange={e => setYearForm({...yearForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Start Date</label>
                <input required type="date" value={yearForm.start_date} onChange={e => setYearForm({...yearForm, start_date: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-on-surface-variant">End Date</label>
                <input required type="date" value={yearForm.end_date} onChange={e => setYearForm({...yearForm, end_date: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold mt-1" />
              </div>
            </div>
            <button type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
              <PlusCircle className="w-4 h-4" /> Initialize Year
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">Registered Years</h3>
            <div className="space-y-3">
              {academicYears.map((yr: any) => (
                <div key={yr.id} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  <div>
                    <span className="font-bold text-lg">{yr.name}</span>
                    <span className="block text-xs text-on-surface-variant">{yr.start_date} to {yr.end_date}</span>
                  </div>
                  {yr.is_active && <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-[10px] font-black uppercase">Active Ledger</span>}
                </div>
              ))}
              {academicYears.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">No academic years yet. Create your first year to get started.</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'terms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateTerm} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">Define Term</h3>

            <select required value={termForm.academic_year} onChange={e => setTermForm({...termForm, academic_year: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">Select Target Year...</option>
              {academicYears.map((yr: any) => <option key={yr.id} value={yr.id}>{yr.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input required type="text" placeholder="e.g. First Term" value={termForm.name} onChange={e => setTermForm({...termForm, name: e.target.value})} className="col-span-1 bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              <input required type="number" min="1" placeholder="Order (e.g. 1)" value={termForm.order_number} onChange={e => setTermForm({...termForm, order_number: parseInt(e.target.value)})} className="col-span-1 bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>

            <button disabled={!termForm.academic_year} type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> Save Term
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">Established Terms</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {terms.map((t: any) => (
                <div key={t.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold">{t.name}</span>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase text-center w-8">{t.order_number}</span>
                  </div>
                  {t.start_date && <div className="text-xs text-on-surface-variant">{t.start_date} to {t.end_date || 'TBD'}</div>}
                </div>
              ))}
              {terms.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">No terms yet. Define your first term.</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'sections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateSection} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">Add New Section</h3>
            <p className="text-sm text-on-surface-variant">Sections group classes by type. Common examples: Anglophone, Francophone, Technical, Commercial.</p>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">Section Name</label>
              <input required type="text" placeholder="e.g. Anglophone, Technical, Commercial" value={sectionForm.name} onChange={e => setSectionForm({...sectionForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">Primary Language</label>
              <select value={sectionForm.language} onChange={e => setSectionForm({...sectionForm, language: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <button type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
              <PlusCircle className="w-4 h-4" /> Create Section
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">Existing Sections</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {sections.map((s: any) => (
                <div key={s.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{s.name}</span>
                    <span className="block text-xs text-on-surface-variant mt-0.5">{s.language === 'en' ? 'English' : s.language === 'fr' ? 'French' : s.language}</span>
                  </div>
                </div>
              ))}
              {sections.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">No sections yet. Create your first section (e.g., Anglophone, Francophone).</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateClass} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">Provision New Class</h3>

            <select required value={classForm.cycle} onChange={e => setClassForm({...classForm, cycle: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">Select Cycle...</option>
              {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select required value={classForm.stream} onChange={e => setClassForm({...classForm, stream: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">Select Section...</option>
              {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Class Name</label>
                <input required type="text" placeholder="e.g. Form 1 A" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Level Order (1-12)</label>
                <input required type="number" min="1" max="20" value={classForm.level_order} onChange={e => setClassForm({...classForm, level_order: parseInt(e.target.value)})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
            </div>

            <button disabled={!classForm.stream} type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> Deploy Class
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">Institutional Classes</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {classes.map((cl: any) => (
                <div key={cl.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{cl.name}</span>
                    <span className="block text-xs text-on-surface-variant">{cl.cycle_name || 'General'} • {cl.section_display || 'Local Section'} • Level {cl.level_order}</span>
                  </div>
                </div>
              ))}
              {classes.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">No classes yet. Create your first class to start enrolling students.</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'subjects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateSubject} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">Register Curriculum Subject</h3>

            <select required value={subjectForm.cycle} onChange={e => setSubjectForm({...subjectForm, cycle: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">Select Cycle...</option>
              {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Subject Name</label>
                <input required type="text" placeholder="e.g. Mathematics" value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">Subject Code</label>
                <input required type="text" placeholder="e.g. MAT01" value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold uppercase" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">Grading Coefficient</label>
              <input required type="number" step="0.1" min="0.5" value={subjectForm.default_coefficient} onChange={e => setSubjectForm({...subjectForm, default_coefficient: parseFloat(e.target.value)})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>

            <button type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> Finalize Subject
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">Active Master Curriculum</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {subjects.map((sub: any) => (
                <div key={sub.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold flex items-center gap-2">{sub.name} <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono text-[10px]">{sub.code}</span></span>
                    <span className="block text-xs text-on-surface-variant mt-1 font-bold tracking-widest uppercase">{sub.cycle_name || 'General'}</span>
                  </div>
                  <div className="text-center bg-secondary/10 p-2 rounded-lg">
                    <span className="block text-[10px] uppercase font-black text-secondary">Coeff</span>
                    <span className="font-bold text-secondary">{sub.default_coefficient}</span>
                  </div>
                </div>
              ))}
              {subjects.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">No subjects yet. Add your first subject to build the curriculum.</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
