import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';
import { ArrowLeft, Trash2, Pencil, CalendarDays, PlusCircle, Sparkles, Lock, Unlock, AlertTriangle, CheckCircle2, Wand2, CalendarRange, LayoutGrid, BookOpen, GraduationCap, Clock, Shield, ClipboardCheck, Globe } from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const DEFAULT_PERIODS = [
  { start: '07:30', end: '08:20' },
  { start: '08:20', end: '09:10' },
  { start: '09:10', end: '10:00' },
  { start: '10:30', end: '11:20' },
  { start: '11:20', end: '12:10' },
  { start: '12:10', end: '13:00' },
  { start: '13:40', end: '14:30' },
  { start: '14:30', end: '15:20' },
  { start: '15:20', end: '16:10' },
];

const PALETTE = [
  ['#dbeafe', '#1d4ed8'],
  ['#dcfce7', '#15803d'],
  ['#fef9c3', '#a16207'],
  ['#fce7f3', '#be185d'],
  ['#ede9fe', '#6d28d9'],
  ['#ffedd5', '#c2410c'],
  ['#cffafe', '#0e7490'],
  ['#fee2e2', '#b91c1c'],
  ['#f1f5f9', '#334155'],
];

const EMPTY_SLOT_FORM = {
  id: null as number | null,
  day_of_week: 1,
  start_time: '07:30',
  end_time: '08:20',
  subject: '',
  teacher: '',
  classroom: '',
  is_locked: false,
};

const EMPTY_LESSON_FORM = {
  id: null as string | null,
  subject: '',
  teacher: '',
  periods_per_week: 1,
  is_double: false,
  note: '',
};

const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20';

const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const minToTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type WeekForm = {
  start: string;
  periodLen: number;
  count: number;
  breaks: { time: string; len: number }[];
  days: string[];
};

const DEFAULT_WEEK: WeekForm = {
  start: '07:30',
  periodLen: 50,
  count: 9,
  breaks: [
    { time: '10:00', len: 30 },
    { time: '13:00', len: 40 },
  ],
  days: ['1', '2', '3', '4', '5'],
};

const buildPeriods = (wf: WeekForm) => {
  let cur = timeToMin(wf.start);
  const out: { start: string; end: string }[] = [];
  for (let i = 0; i < wf.count; i++) {
    const end = cur + wf.periodLen;
    out.push({ start: minToTime(cur), end: minToTime(end) });
    cur = end;
    const br = wf.breaks.find((b) => timeToMin(b.time) === end);
    if (br) cur = end + br.len;
  }
  return out;
};

const weekFromTimetable = (tt: any): WeekForm => {
  const periods = tt?.periods?.length ? tt.periods : DEFAULT_PERIODS;
  const days = tt?.working_days?.length ? [...tt.working_days].sort() : [1, 2, 3, 4, 5];
  const start = periods[0]?.start || '07:30';
  const len = timeToMin(periods[0]?.end || '08:20') - timeToMin(start);
  const breaks: { time: string; len: number }[] = [];
  for (let i = 0; i < periods.length - 1; i++) {
    const gap = timeToMin(periods[i + 1].start) - timeToMin(periods[i].end);
    if (gap > 0) breaks.push({ time: periods[i].end, len: gap });
  }
  return { start, periodLen: Math.max(1, len), count: periods.length, breaks, days: days.map(String) };
};

