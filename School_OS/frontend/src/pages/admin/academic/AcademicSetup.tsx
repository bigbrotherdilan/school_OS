import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { BookOpen, Calendar, CalendarDays, PlusCircle, LayoutDashboard, Globe, Layers, Trash2, Pencil, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AcademicSetup() {
  const { addToast } = useToastStore();
  const { t } = useTranslation('adminAcademicMgmt');
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
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', cycle: '', language: '', default_coefficient: 1.0 });
  const [sectionForm, setSectionForm] = useState({ name: '', section_type: 'grammar', language: 'en' });

  const [selectedSection, setSelectedSection] = useState('');
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([]);
  const [selectedForAssign, setSelectedForAssign] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [coeffDrafts, setCoeffDrafts] = useState<Record<number, string>>({});
  const [recommended, setRecommended] = useState<any[]>([]);
  const [applyingRecommendations, setApplyingRecommendations] = useState(false);
  const [recommendedClasses, setRecommendedClasses] = useState<any[]>([]);
  const [applyingClasses, setApplyingClasses] = useState(false);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [sectionEditForm, setSectionEditForm] = useState({ name: '', section_type: 'grammar', language: 'en' });
  const [creatingYear, setCreatingYear] = useState(false);
  const [editingTerm, setEditingTerm] = useState<number | null>(null);
  const [termEditForm, setTermEditForm] = useState({ name: '', start_date: '', end_date: '' });
  const [rolloverCutoff, setRolloverCutoff] = useState(10);
  const [rolloverPreview, setRolloverPreview] = useState<any>(null);
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [rolloverRunning, setRolloverRunning] = useState(false);

  const TERM_NAMES = ['First Term', 'Second Term', 'Third Term'];

  const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const suggestedYear = (years: any[]) => {
    const latest = [...years].sort(
      (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    )[0];
    if (latest) {
      const s = new Date(new Date(latest.start_date).getFullYear() + 1, 8, 1);
      const e = new Date(s.getFullYear() + 1, 7, 31);
      return { name: `${s.getFullYear()}/${e.getFullYear()}`, start_date: toISODate(s), end_date: toISODate(e) };
    }
    const startYear = new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0);
    const s = new Date(startYear, 8, 1);
    const e = new Date(startYear + 1, 7, 31);
    return { name: `${startYear}/${startYear + 1}`, start_date: toISODate(s), end_date: toISODate(e) };
  };

  const nextTermOrder = (yearId: string) => {
    const orders = terms
      .filter((t: any) => String(t.academic_year) === String(yearId))
      .map((t: any) => t.order_number)
      .sort((a: number, b: number) => a - b);
    for (let i = 1; i <= 3; i++) {
      if (!orders.includes(i)) return i;
    }
    return (orders[orders.length - 1] || 0) + 1;
  };

  const fetchData = async () => {
    if (!activeTenantId) {
      setLoading(false);
      addToast(t('No school selected. Please select a school from the sidebar first.'), "error");
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
      setYearForm(f => (f.name ? f : suggestedYear(years)));
    } catch (error) {
      console.error(error);
      addToast(t('Failed to sync configuration data.'), "error");
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
      addToast(t('Academic year created! Your school calendar is taking shape.'), "success");
      fetchData();
      setYearForm({ name: '', start_date: '', end_date: '' });
    } catch (error: any) {
      const data = error.response?.data;
      const status = error.response?.status;
      const msg = data?.detail || data?.error || (typeof data === 'string' ? t('Server error ({{status}})', { status }) : t('Failed to create Year'));
      addToast(msg, "error");
    }
  };

  const handleAutoYear = async () => {
    if (academicYears.some((y: any) => y.name === yearForm.name)) {
      addToast(t('Year "{{name}}" already exists.', { name: yearForm.name }), "error");
      return;
    }
    setCreatingYear(true);
    try {
      const yearRes = await api.post('/academic/academic-years/', yearForm);
      const yearId = yearRes.data.id;
      await Promise.all(
        TERM_NAMES.map((name, i) =>
          api.post('/academic/terms/', { academic_year: yearId, name, order_number: i + 1 })
        )
      );
      await api.post(`/academic/academic-years/${yearId}/set-active/`);
      addToast(t('School year {{name}} created with First, Second and Third Term.', { name: yearForm.name }), "success");
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to auto-setup school year'), "error");
    } finally {
      setCreatingYear(false);
    }
  };

  const handleAddStandardTerms = async (yearId: string, yearName: string) => {
    const existing = terms.filter((t: any) => String(t.academic_year) === String(yearId));
    if (existing.length >= 3) return;
    try {
      await Promise.all(
        TERM_NAMES.slice(existing.length).map((name, i) =>
          api.post('/academic/terms/', { academic_year: yearId, name, order_number: existing.length + i + 1 })
        )
      );
      addToast(t('Standard term(s) added to {{year}}.', { year: yearName }), "success");
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to add terms'), "error");
    }
  };

  const fetchRolloverPreview = async () => {
    setRolloverLoading(true);
    try {
      const res = await api.get('/students/students/rollover-preview/', { params: { cutoff: rolloverCutoff } });
      setRolloverPreview(res.data);
    } catch (error: any) {
      addToast(error.response?.data?.error || error.response?.data?.detail || t('Failed to load rollover preview'), "error");
      setRolloverPreview(null);
    } finally {
      setRolloverLoading(false);
    }
  };

  const runRollover = async () => {
    if (!rolloverPreview) return;
    const totals = rolloverPreview.totals;
    if (!window.confirm(
      t('Run end-of-year rollover for {{year}}?', { year: rolloverPreview.year.name }) + '\n\n' +
      t('{{count}} student(s) move up a class', { count: totals.promoted }) + '\n' +
      t('{{count}} student(s) graduate', { count: totals.graduating }) + '\n' +
      t('{{count}} student(s) repeat', { count: totals.repeating }) + '\n\n' +
      t('{{year}} will be created with its 3 terms and become the active year.', { year: rolloverPreview.next_year_name }) + '\n\n' +
      t('This runs once per year and cannot be redone from the app.')
    )) return;
    setRolloverRunning(true);
    try {
      const res = await api.post('/students/students/rollover/', { cutoff: rolloverCutoff });
      addToast(res.data?.message || t('Rollover complete.'), "success");
      setRolloverPreview(null);
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.error || error.response?.data?.detail || t('Rollover failed'), "error");
    } finally {
      setRolloverRunning(false);
    }
  };

  const handleTermYearChange = (yearId: string) => {
    const order = nextTermOrder(yearId);
    setTermForm({ academic_year: yearId, name: TERM_NAMES[order - 1] || `Term ${order}`, order_number: order });
  };

  const startEditTerm = (t: any) => {
    setEditingTerm(t.id);
    setTermEditForm({ name: t.name, start_date: t.start_date || '', end_date: t.end_date || '' });
  };

  const handleUpdateTerm = async (termId: number) => {
    try {
      const payload: any = { name: termEditForm.name };
      if (termEditForm.start_date) payload.start_date = termEditForm.start_date;
      if (termEditForm.end_date) payload.end_date = termEditForm.end_date;
      await api.patch(`/academic/terms/${termId}/`, payload);
      addToast(t('Term updated.'), "success");
      setEditingTerm(null);
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to update term'), "error");
    }
  };

  const handleDeleteTerm = async (termId: number, name: string) => {
    if (!window.confirm(
      t('Delete "{{name}}" permanently?', { name }) + '\n\n' +
      t("This also removes the term's exams and all student marks for that term.") + '\n\n' +
      t('This cannot be undone.')
    )) return;
    try {
      await api.delete(`/academic/terms/${termId}/`);
      addToast(t('Term deleted.'), "success");
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to delete term'), "error");
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/terms/', termForm);
      addToast(t('Term added. Students and teachers can now plan ahead.'), "success");
      fetchData();
      setTermForm(prev => {
        const order = prev.order_number + 1;
        return { academic_year: prev.academic_year, name: TERM_NAMES[order - 1] || `Term ${order}`, order_number: order };
      });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to create Term'), "error");
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/classes/', classForm);
      addToast(t('Class created! Ready to enroll students.'), "success");
      fetchData();
      setClassForm({ ...classForm, name: '' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to create Class'), "error");
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/subjects/', subjectForm);
      addToast(t('Subject added to your curriculum.'), "success");
      fetchData();
      setSubjectForm({ ...subjectForm, name: '', code: '' });    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to create Subject'), "error");
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academic/sections/', sectionForm);
      addToast(t('Section created! You can now assign classes to it.'), "success");
      fetchData();
      setSectionForm({ name: '', section_type: 'grammar', language: 'en' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to create Section'), "error");
    }
  };

  const applySectionTemplate = (name: string, language: string, section_type: string) => {
    setSectionForm({ name, section_type, language });
  };

  const startEditSection = (s: any) => {
    setEditingSection(s.id);
    setSectionEditForm({ name: s.name, section_type: s.section_type || 'grammar', language: s.language || 'en' });
  };

  const handleUpdateSection = async (sectionId: number) => {
    try {
      await api.patch(`/academic/sections/${sectionId}/`, sectionEditForm);
      addToast(t('Section updated.'), "success");
      setEditingSection(null);
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to update section'), "error");
    }
  };

  const handleDeleteSection = async (sectionId: number, name: string) => {
    try {
      const classCount = classes.filter((c) => c.stream === sectionId).length;
      const studentRes = await api.get('/students/students/', { params: { stream: sectionId } });
      const studentCount = studentRes.data?.count ?? (studentRes.data?.results || studentRes.data || []).length;
      if (studentCount > 0) {
        addToast(t('Cannot delete "{{name}}": {{count}} enrolled student(s) still belong to this section. Move or delete them first.', { name, count: studentCount }), "error");
        return;
      }
      if (!window.confirm(
        t('Delete section "{{name}}" permanently?', { name }) + '\n\n' +
        t('This deletes:') + '\n' +
        t('{{count}} class(es) and all their subject links', { count: classCount }) + '\n' +
        t('Subject assignments for this section') + '\n' +
        t('Series belonging to this section') + '\n\n' +
        t('This cannot be undone.')
      )) return;
      await api.delete(`/academic/sections/${sectionId}/`);
      addToast(t('Section deleted.'), "success");
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to delete section'), "error");
    }
  };

  const loadSectionSubjects = async (sectionId: string) => {
    if (!sectionId) {
      setSectionSubjects([]);
      return;
    }
    try {
      const res = await api.get('/academic/section-subjects/', { params: { section: sectionId } });
      setSectionSubjects(res.data.results || res.data);
    } catch {
      addToast(t('Failed to load subjects for this section.'), "error");
    }
  };

  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      setSelectedSection(String(sections[0].id));
    }
  }, [sections, selectedSection]);

  useEffect(() => {
    loadSectionSubjects(selectedSection);
  }, [selectedSection]);

  useEffect(() => {
    if (!selectedSection) {
      setRecommended([]);
      return;
    }
    api.get('/academic/subjects/recommended/', { params: { section: selectedSection } })
      .then((res) => setRecommended(res.data?.items ?? []))
      .catch(() => setRecommended([]));
    api.get('/academic/classes/recommended/', { params: { section: selectedSection } })
      .then((res) => setRecommendedClasses(res.data?.items ?? []))
      .catch(() => setRecommendedClasses([]));
  }, [selectedSection, sectionSubjects.length]);

  const handleApplyRecommendations = async () => {
    if (!selectedSection) return;
    setApplyingRecommendations(true);
    try {
      const res = await api.post('/academic/subjects/apply-recommendations/', { section: selectedSection });
      addToast(res.data?.detail || t('Recommended subjects added.'), "success");
      fetchData();
      await loadSectionSubjects(selectedSection);
      const recRes = await api.get('/academic/subjects/recommended/', { params: { section: selectedSection } });
      setRecommended(recRes.data?.items ?? []);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to apply recommendations'), "error");
    } finally {
      setApplyingRecommendations(false);
    }
  };

  const handleApplyClasses = async () => {
    if (!selectedSection) return;
    setApplyingClasses(true);
    try {
      const res = await api.post('/academic/classes/apply-recommendations/', { section: selectedSection });
      addToast(res.data?.detail || t('Recommended classes added.'), "success");
      fetchData();
      const recRes = await api.get('/academic/classes/recommended/', { params: { section: selectedSection } });
      setRecommendedClasses(recRes.data?.items ?? []);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to apply classes'), "error");
    } finally {
      setApplyingClasses(false);
    }
  };

  useEffect(() => {
    if (!loading && sections.length === 0 && activeTab !== 'sections') {
      setActiveTab('sections');
    }
  }, [loading, sections.length, activeTab]);

  const toggleForAssign = (id: number) => {
    setSelectedForAssign(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const setDraft = (id: number, value: string) => {
    setCoeffDrafts(d => ({ ...d, [id]: value }));
  };

  const handleAssignSubjects = async () => {
    if (!selectedSection || selectedForAssign.length === 0) return;
    setAssigning(true);
    try {
      const res = await api.post('/academic/section-subjects/bulk/', {
        section: selectedSection,
        subject_ids: selectedForAssign,
      });
      addToast(res.data?.detail || t('Subjects assigned to section.'), "success");
      setSelectedForAssign([]);
      loadSectionSubjects(selectedSection);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to assign subjects'), "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateCoefficient = async (linkId: number) => {
    const raw = coeffDrafts[linkId];
    const coefficient = parseFloat(raw);
    if (raw === undefined || isNaN(coefficient) || coefficient <= 0) {
      addToast(t('Enter a valid coefficient.'), "error");
      return;
    }
    try {
      await api.patch(`/academic/section-subjects/${linkId}/`, { coefficient });
      addToast(t('Coefficient updated.'), "success");
      setCoeffDrafts(d => {
        const rest = { ...d };
        delete rest[linkId];
        return rest;
      });
      loadSectionSubjects(selectedSection);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to update coefficient'), "error");
    }
  };

  const handleRemoveSectionSubject = async (linkId: number) => {
    try {
      await api.delete(`/academic/section-subjects/${linkId}/`);
      addToast(t('Subject removed from section.'), "success");
      loadSectionSubjects(selectedSection);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || t('Failed to remove subject'), "error");
    }
  };

  const selectedSectionObj = sections.find((s: any) => String(s.id) === selectedSection);

  const unassignedSubjects = subjects.filter(
    (s: any) =>
      !sectionSubjects.some((ss: any) => ss.subject === s.id) &&
      (!s.language || !selectedSectionObj || s.language === selectedSectionObj.language)
  );

  const activeYear = academicYears.find((y: any) => y.is_active);

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <LayoutDashboard className="w-4 h-4" /> {t('Overview Dashboard')}
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 block mb-3">{t('Academic Base Configuration')}</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">{t('Institutional Setup')}</h1>
        <p className="text-on-surface-variant mt-2 text-lg">{t('Define foundational academic structures: Years, Terms, Cycles, Classes, and Curriculum.')}</p>
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
            {t(tab.label)}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12"><span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>}

      {!loading && !activeTenantId && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-7xl mb-4 block">domain_disabled</span>
          <h2 className="text-2xl font-bold text-primary mb-2">{t('No School Selected')}</h2>
          <p className="text-on-surface-variant">{t('Select a school from the sidebar before configuring academic settings.')}</p>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'years' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border-2 border-primary/20 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold">{t('End-of-Year Rollover')}</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  {t('Finish the school year in one click: students move to their next class, the final class graduates, and the next year opens with all 3 terms.')}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
            </div>

            {!activeYear ? (
              <p className="text-sm text-warning bg-warning-container/30 border border-warning/10 rounded-xl px-4 py-3">
                {t('No active academic year yet. Create one above, then come back here at the end of the year.')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-on-surface-variant block mb-1">{t('Closing year')}</label>
                    <span className="font-black text-lg">{activeYear.name}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-on-surface-variant block mb-1">{t('Promotion Average (minimum /20)')}</label>
                    <div className="flex gap-2">
                      <input type="number" step="0.5" min="0" max="20" value={rolloverCutoff}
                        onChange={e => setRolloverCutoff(parseFloat(e.target.value))}
                        className="bg-surface-container-highest rounded-xl px-4 py-2.5 text-sm font-bold w-28" />
                      <button onClick={fetchRolloverPreview} disabled={rolloverLoading} type="button"
                        className="bg-surface-container text-on-surface-variant px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface-container-high transition-colors disabled:opacity-50">
                        {rolloverLoading ? t('Loading...') : t('Preview')}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  {t('The promotion average is the')} <strong>{t('annual average')}</strong> {t('— the mean of the three term averages (each term average is the coefficient-weighted average of that term\'s sequence marks). The official Cameroon passage standard is 10/20.')}
                </p>

                {rolloverPreview && (
                  <div className="mt-5 border-t border-outline-variant/10 pt-5">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="bg-success/10 text-success px-3 py-1 rounded-full text-[11px] font-black uppercase">{t('{{count}} move up', { count: rolloverPreview.totals.promoted })}</span>
                      <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-[11px] font-black uppercase">{t('{{count}} graduate', { count: rolloverPreview.totals.graduating })}</span>
                      <span className="bg-warning/10 text-warning px-3 py-1 rounded-full text-[11px] font-black uppercase">{t('{{count}} repeat', { count: rolloverPreview.totals.repeating })}</span>
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[11px] font-black uppercase">{t('{{count}} students', { count: rolloverPreview.totals.total })}</span>
                    </div>
                    <div className="space-y-2 mb-5">
                      {rolloverPreview.per_class.map((c: any) => (
                        <div key={c.class_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-bold">{c.section_name} • {c.class_name}</span>
                          <span className="text-on-surface-variant">
                            {c.promoted > 0 && t('{{count}} to next class', { count: c.promoted })}
                            {c.promoted > 0 && c.graduating > 0 && ', '}
                            {c.graduating > 0 && t('{{count}} graduate', { count: c.graduating })}
                            {c.repeating > 0 && `, ${t('{{count}} repeat', { count: c.repeating })}`}
                          </span>
                        </div>
                      ))}
                      {rolloverPreview.totals.with_marks < rolloverPreview.totals.total && (
                        <p className="text-xs text-warning">
                          {t('{{count}} student(s) have no marks this year and will stay in their class.', { count: rolloverPreview.totals.total - rolloverPreview.totals.with_marks })}
                        </p>
                      )}
                    </div>
                    <button onClick={runRollover} disabled={rolloverRunning} type="button"
                      className="flex items-center justify-center gap-2 bg-primary text-white py-3 px-8 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-primary/90 transition-colors">
                      <span className="material-symbols-outlined text-base">rocket_launch</span>
                      {rolloverRunning ? t('Rolling over...') : t('Run Rollover — Start {{year}}', { year: rolloverPreview.next_year_name })}
                    </button>
                    <p className="text-xs text-on-surface-variant mt-2">
                      {t('Creates {{year}} with its 3 terms, activates it, moves students to the next class, and graduates the final level. Runs once per year.', { year: rolloverPreview.next_year_name })}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <form onSubmit={handleCreateYear} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">{t('Open New Academic Year')}</h3>
            <p className="text-sm text-on-surface-variant">
              {t('School years run from September to August (e.g. 2026/2027). We already filled in the next year for you — the easiest option is the one-click button below.')}
            </p>
            <button type="button" onClick={handleAutoYear} disabled={creatingYear} className="flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm disabled:opacity-50">
              <Sparkles className="w-5 h-5" /> {creatingYear ? t('Setting up...') : t('Auto-create {{year}} + 3 Terms', { year: yearForm.name || t('next year') })}
            </button>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Year Name')}</label>
                <input required type="text" placeholder={t('e.g. 2026-2027')} value={yearForm.name} onChange={e => setYearForm({...yearForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Starts')}</label>
                <input required type="date" value={yearForm.start_date} onChange={e => setYearForm({...yearForm, start_date: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Ends')}</label>
                <input required type="date" value={yearForm.end_date} onChange={e => setYearForm({...yearForm, end_date: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold mt-1" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full border-2 border-primary/30 text-primary py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-primary/5 transition-colors">
                  {t('Just Create the Year')}
                </button>
              </div>
            </div>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">{t('Registered Years')}</h3>
            <div className="space-y-3">
              {academicYears.map((yr: any) => (
                <div key={yr.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <span className="font-bold text-lg">{yr.name}</span>
                      <span className="block text-xs text-on-surface-variant">{t('{{start}} to {{end}}', { start: yr.start_date, end: yr.end_date })}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase ${(yr.terms?.length || 0) >= 3 ? 'bg-secondary/10 text-secondary' : ''}`}>
                        {t('{{count}}/3 terms', { count: yr.terms?.length || 0 })}
                      </span>
                      {yr.is_active && <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">{t('Active')}</span>}
                    </div>
                  </div>
                  {(yr.terms?.length || 0) < 3 && (
                    <button onClick={() => handleAddStandardTerms(yr.id, yr.name)} type="button" className="mt-3 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg px-3 py-2 transition-colors">
                      {t('+ Add standard term(s) ({{count}} missing)', { count: 3 - (yr.terms?.length || 0) })}
                    </button>
                  )}
                </div>
              ))}
              {academicYears.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">{t('No academic years yet. Use the one-click button to create {{name}} with all 3 terms.', { name: suggestedYear([]).name })}</p>}
            </div>
          </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'terms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <form onSubmit={handleCreateTerm} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">{t('Define Term')}</h3>
            <p className="text-sm text-on-surface-variant">{t('Each year has 3 terms. Pick the year — we number the terms for you automatically.')}</p>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Academic Year')}</label>
              <select required value={termForm.academic_year} onChange={e => handleTermYearChange(e.target.value)} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                <option value="">{t('Select Target Year...')}</option>
                {academicYears.map((yr: any) => <option key={yr.id} value={yr.id}>{yr.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Term Name')}</label>
              <input required type="text" placeholder={t('e.g. First Term')} value={termForm.name} onChange={e => setTermForm({...termForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              {termForm.academic_year && (
                <p className="text-xs text-on-surface-variant">{t('Will be saved as')} <strong>{t('Term {{order}} of 3', { order: termForm.order_number })}</strong> {t('for this year.')}</p>
              )}
            </div>

            <button disabled={!termForm.academic_year || nextTermOrder(termForm.academic_year) > 3} type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> {t('Save Term')}
            </button>
            {termForm.academic_year && nextTermOrder(termForm.academic_year) > 3 && (
              <p className="text-xs text-red-500 text-center font-bold">{t('This year already has 3 terms. Create a new year or add terms there.')}</p>
            )}
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">{t('Established Terms')}</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {terms.map((term: any) => (
                <div key={term.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  {editingTerm === term.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input type="text" value={termEditForm.name} onChange={e => setTermEditForm({...termEditForm, name: e.target.value})} className="flex-1 bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold" />
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase whitespace-nowrap">{t('{{order}} of 3', { order: term.order_number })}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Start Date')}</label>
                          <input type="date" value={termEditForm.start_date} onChange={e => setTermEditForm({...termEditForm, start_date: e.target.value})} className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('End Date')}</label>
                          <input type="date" value={termEditForm.end_date} onChange={e => setTermEditForm({...termEditForm, end_date: e.target.value})} className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateTerm(term.id)} type="button" className="flex-1 bg-primary text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest">{t('Save')}</button>
                        <button onClick={() => setEditingTerm(null)} type="button" className="flex-1 bg-surface-container text-on-surface-variant py-2 rounded-lg text-xs font-black uppercase tracking-widest">{t('Cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">{term.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">{t('{{order}} of 3', { order: term.order_number })}</span>
                          <button onClick={() => startEditTerm(term)} title={t('Edit term')} className="text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTerm(term.id, term.name)} title={t('Delete term')} className="text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-on-surface-variant">{academicYears.find((y: any) => y.id === term.academic_year)?.name || t('Unknown year')}</div>
                      {term.start_date && <div className="text-xs text-on-surface-variant">{t('{{start}} to {{end}}', { start: term.start_date, end: term.end_date || t('TBD') })}</div>}
                    </>
                  )}
                </div>
              ))}
              {terms.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">{t('No terms yet. Pick a year and save your first term.')}</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'sections' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {sections.length === 0 && (
            <div className="bg-gradient-to-r from-primary to-secondary p-8 rounded-2xl shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80 block mb-3">{t('First Step — Required')}</span>
              <h3 className="text-2xl font-black text-white mb-2">{t("Welcome! Let's set up your school structure.")}</h3>
              <p className="text-white/90 max-w-2xl leading-relaxed">
                {t('Every school must have at least one')} <strong>{t('section')}</strong> {t('before anything else can work — classes, subjects, students, timetables, and report cards all hang off a section. Create your first section below (e.g. Grammar, Francophone, Technical, Commercial). After that, the curriculum for that section becomes available automatically.')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <form onSubmit={handleCreateSection} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">{sections.length === 0 ? t('Create Your First Section') : t('Add New Section')}</h3>
            <p className="text-sm text-on-surface-variant">{t('Sections group classes by type. Pick a template or name your own.')}</p>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Quick Templates')}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Grammar', language: 'en', section_type: 'grammar' },
                  { name: 'Francophone', language: 'fr', section_type: 'grammar' },
                  { name: 'Technical (English)', language: 'en', section_type: 'technical' },
                  { name: 'Technical (French)', language: 'fr', section_type: 'technical' },
                  { name: 'Commercial (English)', language: 'en', section_type: 'commercial' },
                  { name: 'Commercial (French)', language: 'fr', section_type: 'commercial' },
                ].map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => applySectionTemplate(tpl.name, tpl.language, tpl.section_type)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors ${sectionForm.name === tpl.name ? 'bg-primary text-white border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:border-primary/40 hover:text-primary'}`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Section Name')}</label>
              <input required type="text" placeholder={t('e.g. Grammar, Technical, Commercial')} value={sectionForm.name} onChange={e => setSectionForm({...sectionForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Section Type')}</label>
              <p className="text-xs text-on-surface-variant">{t("Decides which curriculum (subjects) is auto-linked to the section's classes.")}</p>
              <select value={sectionForm.section_type} onChange={e => setSectionForm({...sectionForm, section_type: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                <option value="grammar">{t('Grammar (general academic)')}</option>
                <option value="technical">{t('Technical')}</option>
                <option value="commercial">{t('Commercial')}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Primary Language')}</label>
              <p className="text-xs text-on-surface-variant">{t('This decides which Cameroon national curriculum (subjects + classes) is recommended for the section.')}</p>
              <select value={sectionForm.language} onChange={e => setSectionForm({...sectionForm, language: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                <option value="en">{t('English (GCE curriculum)')}</option>
                <option value="fr">{t('French (Francophone — MINESEC curriculum)')}</option>
                <option value="de">{t('German')}</option>
              </select>
            </div>

            <button type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
              <PlusCircle className="w-4 h-4" /> {t('Create Section')}
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">{t('Existing Sections')}</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {sections.map((s: any) => (
                <div key={s.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  {editingSection === s.id ? (
                    <div className="space-y-3">
                      <input type="text" value={sectionEditForm.name} onChange={e => setSectionEditForm({...sectionEditForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold" />
                      <select value={sectionEditForm.section_type} onChange={e => setSectionEditForm({...sectionEditForm, section_type: e.target.value})} className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold">
                        <option value="grammar">{t('Grammar (general academic)')}</option>
                        <option value="technical">{t('Technical')}</option>
                        <option value="commercial">{t('Commercial')}</option>
                      </select>
                      <select value={sectionEditForm.language} onChange={e => setSectionEditForm({...sectionEditForm, language: e.target.value})} className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold">
                        <option value="en">{t('English')}</option>
                        <option value="fr">{t('French')}</option>
                        <option value="de">{t('German')}</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateSection(s.id)} type="button" className="flex-1 bg-primary text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest">{t('Save')}</button>
                        <button onClick={() => setEditingSection(null)} type="button" className="flex-1 bg-surface-container text-on-surface-variant py-2 rounded-lg text-xs font-black uppercase tracking-widest">{t('Cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <span className="font-bold">{s.name}</span>
                        <span className="block text-xs text-on-surface-variant mt-0.5">{s.language === 'en' ? 'English' : s.language === 'fr' ? 'French' : s.language} • {(s.section_type || 'grammar').charAt(0).toUpperCase() + (s.section_type || 'grammar').slice(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => startEditSection(s)} title={t('Edit section')} className="text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg p-2 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteSection(s.id, s.name)} title={t('Delete section')} className="text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sections.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">{t('No sections yet. Create your first section (e.g., Grammar, Francophone).')}</p>}
            </div>
          </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'classes' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
            <h3 className="text-xl font-bold mb-2">{t('Recommended Class Structure')}</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              {t('Each section type follows the official Cameroon class ladder — Grammar: Form 1 to Upper Sixth • Francophone: 6ème to Terminale. Pick a section and add its standard classes with one click.')}
            </p>
<select required value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">{t('Select Section...')}</option>
              {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {selectedSection && recommendedClasses.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {recommendedClasses.map((c: any) => (
                    <span key={c.name} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.already_exists ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}>
                      {c.name}{c.already_exists ? ' ✓' : ''}
                    </span>
                  ))}
                </div>
                <button disabled={applyingClasses || recommendedClasses.filter((c: any) => !c.already_exists).length === 0} onClick={handleApplyClasses} type="button" className="w-full sm:w-auto flex items-center justify-center gap-2 border-2 border-primary/30 text-primary py-2.5 px-6 rounded-xl font-black uppercase tracking-widest text-[11px] hover:bg-primary/5 disabled:opacity-40 transition-colors">
                  <span className="material-symbols-outlined text-base">auto_awesome</span> {t('One-click: Add Recommended Classes')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <form onSubmit={handleCreateClass} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
            <h3 className="text-xl font-bold">{t('Provision New Class')}</h3>

            <select required value={classForm.cycle} onChange={e => setClassForm({...classForm, cycle: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">{t('Select Cycle...')}</option>
              {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select required value={classForm.stream} onChange={e => { setClassForm({...classForm, stream: e.target.value}); setSelectedSection(e.target.value); }} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">{t('Select Section...')}</option>
              {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Class Name')}</label>
                <input required type="text" placeholder={t('e.g. Form 1 A')} value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Level Order (1-12)')}</label>
                <input required type="number" min="1" max="20" value={classForm.level_order} onChange={e => setClassForm({...classForm, level_order: parseInt(e.target.value)})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
            </div>

            <button disabled={!classForm.stream} type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> {t('Deploy Class')}
            </button>
          </form>

          <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
            <h3 className="text-xl font-bold mb-6">{t('Institutional Classes')}</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {classes.map((cl: any) => (
                <div key={cl.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{cl.name}</span>
                    <span className="block text-xs text-on-surface-variant">{t('{{cycle}} • {{section}} • Level {{level}}', { cycle: cl.cycle_name || t('General'), section: cl.section_display || t('Local Section'), level: cl.level_order })}</span>
                  </div>
                </div>
              ))}
              {classes.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">{t('No classes yet. Create your first class to start enrolling students.')}</p>}
            </div>
          </div>
          </div>
        </div>
      )}

      {!loading && activeTenantId && activeTab === 'subjects' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
            <h3 className="text-xl font-bold mb-2">{t('Section Curriculum')}</h3>
            <p className="text-sm text-on-surface-variant mb-4">{t('Subjects belong to sections. Pick a section, assign subjects from the master list, then tune each coefficient.')}</p>
            <select required value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
              <option value="">{t('Select Section...')}</option>
              {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {selectedSection && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
                <h3 className="text-lg font-bold mb-1">{t('Assign Subjects')}</h3>
                <p className="text-xs text-on-surface-variant mb-4">{t('Pick from the master curriculum. Subjects already in this section are hidden.')}</p>
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2 mb-4">
                  {unassignedSubjects.map((sub: any) => (
                    <label key={sub.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedForAssign.includes(sub.id) ? 'bg-primary/10 border-primary' : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-high'}`}>
                      <input type="checkbox" checked={selectedForAssign.includes(sub.id)} onChange={() => toggleForAssign(sub.id)} className="w-4 h-4 accent-primary" />
                      <span className="flex-1">
                        <span className="font-bold block text-sm">{sub.name} <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono text-[10px]">{sub.code}</span></span>
                        <span className="block text-xs text-on-surface-variant">{sub.language === 'fr' ? 'French (MINESEC) • ' : sub.language === 'en' ? 'English (GCE) • ' : ''}{sub.cycle_name || t('General')} • {t('default coeff {{coeff}}', { coeff: sub.default_coefficient })}</span>
                      </span>
                    </label>
                  ))}
                  {unassignedSubjects.length === 0 && <p className="text-on-surface-variant text-sm text-center py-6 font-medium">{t('All master subjects are already assigned to this section. Create a new subject below if needed.')}</p>}
                </div>
                <button disabled={selectedForAssign.length === 0 || assigning} onClick={handleAssignSubjects} type="button" className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
                  <PlusCircle className="w-4 h-4" /> {t('Assign')} {selectedForAssign.length > 0 ? `(${selectedForAssign.length}) ` : ''}{t('to Section')}
                </button>

                <div className="mt-5 border-t border-outline-variant/10 pt-5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-1">{t('Cameroon National Curriculum')}</h4>
                  {(() => {
                    const sec = sections.find((s: any) => String(s.id) === selectedSection);
                    const lang = sec?.language === 'fr' ? 'French (MINESEC)' : 'English (GCE)';
                    const typeLabel = sec?.section_type === 'technical' ? 'Technical' : sec?.section_type === 'commercial' ? 'Commercial' : 'General';
                    return (
                      <p className="text-xs text-on-surface-variant mb-3">
                        {t('Recommended subjects for this section —')} <strong className="text-on-surface">{lang}</strong> • <strong className="text-on-surface">{typeLabel}</strong>
                        {recommended.length > 0 && t(': {{available}} available, {{assigned}} already assigned.', { available: recommended.filter(r => !r.already_assigned).length, assigned: recommended.filter(r => r.already_assigned).length })}
                      </p>
                    );
                  })()}
                  {recommended.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {recommended.slice(0, 12).map((r: any) => (
                        <span key={r.code} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${r.already_assigned ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}>
                          {r.name}{r.already_assigned ? ' ✓' : ''}
                        </span>
                      ))}
                      {recommended.length > 12 && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/20">+{recommended.length - 12} more</span>}
                    </div>
                  )}
                  <button disabled={applyingRecommendations || recommended.filter(r => !r.already_assigned).length === 0} onClick={handleApplyRecommendations} type="button" className="w-full flex items-center justify-center gap-2 border-2 border-primary/30 text-primary py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:bg-primary/5 disabled:opacity-40 transition-colors">
                    <span className="material-symbols-outlined text-base">auto_awesome</span> {t('One-click: Add Recommended Subjects')}
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
                <h3 className="text-lg font-bold mb-1">{t('Curriculum for {{section}}', { section: sections.find((s: any) => String(s.id) === selectedSection)?.name || t('Section') })}</h3>
                <p className="text-xs text-on-surface-variant mb-4">{t('Edit the coefficient for each subject in this section.')}</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {sectionSubjects.map((link: any) => (
                    <div key={link.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                      <div className="flex justify-between items-center gap-3 mb-2">
                        <div>
                          <span className="font-bold flex items-center gap-2 text-sm">{link.subject_name} <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono text-[10px]">{link.subject_code}</span></span>
                          <span className="block text-xs text-on-surface-variant">{link.cycle_name || t('General')} • {t('default {{coeff}}', { coeff: link.default_coefficient })}</span>
                        </div>
                        <button onClick={() => handleRemoveSectionSubject(link.id)} title={t('Remove from section')} className="text-red-500 hover:bg-red-50 rounded-lg p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Coeff')}</label>
                        <input type="number" step="0.1" min="0.5" value={coeffDrafts[link.id] ?? link.coefficient} onChange={e => setDraft(link.id, e.target.value)} className="w-24 bg-surface-container-highest rounded-lg px-3 py-2 text-sm font-bold" />
                        <button onClick={() => handleUpdateCoefficient(link.id)} type="button" className="ml-auto text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg px-3 py-2">
                          {t('Save')}
                        </button>
                      </div>
                    </div>
                  ))}
                  {sectionSubjects.length === 0 && <p className="text-on-surface-variant text-sm text-center py-6 font-medium">{t('No subjects assigned to this section yet. Assign from the list on the left.')}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <form onSubmit={handleCreateSubject} className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-6 flex flex-col">
              <h3 className="text-xl font-bold">{t('Register Master Subject')}</h3>
              <p className="text-sm text-on-surface-variant">{t('Master subjects feed the section picker. Create once, assign to many sections.')}</p>

              <select required value={subjectForm.cycle} onChange={e => setSubjectForm({...subjectForm, cycle: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
<option value="">{t('Select Cycle...')}</option>
                {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select value={subjectForm.language} onChange={e => setSubjectForm({...subjectForm, language: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold">
                <option value="">{t('Shared / Both subsystems')}</option>
                <option value="en">{t('English (GCE)')}</option>
                <option value="fr">{t('French (MINESEC)')}</option>
              </select>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Subject Name')}</label>
                  <input required type="text" placeholder={t('e.g. Mathematics')} value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Subject Code')}</label>
                  <input required type="text" placeholder={t('e.g. MAT01')} value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold uppercase" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-on-surface-variant">{t('Default Grading Coefficient')}</label>
                <input required type="number" step="0.1" min="0.5" value={subjectForm.default_coefficient} onChange={e => setSubjectForm({...subjectForm, default_coefficient: parseFloat(e.target.value)})} className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold" />
              </div>

              <button type="submit" className="mt-4 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-50">
                <PlusCircle className="w-4 h-4" /> {t('Finalize Subject')}
              </button>
            </form>

            <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10">
              <h3 className="text-xl font-bold mb-6">{t('Active Master Curriculum')}</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {subjects.map((sub: any) => (
                  <div key={sub.id} className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/10 flex justify-between items-center">
                    <div>
                      <span className="font-bold flex items-center gap-2">{sub.name} <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono text-[10px]">{sub.code}</span></span>
                      <span className="block text-xs text-on-surface-variant mt-1 font-bold tracking-widest uppercase">{sub.language === 'fr' ? 'FRENCH • ' : sub.language === 'en' ? 'ENGLISH • ' : 'SHARED • '}{sub.cycle_name || t('General')}</span>
                    </div>
                    <div className="text-center bg-secondary/10 p-2 rounded-lg">
                      <span className="block text-[10px] uppercase font-black text-secondary">{t('Coeff')}</span>
                      <span className="font-bold text-secondary">{sub.default_coefficient}</span>
                    </div>
                  </div>
                ))}
                {subjects.length === 0 && <p className="text-on-surface-variant text-sm text-center py-4 font-medium">{t('No subjects yet. Add your first subject to build the curriculum.')}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