export default function Timetables() {
  const { addToast } = useToastStore();
  const { activeSectionId } = useSectionStore();

  const [timetables, setTimetables] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'grid' | 'lessons'>('grid');

  const [workspaceSection, setWorkspaceSection] = useState<string | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsSubjects, setWsSubjects] = useState<Record<string, any[]>>({});

  const [showModal, setShowModal] = useState(false);
  const [createForm, setCreateForm] = useState({ classId: '', termId: '' });
  const [saving, setSaving] = useState(false);

  const [cellModal, setCellModal] = useState<null | { day: number; periodIndex: number }>(null);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM);
  const [savingSlot, setSavingSlot] = useState(false);

  const [hoursSaving, setHoursSaving] = useState<Record<string, boolean>>({});

  const [suggesting, setSuggesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState<any[] | null>(null);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);

  const [generatingSchool, setGeneratingSchool] = useState(false);
  const [generatingSection, setGeneratingSection] = useState(false);
  const [schoolResult, setSchoolResult] = useState<any>(null);

  const [sectionSummary, setSectionSummary] = useState<any>(null);
  const [sectionChecks, setSectionChecks] = useState<any>(null);
  const [sectionReport, setSectionReport] = useState<any>(null);
  const [checkingSection, setCheckingSection] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON_FORM);
  const [lessonModal, setLessonModal] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);

  const [placingLesson, setPlacingLesson] = useState<any>(null);

  const [weekModal, setWeekModal] = useState(false);
  const [weekScope, setWeekScope] = useState<'section' | 'class'>('section');
  const [weekForm, setWeekForm] = useState<WeekForm>(DEFAULT_WEEK);
  const [savingWeek, setSavingWeek] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ttRes, classesRes, termsRes, yearsRes, subjectsRes, teachersRes] = await Promise.all([
        api.get('/timetable/timetables/'),
        api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
        api.get('/academic/terms/'),
        api.get('/academic/academic-years/'),
        api.get('/academic/subjects/'),
        api.get('/staff/teachers/'),
      ]);
      setTimetables(ttRes.data.results || ttRes.data);
      setClasses(classesRes.data.results || classesRes.data);
      setTerms(termsRes.data.results || termsRes.data);
      setYears(yearsRes.data.results || yearsRes.data);
      setSubjects(subjectsRes.data.results || subjectsRes.data);
      setTeachers(teachersRes.data.results || teachersRes.data || []);
    } catch {
      addToast('Failed to load timetable data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSectionId]);

  const activeTerm = useMemo(() => {
    const activeYear = years.find((y: any) => y.is_active) || years[0];
    if (!activeYear) return undefined;
    return terms.find((t: any) => t.academic_year === activeYear.id) || terms[0];
  }, [years, terms]);

  const [termFilter, setTermFilter] = useState<string>('auto');

  useEffect(() => {
    if (termFilter === 'auto' && activeTerm) setTermFilter(String(activeTerm.id));
    if (!createForm.termId && activeTerm) setCreateForm((f) => ({ ...f, termId: String(activeTerm.id) }));
  }, [activeTerm, createForm.termId]);

  const yearName = (termId: number) => {
    const t = terms.find((x: any) => x.id === termId);
    const y = years.find((x: any) => x.id === t?.academic_year);
    return y?.name || '';
  };

  const termChips = useMemo(() => {
    const seen = new Map<number, any>();
    timetables.forEach((tt: any) => {
      if (tt.term && !seen.has(tt.term)) seen.set(tt.term, tt);
    });
    return terms.filter((t: any) => seen.has(t.id));
  }, [timetables, terms]);

  const periodsOf = (tt: any) => (tt?.periods?.length ? tt.periods : DEFAULT_PERIODS);
  const daysOf = (tt: any) => (tt?.working_days?.length ? [...tt.working_days].sort() : [1, 2, 3, 4, 5]);
  const dayLabel = (d: number) => DAYS.find((x) => x.value === d)?.label || 'Day';
  const dayShort = (d: number) => dayLabel(d).slice(0, 3);
  const teacherLabel = (t: any) => t.user_details?.full_name || t.employee_id || `Teacher ${t.id}`;
  const colorOf = (subjectId: string) => {
    let h = 0;
    const s = String(subjectId);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };

  // ---------------------------------------------------------------- //
  //  Detail navigation                                                //
  // ---------------------------------------------------------------- //
  const openDetail = async (tt: any) => {
    setDetailLoading(true);
    setSelected(tt);
    setIssues(null);
    setPlacingLesson(null);
    setTab('grid');
    try {
      const res = await api.get(`/timetable/timetables/${tt.id}/`);
      setSelected(res.data);
      const csRes = await api.get('/academic/class-subjects/', { params: { academic_class: res.data.class_obj } });
      setClassSubjects(csRes.data.results || csRes.data);
    } catch {
      addToast('Failed to load timetable details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selected) return;
    try {
      const res = await api.get(`/timetable/timetables/${selected.id}/`);
      setSelected(res.data);
    } catch {
      addToast('Failed to refresh timetable.', 'error');
    }
  };

  // ---------------------------------------------------------------- //
  //  Section workspace                                                //
  // ---------------------------------------------------------------- //
  const workspaceClasses = useMemo(
    () =>
      workspaceSection
        ? classes.filter((c: any) => String(c.section_id) === workspaceSection)
        : [],
    [workspaceSection, classes]
  );

  const ttByClass = useMemo(() => {
    const m = new Map<string, any>();
    timetables.forEach((tt: any) => {
      if (tt.term && String(tt.term) === String(termFilter)) m.set(tt.class_obj, tt);
    });
    return m;
  }, [timetables, termFilter]);

  const publishedCount = useMemo(
    () => workspaceClasses.filter((c: any) => ttByClass.get(String(c.id))?.generation_status === 'published').length,
    [workspaceClasses, ttByClass]
  );

  const sectionOf = (tt: any) => {
    const cls = classes.find((c: any) => c.id === tt?.class_obj);
    return cls?.section_id ? String(cls.section_id) : null;
  };

  const openWorkspace = (sectionId: string) => {
    if (termFilter === 'all' && activeTerm) setTermFilter(String(activeTerm.id));
    setSelected(null);
    setWorkspaceSection(sectionId);
    setSchoolResult(null);
  };

  const refreshWsSubjects = async () => {
    if (!workspaceSection) return;
    try {
      const rows = await Promise.all(
        workspaceClasses.map(async (c: any) => {
          const r = await api.get('/academic/class-subjects/', { params: { academic_class: c.id } });
          return { id: String(c.id), list: r.data.results || r.data };
        })
      );
      setWsSubjects(Object.fromEntries(rows.map((r) => [r.id, r.list])));
    } catch {
      addToast('Failed to load subject hours.', 'error');
    }
  };

  useEffect(() => {
    if (!workspaceSection) return;
    setWsLoading(true);
    refreshWsSubjects().finally(() => setWsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSection, termFilter]);

  useEffect(() => {
    if (!workspaceSection || termFilter === 'all') return;
    api
      .post('/timetable/timetables/create_for_section/', { term: termFilter, stream: workspaceSection })
      .then(() => {
        fetchData();
        addToast('Timetables prepared for this section.', 'success');
      })
      .catch((e: any) => {
        addToast(e.response?.data?.detail || 'Could not prepare class timetables. Please check that classes exist for this section and term.', 'error');
      })
      .finally(() => {
        setWsLoading(false);
        refreshWsSubjects().finally(() => setWsLoading(false));
      });
    loadSectionSummary(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSection, termFilter]);

  const saveWsHours = async (classId: string, cs: any, hours: number) => {
    setHoursSaving((s) => ({ ...s, [`${classId}-${cs.id}`]: true }));
    try {
      await api.patch(`/academic/class-subjects/${cs.id}/`, { weekly_hours: hours });
      setWsSubjects((all) => ({
        ...all,
        [classId]: all[classId].map((x) => (x.id === cs.id ? { ...x, weekly_hours: hours } : x)),
      }));
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to save weekly hours.', 'error');
    } finally {
      setHoursSaving((s) => { const n = { ...s }; delete n[`${classId}-${cs.id}`]; return n; });
    }
  };

  const saveWsDouble = async (classId: string, cs: any, value: boolean | null) => {
    try {
      await api.patch(`/academic/class-subjects/${cs.id}/`, { is_double: value });
      setWsSubjects((all) => ({
        ...all,
        [classId]: all[classId].map((x) => (x.id === cs.id ? { ...x, is_double: value } : x)),
      }));
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to save double-period setting.', 'error');
    }
  };

  const handleGenerateSection = async () => {
    if (!workspaceSection || !termFilter || termFilter === 'all') return;
    setGeneratingSection(true);
    setSchoolResult(null);
    try {
      const res = await api.post('/timetable/timetables/generate_school/', {
        term: termFilter,
        stream: workspaceSection,
        periods: buildPeriods(weekForm),
        working_days: weekForm.days.map(Number),
      });
      setSchoolResult({ ...res.data, skipped: res.data.skipped || [] });
      addToast(res.data.message || 'Section timetable generated.', 'success');
      await fetchData();
      await refreshWsSubjects();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.detail || error.response?.data?.error || 'Generation failed.';
      setSchoolResult({ ok: false, error: msg });
      addToast(msg, 'error');
    } finally {
      setGeneratingSection(false);
    }
  };

  const loadSectionSummary = async (silent = false) => {
    if (!workspaceSection || !termFilter || termFilter === 'all' || !silent) setCheckingSection(true);
    try {
      const res = await api.post('/timetable/timetables/section_data/', { term: termFilter, stream: workspaceSection });
      setSectionSummary(res.data);
    } catch (e: any) {
      if (!silent) addToast(e.response?.data?.detail || 'Could not load the section summary.', 'error');
    } finally {
      if (!silent) setCheckingSection(false);
    }
  };

  const runSectionCheck = async () => {
    if (!workspaceSection || !termFilter || termFilter === 'all') return;
    setCheckingSection(true);
    try {
      const res = await api.post('/timetable/timetables/check_section/', {
        term: termFilter,
        stream: workspaceSection,
        periods: buildPeriods(weekForm),
        working_days: weekForm.days.map(Number),
      });
      setSectionChecks({ ...res.data, ran: true });
      addToast(res.data.ready ? 'Section is ready — requirements fit the week.' : `${res.data.count} problem(s) found. Read them before generating.`, res.data.ready ? 'success' : 'info');
    } catch (e: any) {
      addToast(e.response?.data?.detail || 'Feasibility check failed.', 'error');
    } finally {
      setCheckingSection(false);
    }
  };

  const runSectionValidate = async () => {
    if (!workspaceSection || !termFilter || termFilter === 'all') return;
    setValidating(true);
    try {
      const res = await api.post('/timetable/timetables/validate_section/', { term: termFilter, stream: workspaceSection });
      setSectionReport(res.data);
      addToast(res.data.valid ? 'Section timetable is valid — 0 hard violations.' : `${res.data.count} issue(s) found in the validation report.`, res.data.valid ? 'success' : 'info');
    } catch (e: any) {
      addToast(e.response?.data?.detail || 'Validation failed.', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handlePublishSection = async () => {
    if (!workspaceSection || !termFilter || termFilter === 'all') return;
    setPublishing(true);
    try {
      const res = await api.post('/timetable/timetables/publish/', { term: termFilter, stream: workspaceSection });
      addToast(res.data.message, 'success');
      await fetchData();
    } catch (e: any) {
      addToast(e.response?.data?.detail || 'Publishing failed.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublishSection = async () => {
    if (!workspaceSection || !termFilter || termFilter === 'all') return;
    setPublishing(true);
    try {
      const res = await api.post('/timetable/timetables/unpublish/', { term: termFilter, stream: workspaceSection });
      addToast(res.data.message, 'success');
      await fetchData();
    } catch (e: any) {
      addToast(e.response?.data?.detail || 'Unpublishing failed.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateSchool = async () => {
    if (!schoolForm.termId) {
      addToast('Select a term.', 'error');
      return;
    }
    setGeneratingSchool(true);
    setSchoolResult(null);
    try {
      const payload: any = { term: schoolForm.termId };
      if (schoolForm.streamId) payload.stream = schoolForm.streamId;
      const res = await api.post('/timetable/timetables/generate_school/', payload);
      setSchoolResult({ ...res.data, skipped: res.data.skipped || [] });
      addToast(res.data.message || 'School timetable generated.', 'success');
      await fetchData();
      await refreshDetail();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.detail || error.response?.data?.error || 'Generation failed.';
      setSchoolResult({ ok: false, error: msg });
      addToast(msg, 'error');
    } finally {
      setGeneratingSchool(false);
    }
  };

  const [schoolForm, setSchoolForm] = useState({ termId: '', streamId: '' });

  // ---------------------------------------------------------------- //
  //  Create / delete / publish                                        //
  // ---------------------------------------------------------------- //
  const handleCreate = async () => {
    if (!createForm.classId || !createForm.termId) {
      addToast('Select a class and a term.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/timetable/timetables/', {
        class_obj: createForm.classId,
        term: createForm.termId,
        is_active: true,
      });
      addToast('Timetable created — set weekly hours to get started.', 'success');
      setShowModal(false);
      await fetchData();
      openDetail(res.data);
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || 'Failed to create timetable.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimetable = async (tt: any) => {
    if (!window.confirm(
      `Delete the timetable for ${tt.class_name} (${tt.term_name})?\n\nThis removes all ${tt.slots?.length || 0} scheduled lesson(s) and ${tt.lessons?.length || 0} lesson card(s). This cannot be undone.`
    )) return;
    try {
      await api.delete(`/timetable/timetables/${tt.id}/`);
      addToast('Timetable deleted.', 'success');
      setSelected(null);
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || 'Failed to delete timetable.', 'error');
    }
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    try {
      await api.patch(`/timetable/timetables/${selected.id}/`, { is_active: !selected.is_active });
      refreshDetail();
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to update status.', 'error');
    }
  };

  // ---------------------------------------------------------------- //
  //  Lessons                                                          //
  // ---------------------------------------------------------------- //
  const handleSuggest = async () => {
    if (!selected) return;
    if (!window.confirm(
      'Suggest lessons from weekly hours?\n\nThis replaces the current lesson list with one lesson per subject, ' +
      'using its weekly hours (doubles run as 2 consecutive periods). Existing grid slots are kept.'
    )) return;
    setSuggesting(true);
    try {
      const res = await api.post(`/timetable/timetables/${selected.id}/suggest_lessons/`);
      addToast(res.data.message || 'Lessons suggested.', 'success');
      await refreshDetail();
      await refreshWsSubjects();
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to suggest lessons.';
      addToast(Array.isArray(msg) ? msg.join(' ') : msg, 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const openLessonForm = (lesson: any | null) => {
    setLessonForm(
      lesson
        ? {
            id: lesson.id,
            subject: String(lesson.subject),
            teacher: String(lesson.teacher),
            periods_per_week: lesson.periods_per_week,
            is_double: lesson.is_double,
            note: lesson.note || '',
          }
        : EMPTY_LESSON_FORM
    );
    setLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (!selected || !lessonForm.subject || !lessonForm.teacher) {
      addToast('Choose a subject and a teacher.', 'error');
      return;
    }
    if (lessonForm.periods_per_week < 1) {
      addToast('Weekly periods must be at least 1.', 'error');
      return;
    }
    if (lessonForm.is_double && lessonForm.periods_per_week % 2 !== 0) {
      addToast('A double lesson must have an even number of periods (e.g. 2, 4, 6).', 'error');
      return;
    }
    setSavingLesson(true);
    const payload = { ...lessonForm, id: undefined, timetable: selected.id };
    try {
      if (lessonForm.id) {
        await api.patch(`/timetable/lessons/${lessonForm.id}/`, payload);
        addToast('Lesson updated.', 'success');
      } else {
        await api.post('/timetable/lessons/', payload);
        addToast('Lesson added.', 'success');
      }
      setLessonModal(false);
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to save lesson.', 'error');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lesson: any) => {
    if (!window.confirm(`Remove ${lesson.subject_name} (${lesson.periods_per_week} periods/week)? Scheduled slots for it stay on the grid.`)) return;
    try {
      await api.delete(`/timetable/lessons/${lesson.id}/`);
      addToast('Lesson removed.', 'success');
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to remove lesson.', 'error');
    }
  };

  const startPlacing = (lesson: any) => {
    setPlacingLesson(placingLesson?.id === lesson.id ? null : lesson);
    if (placingLesson?.id !== lesson.id) setTab('grid');
  };

  // ---------------------------------------------------------------- //
  //  Validate                                                         //
  // ---------------------------------------------------------------- //
  const handleValidate = async () => {
    if (!selected) return;
    setValidating(true);
    try {
      const res = await api.get(`/timetable/timetables/${selected.id}/validate/`);
      setIssues(res.data.issues || []);
    } catch {
      addToast('Failed to run clash check.', 'error');
    } finally {
      setValidating(false);
    }
  };

  // ---------------------------------------------------------------- //
  //  School week editor                                               //
  // ---------------------------------------------------------------- //
  const openWeekEditor = (scope: 'section' | 'class') => {
    setWeekScope(scope);
    const source = scope === 'class'
      ? selected
      : (workspaceClasses.map((c: any) => ttByClass.get(String(c.id))).find((tt) => tt) || undefined);
    setWeekForm(weekFromTimetable(source));
    setWeekModal(true);
  };

  const handleSaveWeek = async () => {
    const periods = buildPeriods(weekForm);
    const workingDays = weekForm.days.map(Number);
    if (periods.length < 2) {
      addToast('You need at least 2 periods per day.', 'error');
      return;
    }
    if (!workingDays.length) {
      addToast('Select at least one working day.', 'error');
      return;
    }
    setSavingWeek(true);
    try {
if (weekScope === 'class' && selected) {
      // Ensure timetable exists for the class
      if (!selected) {
        throw new Error('No class selected. Please select a class first.');
      }
      if (!ttByClass.get(String(selected.id))) {
        // Try to create timetable for this class
        try {
          await api.post('/timetable/timetables/create_for_section/', { 
            term: termFilter, 
            stream: workspaceSection 
          });
          await fetchData(); // Refresh timetable data
        } catch (createError) {
          throw new Error('Failed to create timetable for this class. Please try creating it manually first.');
        }
      }
      await api.patch(`/timetable/timetables/${selected.id}/`, { periods, working_days: workingDays });
} else {
    // Ensure timetables exist for all classes in the section
    const missingTimetables = workspaceClasses
      .map((c: any) => ttByClass.get(String(c.id)))
      .filter((tt) => !tt);
    
    if (missingTimetables.length > 0) {
      // Try to create missing timetables
      try {
        await api.post('/timetable/timetables/create_for_section/', { 
          term: termFilter, 
          stream: workspaceSection 
        });
        await fetchData(); // Refresh timetable data
      } catch (createError) {
        throw new Error('Failed to create timetables for this section. Please try creating them manually first.');
      }
    }
    
    // Refresh the timetable references
    const tts = workspaceClasses
      .map((c: any) => ttByClass.get(String(c.id)))
      .filter((tt) => tt);
      
    if (!tts.length) {
      throw new Error('Could not create or find timetables for this section. Please check that classes exist for this section and term.');
    }
    
    await Promise.all(tts.map((tt) => api.patch(`/timetable/timetables/${tt.id}/`, { periods, working_days: workingDays })));
      }
      addToast(weekScope === 'class' ? 'School week updated for this class.' : 'School week updated for the whole section.', 'success');
      setWeekModal(false);
      await fetchData();
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.message || 'Failed to save school week.', 'error');
    } finally {
      setSavingWeek(false);
    }
  };

  // ---------------------------------------------------------------- //
  //  Grid: cells, popover editor, place-lesson                        //
  // ---------------------------------------------------------------- //
  const isAdjacent = (periods: any[], p: number) =>
    p < periods.length - 1 && periods[p].end === periods[p + 1].start;

  const openCellModal = (day: number, periodIndex: number, slot?: any) => {
    const periods = periodsOf(selected);
    const period = periods[periodIndex];
    setPlacingLesson(null);
    setCellModal({ day, periodIndex });
    setSlotForm(
      slot
        ? {
            id: slot.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time.slice(0, 5),
            end_time: slot.end_time.slice(0, 5),
            subject: String(slot.subject),
            teacher: String(slot.teacher),
            classroom: slot.classroom || '',
            is_locked: slot.is_locked,
          }
        : {
            ...EMPTY_SLOT_FORM,
            day_of_week: day,
            start_time: period.start,
            end_time: period.end,
          }
    );
  };

  const matchLesson = (subjectId: string, teacherId: string) => {
    const matches = (selected?.lessons || []).filter(
      (l: any) => String(l.subject) === String(subjectId) && String(l.teacher) === String(teacherId)
    );
    if (!matches.length) return undefined;
    const withRoom = matches.find((l: any) => (l.placed_periods || 0) < l.periods_per_week);
    return (withRoom || matches[0]).id;
  };

  const handleSaveSlot = async () => {
    if (!selected || !slotForm.subject || !slotForm.teacher) {
      addToast('Choose a subject and a teacher for the lesson.', 'error');
      return;
    }
    if (slotForm.start_time >= slotForm.end_time) {
      addToast('The lesson must end after it starts.', 'error');
      return;
    }
    setSavingSlot(true);
    const payload = {
      timetable: selected.id,
      day_of_week: slotForm.day_of_week,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      subject: slotForm.subject,
      teacher: slotForm.teacher,
      classroom: slotForm.classroom,
      is_locked: slotForm.is_locked,
      lesson: slotForm.id ? undefined : matchLesson(slotForm.subject, slotForm.teacher),
    };
    try {
      if (slotForm.id) {
        await api.patch(`/timetable/time-slots/${slotForm.id}/`, payload);
        addToast('Lesson updated.', 'success');
      } else {
        await api.post('/timetable/time-slots/', payload);
        addToast('Lesson added.', 'success');
      }
      setCellModal(null);
      setSlotForm(EMPTY_SLOT_FORM);
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || 'Failed to save lesson.', 'error');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slot: any) => {
    if (!window.confirm(`Remove ${slot.subject_name} (${slot.teacher_name}) on ${slot.day_name || dayLabel(slot.day_of_week)} at ${slot.start_time.slice(0, 5)}?`)) return;
    try {
      await api.delete(`/timetable/time-slots/${slot.id}/`);
      addToast('Lesson removed.', 'success');
      setCellModal(null);
      await refreshDetail();
      fetchData();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to remove lesson.', 'error');
    }
  };

  const toggleLock = async (slot: any) => {
    try {
      await api.patch(`/timetable/time-slots/${slot.id}/`, { is_locked: !slot.is_locked });
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to lock lesson.', 'error');
    }
  };

  const placeLessonAt = async (day: number, periodIndex: number) => {
    if (!selected || !placingLesson) return;
    const periods = periodsOf(selected);
    const period = periods[periodIndex];
    const start = period.start;
    const end = period.end;
    const occupied = (selected.slots || []).some(
      (s: any) => s.day_of_week === day && s.start_time.slice(0, 5) === start
    );
    if (occupied) {
      addToast('That cell is already occupied — remove the lesson there first.', 'error');
      return;
    }
    const create = async (s: string, e: string) => {
      await api.post('/timetable/time-slots/', {
        timetable: selected.id,
        day_of_week: day,
        start_time: s,
        end_time: e,
        subject: placingLesson.subject,
        teacher: placingLesson.teacher,
        classroom: '',
        is_locked: false,
        lesson: placingLesson.id,
      });
    };
    try {
      if (placingLesson.is_double) {
        if (!isAdjacent(periods, periodIndex)) {
          addToast('A double lesson needs 2 consecutive periods — this period is followed by a break.', 'error');
          return;
        }
        await create(start, periods[periodIndex + 1].start);
        await create(periods[periodIndex + 1].start, periods[periodIndex + 1].end);
      } else {
        await create(start, end);
      }
      addToast(`${placingLesson.subject_name} placed.`, 'success');
      setPlacingLesson(null);
      await refreshDetail();
    } catch (error: any) {
      addToast(error.response?.data?.detail || error.response?.data?.error || 'Could not place the lesson.', 'error');
    }
  };

  const slotsAt = (day: number, periodIndex: number) => {
    const periods = periodsOf(selected);
    const start = periods[periodIndex].start;
    const end = periods[periodIndex].end;
    return (selected?.slots || []).filter(
      (s: any) => s.day_of_week === day && s.start_time.slice(0, 5) === start && s.end_time.slice(0, 5) === end
    );
  };

  // ---------------------------------------------------------------- //
  //  Status helpers                                                   //
  // ---------------------------------------------------------------- //
  const statusPill = (tt: any) => {
    const st = tt?.generation_status;
    if (st === 'published')
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
          <Globe className="w-3 h-3" /> Published
        </span>
      );
    if (st === 'generated')
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" /> Generated
        </span>
      );
    if (st === 'infeasible')
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" /> Needs attention
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-container-highest text-on-surface-variant">
        Draft
      </span>
    );
  };

  const sectionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    classes.forEach((c: any) => {
      if (c.section_id && !seen.has(String(c.section_id))) seen.set(String(c.section_id), c.section_name);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [classes]);

  const sections = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; classes: any[] }>();
    classes.forEach((c: any) => {
      const key = c.section_id ? String(c.section_id) : 'none';
      if (!groups.has(key)) groups.set(key, { id: key, name: c.section_name || 'Unassigned', classes: [] });
      groups.get(key)!.classes.push(c);
    });
    return [...groups.values()];
  }, [classes]);

  const singleClassSection = (tt: any) => {
    const sid = sectionOf(tt);
    return !!sid && classes.filter((c: any) => String(c.section_id) === sid).length === 1;
  };

  // ================================================================ //
  //  RENDER                                                           //
  // ================================================================ //
  const headerTitle = selected ? 'Timetable Builder' : workspaceSection ? 'Section Workspace' : 'Timetables';
  const headerSub = selected
    ? `${selected.class_name} • ${selected.term_name} (${selected.academic_year_name})`
    : workspaceSection
      ? `Every class of the section, one week, one generate button`
      : 'Build a clash-free school timetable — by section, or all at once.';

  return (
    <div className="p-4 lg:p-10 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* ============ HEADER ============ */}
      <div className="flex justify-between items-end">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Academic Scheduling</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{headerTitle}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{headerSub}</p>
        </div>
        {!selected && !workspaceSection ? (
          <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
            <PlusCircle className="w-4 h-4" /> Create Timetable
          </button>
        ) : (
          <button
            onClick={() => { setSelected(null); setWorkspaceSection(null); }}
            className="border border-outline-variant/30 px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-surface-variant transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> All Timetables
          </button>
        )}
      </div>

      {/* ================================================================ //
      //  OVERVIEW                                                         //
      // ================================================================ */}
      {!selected && !workspaceSection && (
        <>
          {/* School-wide generate hero */}
          <div className="bg-gradient-to-br from-primary via-primary to-primary/80 rounded-3xl p-8 text-white shadow-xl shadow-primary/20">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarRange className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest text-white/80">Generate everything at once</span>
                </div>
                <h3 className="text-2xl font-bold leading-snug">Build every class of the term with one click</h3>
                <p className="text-blue-100 mt-2 text-sm leading-relaxed">
                  The engine creates or reuses a timetable for <b>each class</b>, suggests lessons where needed, and solves them
                  together — so a teacher shared across classes is never double-booked.
                </p>
              </div>
              <div className="w-full lg:w-[420px] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={schoolForm.termId || (activeTerm ? String(activeTerm.id) : '')}
                    onChange={(e) => setSchoolForm({ ...schoolForm, termId: e.target.value })}
                    className="bg-white/10 border border-white/30 rounded-xl px-4 py-3.5 text-sm font-medium text-white focus:outline-none [&>option]:text-on-surface"
                  >
                    <option value="">Select term</option>
                    {terms.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} — {yearName(t.id)}</option>
                    ))}
                  </select>
                  <select
                    value={schoolForm.streamId}
                    onChange={(e) => setSchoolForm({ ...schoolForm, streamId: e.target.value })}
                    disabled={!!activeSectionId}
                    className="bg-white/10 border border-white/30 rounded-xl px-4 py-3.5 text-sm font-medium text-white focus:outline-none disabled:opacity-60 [&>option]:text-on-surface"
                  >
                    <option value="">All sections</option>
                    {sectionOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleGenerateSchool}
                  disabled={generatingSchool || !schoolForm.termId}
                  className="w-full bg-white text-primary rounded-xl py-4 font-black uppercase tracking-widest text-sm shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  {generatingSchool ? 'Solving the whole school...' : 'Generate whole school'}
                </button>
                {schoolResult && (
                  <div className={`rounded-2xl border p-4 text-sm space-y-2 backdrop-blur-sm ${schoolResult.ok ? 'bg-green-500/20 border-green-200/40 text-white' : 'bg-red-500/20 border-red-300/40 text-white'}`}>
                    {schoolResult.ok ? (
                      <>
                        <p className="font-bold">{schoolResult.message}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(schoolResult.classes || []).map((c: any) => (
                            <span key={c.class_name} className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold">
                              {c.class_name} · {c.slots}
                            </span>
                          ))}
                        </div>
                        {(schoolResult.skipped || []).length > 0 && (
                          <div className="pt-2 border-t border-white/20">
                            <p className="font-bold text-amber-300 mb-1">Skipped ({schoolResult.skipped.length}):</p>
                            {schoolResult.skipped.map((s: any) => (
                              <p key={s.class_name} className="text-xs text-amber-100">{s.class_name} — {s.reason}</p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="font-bold whitespace-pre-line">{schoolResult.error || schoolResult.message}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Term chips */}
          {termChips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-outline">Term:</span>
              <button
                onClick={() => setTermFilter('all')}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors ${termFilter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}
              >
                All terms
              </button>
              {termChips.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTermFilter(String(t.id))}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors ${String(termFilter) === String(t.id) ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  {t.term_name} {yearName(t.id) ? `(${yearName(t.id)})` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Section cards */}
          {loading ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-12 text-center text-on-surface-variant">Loading timetables...</div>
          ) : sections.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-16 text-center">
              <span className="text-4xl mb-4 block text-outline">🗓️</span>
              <h3 className="text-lg font-bold text-on-surface mb-2">No Classes Yet</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                Add classes under Academic Setup first, then come back here to build timetables section by section.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sections.map((sec) => {
                const tts = sec.classes
                  .map((c: any) => ttByClass.get(String(c.id)))
                  .filter((tt) => tt);
                const generated = tts.filter((tt) => tt.generation_status === 'generated').length;
                const published = tts.filter((tt) => tt.generation_status === 'published').length;
                const needsAttention = tts.filter((tt) => tt.generation_status === 'infeasible').length;
                return (
                  <div key={sec.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg text-on-surface truncate">{sec.name}</h3>
                          <p className="text-xs text-on-surface-variant">{sec.classes.length} class{sec.classes.length > 1 ? 'es' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {needsAttention > 0 && (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider">{needsAttention} attention</span>
                        )}
                        {published > 0 && (
                          <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">{published} published</span>
                        )}
                        {generated > 0 && (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-wider">{generated} generated</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {sec.classes.map((c: any) => {
                        const tt = ttByClass.get(String(c.id));
                        return (
                          <span
                            key={c.id}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${tt?.generation_status === 'published' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : tt?.generation_status === 'generated' ? 'bg-green-50 text-green-700 border border-green-200' : tt?.generation_status === 'infeasible' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-surface-container text-on-surface-variant'}`}
                          >
                            {c.name}
                          </span>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => openWorkspace(sec.id)}
                      className="w-full bg-primary/10 text-primary rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Wand2 className="w-4 h-4" /> Open workspace — hours, week & generate
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================ //
      //  SECTION WORKSPACE                                                //
      // ================================================================ */}
      {!selected && workspaceSection && (
        <div className="space-y-6">
          {/* Workspace header */}
          <div className="bg-gradient-to-br from-primary via-primary to-primary/80 rounded-3xl p-8 text-white shadow-xl shadow-primary/20">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest text-white/80">Section workspace</span>
                </div>
                <h3 className="text-2xl font-bold leading-snug">
                  {sections.find((s) => s.id === workspaceSection)?.name} — {terms.find((t) => String(t.id) === String(termFilter))?.name || 'term'}
                </h3>
                <p className="text-blue-100 mt-2 text-sm leading-relaxed">
                  Three quick steps: <b>set hours</b> per subject per class (and mark doubles), check the <b>school week</b>
                  (period length and breaks), then <b>generate the section</b>. All classes of this section are solved
                  together — no teacher can be double-booked.
                </p>
              </div>
              <div className="w-full lg:w-[380px] space-y-3">
                <button
                  onClick={handleGenerateSection}
                  disabled={generatingSection || termFilter === 'all'}
                  className="w-full bg-white text-primary rounded-xl py-4 font-black uppercase tracking-widest text-sm shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  {generatingSection ? 'Solving the section...' : 'Generate section'}
                </button>
                <button
                  onClick={() => openWeekEditor('section')}
                  className="w-full bg-white/10 border border-white/30 rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  School week: {weekForm.count} × {weekForm.periodLen} min • {weekForm.breaks.length} break{weekForm.breaks.length !== 1 ? 's' : ''}
                </button>
                {schoolResult && (
                  <div className={`rounded-2xl border p-4 text-sm space-y-2 backdrop-blur-sm ${schoolResult.ok ? 'bg-green-500/20 border-green-200/40' : 'bg-red-500/20 border-red-300/40'}`}>
                    {schoolResult.ok ? (
                      <>
                        <p className="font-bold">{schoolResult.message}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(schoolResult.classes || []).map((c: any) => (
                            <span key={c.class_name} className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold">
                              {c.class_name} · {c.slots}
                            </span>
                          ))}
                        </div>
                        {(schoolResult.skipped || []).length > 0 && (
                          <div className="pt-2 border-t border-white/20">
                            <p className="font-bold text-amber-300 mb-1">Skipped ({schoolResult.skipped.length}):</p>
                            {schoolResult.skipped.map((s: any) => (
                              <p key={s.class_name} className="text-xs text-amber-100">{s.class_name} — {s.reason}</p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="font-bold whitespace-pre-line">{schoolResult.error || schoolResult.message}</p>
                    )}
                  </div>
                )}

                {/* Section data preview — plan §30-31 */}
                {sectionSummary && (
                  <div className="rounded-2xl bg-white/10 border border-white/25 p-4 text-sm space-y-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Section data</p>
                      <button
                        onClick={() => { setSectionSummary(null); setSectionChecks(null); setSectionReport(null); }}
                        className="text-white/70 hover:text-white text-xs font-bold"
                      >
                        Hide
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {[
                        ['Classes', sectionSummary.classes],
                        ['Teachers', sectionSummary.teachers],
                        ['Subjects', sectionSummary.subjects],
                        ['Assignments', sectionSummary.assignments],
                        ['Required', `${sectionSummary.required_lessons} h/wk`],
                      ].map(([label, value]) => (
                        <div key={label as string} className="bg-white/10 rounded-xl py-2">
                          <p className="text-lg font-black">{value}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-white/70">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={runSectionCheck}
                        disabled={checkingSection || termFilter === 'all'}
                        className="flex-1 bg-white/10 border border-white/30 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {checkingSection ? 'Checking...' : 'Check readiness'}
                      </button>
                      <button
                        onClick={runSectionValidate}
                        disabled={validating || termFilter === 'all'}
                        className="flex-1 bg-white/10 border border-white/30 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {validating ? 'Validating...' : 'Validate'}
                      </button>
                    </div>
                    {sectionChecks?.ran && (
                      <div className={`rounded-xl p-3 text-xs space-y-1.5 ${sectionChecks.ready ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                        <p className={`font-black uppercase tracking-widest text-[10px] ${sectionChecks.ready ? 'text-green-200' : 'text-amber-200'}`}>
                          {sectionChecks.ready ? 'Ready to generate' : `${sectionChecks.issues.length} issue(s) to fix first`}
                        </p>
                        {sectionChecks.issues.map((issue: any, i: number) => (
                          <p key={i} className="text-white/90 leading-snug">• {issue.message}</p>
                        ))}
                      </div>
                    )}
                    {sectionReport && (
                      <div className={`rounded-xl p-3 text-xs space-y-1.5 ${sectionReport.valid ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        <p className={`font-black uppercase tracking-widest text-[10px] ${sectionReport.valid ? 'text-green-200' : 'text-red-200'}`}>
                          Validation: {sectionReport.valid ? 'VALID — 0 errors' : `${sectionReport.count} error(s)`}
                        </p>
                        {sectionReport.issues.map((issue: any, i: number) => (
                          <p key={i} className="text-white/90 leading-snug">• {issue.message}</p>
                        ))}
                        {sectionReport.valid && publishedCount > 0 ? (
                          <button
                            onClick={handleUnpublishSection}
                            disabled={publishing}
                            className="mt-1 w-full bg-white/15 border border-white/30 text-white rounded-lg py-2 font-black uppercase tracking-widest text-[11px] hover:bg-white/25 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            {publishing ? 'Unpublishing...' : 'Unpublish — allow new generation'}
                          </button>
                        ) : sectionReport.valid ? (
                          <button
                            onClick={handlePublishSection}
                            disabled={publishing}
                            className="mt-1 w-full bg-white text-primary rounded-lg py-2 font-black uppercase tracking-widest text-[11px] hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            {publishing ? 'Publishing...' : 'Publish — official timetable'}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Per-class hours */}
          {wsLoading ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-12 text-center text-on-surface-variant">Loading classes...</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {workspaceClasses.map((cls: any) => {
                const tt = ttByClass.get(String(cls.id));
                const csl = wsSubjects[String(cls.id)] || [];
                const total = csl.reduce((s: number, cs: any) => s + (cs.weekly_hours || 0), 0);
                return (
                  <div key={cls.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface">{cls.name}</h4>
                          <p className="text-[11px] text-on-surface-variant">{total} h/week • {csl.length} subjects</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tt && statusPill(tt)}
                        {tt && (
                          <button
                            onClick={() => openDetail(tt)}
                            className="text-xs font-black uppercase tracking-widest text-primary bg-primary/5 border border-primary/30 px-3 py-2 rounded-lg hover:bg-primary hover:text-white transition-colors"
                          >
                            Open grid
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-5 space-y-2">
                      {csl.length === 0 && (
                        <p className="text-xs text-outline">No subjects linked yet — link subjects to this class in Academic Setup.</p>
                      )}
                      {csl.map((cs: any) => (
                        <div key={cs.id} className="flex items-center justify-between gap-3 bg-surface-container-low rounded-xl px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{cs.subject_name}</p>
                            <p className="text-[10px] text-outline">coeff {cs.coefficient}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-[10px] font-black uppercase tracking-wider transition-colors ${cs.is_double === true ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container'}`} title="Run as 2 consecutive periods">
                              <input
                                type="checkbox"
                                checked={cs.is_double === true}
                                onChange={(e) => saveWsDouble(String(cls.id), cs, e.target.checked ? true : null)}
                                className="hidden"
                              />
                              Double
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              defaultValue={cs.weekly_hours ?? 0}
                              onBlur={(e) => {
                                const v = parseInt(e.target.value) || 0;
                                if (v !== (cs.weekly_hours || 0)) saveWsHours(String(cls.id), cs, v);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="w-14 bg-white border border-outline-variant/30 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <span className="text-[10px] text-outline w-8">h/wk</span>
                            {hoursSaving[`${cls.id}-${cs.id}`] && <span className="text-[10px] text-primary animate-pulse">saving</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ //
      //  DETAIL MODE                                                      //
      // ================================================================ */}
      {selected && (
        <div className="space-y-6">
          {/* Detail header card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-on-surface">{selected.class_name}</h3>
                    {statusPill(selected)}
                  </div>
                  <p className="text-sm text-on-surface-variant">{selected.term_name} ({selected.academic_year_name}) • {selected.section_name}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {singleClassSection(selected) && (
                  <button
                    onClick={handleGenerateSection}
                    disabled={generatingSection || selected.lessons?.length === 0}
                    className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingSection ? 'Solving...' : selected.generation_status === 'generated' ? 'Regenerate' : 'Generate timetable'}
                  </button>
                )}
                <button
                  onClick={() => setTab('lessons')}
                  className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-primary bg-primary/5 border border-primary/30 hover:bg-primary/15 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5 inline mr-1" /> Edit hours & lessons
                </button>
                <button
                  onClick={handleToggleActive}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${selected.is_active ? 'bg-secondary/10 text-secondary hover:bg-secondary/20' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  {selected.is_active ? '● Published' : '○ Draft'}
                </button>
                <button
                  onClick={() => openWeekEditor('class')}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Week: {daysOf(selected).length} days × {periodsOf(selected).length} periods
                </button>
                <button
                  onClick={() => handleDeleteTimetable(selected)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            {!singleClassSection(selected) && (
              <p className="mt-3 text-xs text-on-surface-variant bg-surface-container-low rounded-xl px-4 py-2.5">
                This class is generated together with its whole section — use the <b>Section Workspace</b> to regenerate it
                without ever double-booking a shared teacher.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('grid')}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-black uppercase tracking-widest transition-colors ${tab === 'grid' ? 'bg-surface-container-lowest text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Timetable Grid
            </button>
            <button
              onClick={() => setTab('lessons')}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-black uppercase tracking-widest transition-colors ${tab === 'lessons' ? 'bg-surface-container-lowest text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <BookOpen className="w-4 h-4" /> Lessons & Hours
            </button>
          </div>

          {/* ============ TAB: GRID ============ */}
          {tab === 'grid' && (
            <div className="bg-surface-container-lowest rounded-t-2xl rounded-b-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
              {/* Grid toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-on-surface-variant">
                    {daysOf(selected).map(dayShort).join(' • ')} — {periodsOf(selected).length} periods/day
                  </span>
                  {placingLesson && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                      Placing {placingLesson.subject_name} — click a free cell
                      <button onClick={() => setPlacingLesson(null)} className="hover:opacity-70">✕</button>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleValidate}
                    disabled={validating || selected.slots?.length === 0}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-variant transition-colors disabled:opacity-40"
                  >
                    {validating ? 'Checking...' : 'Check for clashes'}
                  </button>
                  <button
                    onClick={() => openWeekEditor('class')}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Edit school week
                  </button>
                </div>
              </div>

              {/* Status banner */}
              {selected.generation_status === 'generated' && selected.generation_message && (
                <div className="flex items-start gap-3 bg-green-50 border-b border-green-200 px-5 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-green-800">Timetable generated — teachers are clash-free</p>
                    <p className="text-sm text-green-700 whitespace-pre-line">{selected.generation_message}</p>
                  </div>
                </div>
              )}
              {selected.generation_status === 'infeasible' && selected.generation_message && (
                <div className="flex items-start gap-3 bg-red-50 border-b border-red-200 px-5 py-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-red-800">The week cannot be scheduled as configured</p>
                    <p className="text-sm text-red-700 whitespace-pre-line">{selected.generation_message}</p>
                  </div>
                </div>
              )}
              {issues !== null && issues.length === 0 && (
                <div className="flex items-start gap-3 bg-green-50 border-b border-green-200 px-5 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-sm font-bold text-green-800">✓ No clashes. The grid is clean.</p>
                </div>
              )}
              {issues !== null && issues.length > 0 && (
                <div className="border-b border-outline-variant/10 px-5 py-3 space-y-2">
                  <p className="text-sm font-bold text-amber-700">{issues.length} issue{issues.length > 1 ? 's' : ''} found:</p>
                  {issues.map((issue: any, i: number) => (
                    <div key={i} className={`rounded-xl px-4 py-2.5 text-xs border ${issue.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              {detailLoading ? (
                <div className="text-center py-16 text-on-surface-variant">Loading lessons...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[920px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-surface-container-lowest text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-outline w-24">
                          Period
                        </th>
                        {daysOf(selected).map((d: number) => (
                          <th key={d} className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-outline">
                            {dayLabel(d)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodsOf(selected).map((period: any, p: number) => {
                        const isBreak = p > 0 && periodsOf(selected)[p - 1].end !== period.start;
                        return (
                          <tr key={p} className={isBreak ? 'border-t-4 border-dashed border-outline-variant/40' : ''}>
                            <td className="sticky left-0 bg-surface-container-lowest px-4 py-2 text-xs font-bold text-on-surface-variant whitespace-nowrap">
                              {period.start}–{period.end}
                              {isBreak && <span className="block text-[9px] font-normal text-outline">break</span>}
                            </td>
                            {daysOf(selected).map((d: number) => {
                              const slots = slotsAt(d, p);
                              const [bg, fg] = slots[0] ? colorOf(slots[0].subject) : ['transparent', 'transparent'];
                              const prev = p > 0 ? slotsAt(d, p - 1)[0] : undefined;
                              const continuation = slots.length === 1 && slots[0].lesson && prev?.lesson === slots[0].lesson;
                              return (
                                <td
                                  key={d}
                                  onClick={() => {
                                    if (placingLesson) placeLessonAt(d, p);
                                    else if (!slots.length) openCellModal(d, p);
                                  }}
                                  className={`px-2 py-1.5 border border-outline-variant/10 align-top cursor-pointer transition-colors ${
                                    placingLesson && !slots.length
                                      ? 'hover:bg-primary/10 ring-1 ring-inset ring-primary/40'
                                      : 'hover:bg-surface-variant/60'
                                  }`}
                                  style={slots.length ? { background: bg } : undefined}
                                >
                                  {slots.map((slot: any) => (
                                    <div key={slot.id} className={`rounded-lg p-2 relative group/slot ${continuation ? 'opacity-80' : ''}`} style={{ background: bg }}>
                                      {!continuation ? (
                                        <div className="flex items-start justify-between gap-1">
                                          <p className="font-black text-xs leading-tight" style={{ color: fg }}>{slot.subject_name}</p>
                                          {slot.is_locked && <Lock className="w-3 h-3 shrink-0" style={{ color: fg }} />}
                                        </div>
                                      ) : (
                                        <p className="text-[10px] font-black text-on-surface-variant">↳ cont.</p>
                                      )}
                                      <p className="text-[10px] text-on-surface-variant truncate mt-0.5">{slot.teacher_name}</p>
                                      {slot.classroom && <p className="text-[9px] text-outline mt-0.5">🏫 {slot.classroom}</p>}
                                      <div className="absolute top-1 right-1 hidden group-hover/slot:flex gap-0.5 bg-white/95 rounded-md p-0.5 shadow-md z-10">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleLock(slot); }}
                                          title={slot.is_locked ? 'Unlock' : 'Lock (kept on regenerate)'}
                                          className="p-1 rounded hover:bg-black/5"
                                        >
                                          {slot.is_locked ? <Unlock className="w-3 h-3 text-amber-600" /> : <Lock className="w-3 h-3 text-on-surface-variant" />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); openCellModal(d, p, slot); }} title="Edit" className="p-1 rounded hover:bg-black/5">
                                          <Pencil className="w-3 h-3 text-on-surface-variant" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot); }} title="Remove" className="p-1 rounded hover:bg-black/5">
                                          <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ============ TAB: LESSONS & HOURS ============ */}
          {tab === 'lessons' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Weekly hours */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-lg font-bold">Weekly hours</h3>
                    <p className="text-sm text-on-surface-variant">Hours per subject for this class, plus double-period flags.</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                    {classSubjects.reduce((s: number, cs: any) => s + (cs.weekly_hours || 0), 0)} h/wk
                  </span>
                </div>
                <div className="space-y-2 mt-4 max-h-96 overflow-y-auto pr-1">
                  {classSubjects.length === 0 && (
                    <p className="text-xs text-outline bg-surface-container-low rounded-xl p-4">
                      No subjects linked to this class yet. Link subjects to the class first.
                    </p>
                  )}
                  {classSubjects.map((cs: any) => (
                    <div key={cs.id} className="flex items-center justify-between gap-3 bg-surface-container-low rounded-xl px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{cs.subject_name}</p>
                        <p className="text-[10px] text-outline">coeff {cs.coefficient}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-[10px] font-black uppercase tracking-wider transition-colors ${cs.is_double === true ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container'}`} title="Run as 2 consecutive periods">
                          <input
                            type="checkbox"
                            checked={cs.is_double === true}
                            onChange={(e) => {
                              const val = e.target.checked ? true : null;
                              setClassSubjects((list) => list.map((x) => (x.id === cs.id ? { ...x, is_double: val } : x)));
                              api.patch(`/academic/class-subjects/${cs.id}/`, { is_double: val }).catch((err: any) => {
                                addToast(err.response?.data?.detail || 'Failed to save double setting.', 'error');
                                setClassSubjects((list) => list.map((x) => (x.id === cs.id ? { ...x, is_double: cs.is_double } : x)));
                              });
                            }}
                            className="hidden"
                          />
                          Double
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          defaultValue={cs.weekly_hours ?? 0}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            if (v !== (cs.weekly_hours || 0)) {
                              setHoursSaving((s) => ({ ...s, [`d-${cs.id}`]: true }));
                              api.patch(`/academic/class-subjects/${cs.id}/`, { weekly_hours: v })
                                .then(() => {
                                  setClassSubjects((list) => list.map((x) => (x.id === cs.id ? { ...x, weekly_hours: v } : x)));
                                  addToast(`${cs.subject_name}: ${v} h/week saved.`, 'success');
                                })
                                .catch((err: any) => addToast(err.response?.data?.detail || 'Failed to save weekly hours.', 'error'))
                                .finally(() => setHoursSaving((s) => { const n = { ...s }; delete n[`d-${cs.id}`]; return n; }));
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-14 bg-white border border-outline-variant/30 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <span className="text-[10px] text-outline w-8">h/wk</span>
                        {hoursSaving[`d-${cs.id}`] && <span className="text-[10px] text-primary animate-pulse">saving</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-outline mt-3">
                  Changes save automatically. Press <b>Suggest</b> to turn these hours into lesson cards.
                </p>
              </div>

              {/* Lessons */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-lg font-bold">Lessons to schedule</h3>
                    <p className="text-sm text-on-surface-variant">One card per subject. Doubles stay consecutive and never cross a break.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openLessonForm(null)}
                      className="text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-colors"
                    >
                      + Add
                    </button>
                    <button
                      onClick={handleSuggest}
                      disabled={suggesting}
                      className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> {suggesting ? 'Building...' : 'Suggest from hours'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 mt-4 max-h-96 overflow-y-auto pr-1">
                  {selected.lessons?.length === 0 && (
                    <p className="text-xs text-outline bg-surface-container-low rounded-xl p-4">
                      No lessons yet. Set weekly hours, then press <b>Suggest from hours</b> — or add lessons manually.
                    </p>
                  )}
                  {selected.lessons?.map((lesson: any) => {
                    const [, fg] = colorOf(lesson.subject);
                    const placed = lesson.placed_periods || 0;
                    const pct = Math.min(100, Math.round((placed / lesson.periods_per_week) * 100));
                    return (
                      <div key={lesson.id} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/15 group/lesson">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: fg }} />
                            <p className="font-bold text-sm truncate">{lesson.subject_name}</p>
                            {lesson.is_double && (
                              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-black uppercase tracking-wider shrink-0">Double</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openLessonForm(lesson)} className="text-on-surface-variant hover:text-primary p-1.5 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity" title="Edit lesson">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteLesson(lesson)} className="text-red-500 hover:bg-red-50 p-1.5 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity" title="Remove lesson">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-on-surface-variant truncate">{lesson.teacher_name}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                                <div className={`h-full rounded-full ${placed >= lesson.periods_per_week ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-on-surface-variant">{placed}/{lesson.periods_per_week}</span>
                            </div>
                            <button
                              onClick={() => startPlacing(lesson)}
                              className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md transition-colors ${
                                placingLesson?.id === lesson.id
                                  ? 'bg-primary text-white'
                                  : 'text-primary bg-primary/5 hover:bg-primary/15'
                              }`}
                            >
                              {placingLesson?.id === lesson.id ? 'Placing...' : 'Place on grid'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ MODALS ============ */}

      {/* Create timetable */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary">
              <div>
                <h3 className="text-2xl font-bold text-white">Create Timetable</h3>
                <p className="text-blue-100 text-sm">One per class per term</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Academic Class *</label>
                <select
                  value={createForm.classId}
                  onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                  className={`${inputCls} p-4`}
                >
                  <option value="">Select Class</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}{c.section_display ? ` (${c.section_display})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Term *</label>
                <select
                  value={createForm.termId}
                  onChange={(e) => setCreateForm({ ...createForm, termId: e.target.value })}
                  className={`${inputCls} p-4`}
                >
                  <option value="">Select Term</option>
                  {terms.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} — {yearName(t.id)}</option>
                  ))}
                </select>
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

      {/* Cell editor (add / edit grid lesson) */}
      {cellModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <h3 className="text-xl font-bold">{slotForm.id ? 'Edit Lesson' : 'Add a Lesson'}</h3>
              <button onClick={() => setCellModal(null)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-sm">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="font-bold text-on-surface">{dayLabel(slotForm.day_of_week)}</span>
                <span className="text-on-surface-variant">• {slotForm.start_time} – {slotForm.end_time}</span>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subject *</label>
                <select value={slotForm.subject} onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })} className={`${inputCls} mt-1`}>
                  <option value="">Choose subject</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Teacher *</label>
                <select value={slotForm.teacher} onChange={(e) => setSlotForm({ ...slotForm, teacher: e.target.value })} className={`${inputCls} mt-1`}>
                  <option value="">Choose teacher</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Classroom (optional)</label>
                <input type="text" placeholder="e.g. Room 12" value={slotForm.classroom} onChange={(e) => setSlotForm({ ...slotForm, classroom: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={slotForm.is_locked}
                  onChange={(e) => setSlotForm({ ...slotForm, is_locked: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary,#7c3aed)]"
                />
                <span className="text-sm font-semibold text-on-surface-variant">Keep this lesson when regenerating</span>
              </label>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setCellModal(null)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">Cancel</button>
                <button onClick={handleSaveSlot} disabled={savingSlot} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingSlot ? 'Saving...' : slotForm.id ? 'Save Changes' : 'Add Lesson'}
                </button>
              </div>
              {slotForm.id && (
                <button
                  onClick={() => handleDeleteSlot(selected.slots.find((s: any) => String(s.id) === String(slotForm.id)))}
                  className="w-full text-center py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Remove this lesson from the grid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lesson card editor */}
      {lessonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <h3 className="text-xl font-bold">{lessonForm.id ? 'Edit Lesson' : 'Add Lesson'}</h3>
              <button onClick={() => setLessonModal(false)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subject *</label>
                <select
                  value={lessonForm.subject}
                  onChange={(e) => setLessonForm({ ...lessonForm, subject: e.target.value })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Choose subject</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Teacher *</label>
                <select
                  value={lessonForm.teacher}
                  onChange={(e) => setLessonForm({ ...lessonForm, teacher: e.target.value })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Choose teacher</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Periods per week *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={lessonForm.periods_per_week}
                    onChange={(e) => setLessonForm({ ...lessonForm, periods_per_week: parseInt(e.target.value) || 1 })}
                    className={`${inputCls} mt-1`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Classroom (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab 1"
                    value={lessonForm.note}
                    onChange={(e) => setLessonForm({ ...lessonForm, note: e.target.value })}
                    className={`${inputCls} mt-1`}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lessonForm.is_double}
                  onChange={(e) => setLessonForm({ ...lessonForm, is_double: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary,#7c3aed)]"
                />
                <span className="text-sm font-semibold">Double period (2 consecutive periods — sciences, languages, workshops)</span>
              </label>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setLessonModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">Cancel</button>
                <button onClick={handleSaveLesson} disabled={savingLesson} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingLesson ? 'Saving...' : lessonForm.id ? 'Save Changes' : 'Add Lesson'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* School week editor */}
      {weekModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">School Week</h3>
                <p className="text-sm text-on-surface-variant">
                  {weekScope === 'section' ? 'Applies to every class in the section' : 'Applies to this class'}
                </p>
              </div>
              <button onClick={() => setWeekModal(false)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First period starts</label>
                  <input type="time" value={weekForm.start} onChange={(e) => setWeekForm({ ...weekForm, start: e.target.value })} className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Period length</label>
                  <select value={weekForm.periodLen} onChange={(e) => setWeekForm({ ...weekForm, periodLen: parseInt(e.target.value) })} className={`${inputCls} mt-1`}>
                    {[30, 35, 40, 45, 50, 55, 60].map((m) => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Periods per day</label>
                  <input type="number" min={2} max={14} value={weekForm.count} onChange={(e) => setWeekForm({ ...weekForm, count: Math.max(2, Math.min(14, parseInt(e.target.value) || 2)) })} className={`${inputCls} mt-1`} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Working days</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setWeekForm((wf) => ({
                        ...wf,
                        days: wf.days.includes(String(d.value)) ? wf.days.filter((x) => x !== String(d.value)) : [...wf.days, String(d.value)],
                      }))}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                        weekForm.days.includes(String(d.value))
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {d.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Breaks — each school has its own, with its own length</label>
                  <button
                    onClick={() => setWeekForm((wf) => ({ ...wf, breaks: [...wf.breaks, { time: '10:00', len: 20 }] }))}
                    className="text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-colors"
                  >
                    + Add break
                  </button>
                </div>
                <div className="space-y-2">
                  {weekForm.breaks.length === 0 && (
                    <p className="text-xs text-outline">No breaks — periods run back to back.</p>
                  )}
                  {weekForm.breaks.map((br, i) => (
                    <div key={i} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-outline w-16">Break {i + 1}</span>
                      <input type="time" value={br.time} onChange={(e) => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.map((b, j) => (j === i ? { ...b, time: e.target.value } : b)) }))} className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-outline">for</span>
                      <select value={br.len} onChange={(e) => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.map((b, j) => (j === i ? { ...b, len: parseInt(e.target.value) } : b)) }))} className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((m) => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                      <button onClick={() => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.filter((_, j) => j !== i) }))} className="ml-auto text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-outline mt-2">
                  A break starts right when a period ends (e.g. a 50-min lunch after 12:10 means the next period starts at 13:00). Breaks are counted automatically — double periods never cross them.
                </p>
              </div>
              {/* Preview */}
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-2">Preview</p>
                <div className="flex flex-wrap gap-1.5">
                  {buildPeriods(weekForm).map((p, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-surface-container-highest text-[11px] font-bold text-on-surface-variant">
                      {p.start}–{p.end}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setWeekModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">Cancel</button>
                <button onClick={handleSaveWeek} disabled={savingWeek} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingWeek ? 'Saving...' : weekScope === 'section' ? 'Save for whole section' : 'Save for this class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
