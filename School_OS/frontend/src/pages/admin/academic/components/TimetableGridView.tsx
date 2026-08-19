import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../services/api';
import { useToastStore } from '../../../../stores/toastStore';
import {
  ArrowLeft,
  Trash2,
  Pencil,
  CalendarDays,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  LayoutGrid,
  BookOpen,
  ShieldCheck,
  Users
} from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
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
  student_group: '',
  room: '',
  classroom: '',
  is_locked: false,
};

const EMPTY_LESSON_FORM = {
  id: null as string | null,
  subject: '',
  teacher: '',
  student_group: '',
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

interface TimetableGridViewProps {
  initialSelected: any;
  onBack: () => void;
  subjects: any[];
  teachers: any[];
}

export default function TimetableGridView({
  initialSelected,
  onBack,
  subjects,
  teachers,
}: TimetableGridViewProps) {
  const { t } = useTranslation('adminAcademic');
  const [selected, setSelected] = useState(initialSelected);
  const [tab, setTab] = useState<'grid' | 'lessons'>('grid');
  const [detailLoading, setDetailLoading] = useState(false);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);

  // Modals / states
  const [cellModal, setCellModal] = useState<boolean | null>(null);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM);
  const [savingSlot, setSavingSlot] = useState(false);

  const [lessonModal, setLessonModal] = useState(false);
  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON_FORM);
  const [savingLesson, setSavingLesson] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allocationForm, setAllocationForm] = useState({ teacher: '', periods: 1, is_double: false });
  const [savingAllocation, setSavingAllocation] = useState(false);

  const [weekModal, setWeekModal] = useState(false);
  const [weekForm, setWeekForm] = useState<WeekForm>(DEFAULT_WEEK);
  const [weekScope, setWeekScope] = useState<'class' | 'section'>('class');
  const [savingWeek, setSavingWeek] = useState(false);

  const [placingLesson, setPlacingLesson] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState(false);
  const [approving, setApproving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [hoursSaving, setHoursSaving] = useState<Record<string, boolean>>({});
  const [issues, setIssues] = useState<any[] | null>(null);

  const addToast = useToastStore((s) => s.addToast);

  // Load detailed timetable info on mount
  const loadDetail = async (ttId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/timetable/timetables/${ttId}/`);
      setSelected(res.data);
      // load class subjects
      const csRes = await api.get('/academic/class-subjects/', {
        params: { academic_class: res.data.class_obj },
      });
      setClassSubjects(csRes.data.results || csRes.data);
    } catch (err: any) {
      addToast(t('Failed to load timetable details.'), 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selected?.id) {
      loadDetail(selected.id);
    }
  }, [selected?.id]);

  const daysOf = (tt: any) => (tt?.working_days?.length ? tt.working_days : [1, 2, 3, 4, 5]);
  const periodsOf = (tt: any) => (tt?.periods?.length ? tt.periods : DEFAULT_PERIODS);

  const dayLabel = (val: number) => DAYS.find((d) => d.value === val)?.label || `Day ${val}`;
  const dayShort = (val: number) => t(dayLabel(val)).slice(0, 3);
  const teacherLabel = (t: any) => t.user?.full_name || t.employee_id || `#${t.id}`;

  const slotsAt = (day: number, periodIdx: number) => {
    const period = periodsOf(selected)[periodIdx];
    if (!period) return [];
    return (selected.slots || []).filter(
      (s: any) =>
        s.day_of_week === day &&
        s.start_time.slice(0, 5) === period.start &&
        s.end_time.slice(0, 5) === period.end
    );
  };

  const colorOf = (subj: any) => {
    const id = typeof subj === 'object' ? subj?.id : subj;
    if (!id) return PALETTE[8];
    const sId = String(id);
    let hash = 0;
    for (let i = 0; i < sId.length; i++) hash = sId.charCodeAt(i) + ((hash << 5) - hash);
    const idx = Math.abs(hash) % PALETTE.length;
    return PALETTE[idx];
  };

  // Student-group chip for a slot. Hidden when the class has no groups.
  const groupChip = (slot: any) => {
    if (!(selected.student_groups?.length > 0)) return null;
    const g = slot.group_details;
    const fg = colorOf(slot.subject)[1];
    if (!g) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.6)', color: fg }}>
          {t('Full cohort')}
        </span>
      );
    }
    const [, gFg] = colorOf({ id: g.id });
    return (
      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.6)', color: gFg }}>
        {g.name}
      </span>
    );
  };

  const statusPill = (tt: any) => {
    switch (tt?.generation_status) {
      case 'published':
        return <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Published')}</span>;
      case 'approved':
        return <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Approved')}</span>;
      case 'under_review':
        return <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Under Review')}</span>;
      case 'generated':
        return <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Generated')}</span>;
      case 'relaxed':
        return <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Has Clashes')}</span>;
      case 'infeasible':
        return <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Infeasible')}</span>;
      default:
        return <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{t('Draft')}</span>;
    }
  };

  // ── Manual-edit cell state (RED/YELLOW/GRAY/GREEN) ───────────────────
  const slotState = (slot: any) => selected?.cell_states?.[String(slot.id)] || null;
  const CELL_STATE_META: Record<string, { ring: string; dot: string; label: string }> = {
    red: { ring: 'ring-2 ring-red-500', dot: 'bg-red-600', label: 'Clash' },
    yellow: { ring: 'ring-2 ring-amber-400', dot: 'bg-amber-400', label: 'Availability' },
    gray: { ring: 'ring-2 ring-outline', dot: 'bg-outline', label: 'No teacher (TBD)' },
    green: { ring: '', dot: 'bg-green-500', label: 'Valid' },
  };
  const stateMeta = (level: string) => CELL_STATE_META[level] || CELL_STATE_META.green;
  const stateTooltip = (slot: any) => {
    const st = slotState(slot);
    if (!st?.conflicts?.length) return '';
    return st.conflicts.map((c: any) => c.message).join('\n');
  };

  // Grid editing operations
  const toggleLock = async (slot: any) => {
    try {
      const nextLocked = !slot.is_locked;
      await api.patch(`/timetable/time-slots/${slot.id}/`, { is_locked: nextLocked });
      addToast(nextLocked ? t('Slot locked.') : t('Slot unlocked.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(t('Failed to toggle lock.'), 'error');
    }
  };

  const handleDeleteSlot = async (slot: any) => {
    if (!window.confirm(t('Delete this slot from the grid?'))) return;
    try {
      await api.delete(`/timetable/time-slots/${slot.id}/`);
      addToast(t('Slot deleted.'), 'success');
      setCellModal(null);
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(t('Failed to delete slot.'), 'error');
    }
  };

  const openCellModal = (day: number, periodIdx: number, slot?: any) => {
    const period = periodsOf(selected)[periodIdx];
    if (slot) {
      setSlotForm({
        id: slot.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
        subject: slot.subject || '',
        teacher: slot.teacher || '',
        student_group: slot.student_group || '',
        room: slot.room || '',
        classroom: slot.classroom || '',
        is_locked: slot.is_locked,
      });
    } else {
      setSlotForm({
        ...EMPTY_SLOT_FORM,
        day_of_week: day,
        start_time: period.start,
        end_time: period.end,
      });
    }
    setCellModal(true);
  };

  const handleSaveSlot = async () => {
    if (!slotForm.subject || !slotForm.teacher) {
      addToast(t('Please fill in subject and teacher.'), 'warning');
      return;
    }
    setSavingSlot(true);
    try {
      const payload = {
        timetable: selected.id,
        day_of_week: slotForm.day_of_week,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        subject: slotForm.subject,
        teacher: slotForm.teacher,
        student_group: slotForm.student_group || null,
        room: slotForm.room || null,
        classroom: slotForm.classroom,
        is_locked: slotForm.is_locked,
      };
      if (slotForm.id) {
        await api.put(`/timetable/time-slots/${slotForm.id}/`, payload);
        addToast(t('Lesson updated.'), 'success');
      } else {
        await api.post('/timetable/time-slots/', payload);
        addToast(t('Lesson added.'), 'success');
      }
      setCellModal(null);
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to save slot.'), 'error');
    } finally {
      setSavingSlot(false);
    }
  };

  // Lesson Card editing
  const openLessonForm = (lesson?: any) => {
    if (lesson) {
      setLessonForm({
        id: lesson.id,
        subject: lesson.subject || '',
        teacher: lesson.teacher || '',
        student_group: lesson.student_group || '',
        periods_per_week: lesson.periods_per_week,
        is_double: lesson.is_double,
        note: lesson.note || '',
      });
      setAllocations(lesson.allocations || []);
      setAllocationForm({ teacher: '', periods: 1, is_double: false });
    } else {
      setLessonForm(EMPTY_LESSON_FORM);
      setAllocations([]);
    }
    setLessonModal(true);
  };

  const handleAddAllocation = async () => {
    if (!lessonForm.id) return;
    if (!allocationForm.teacher) {
      addToast(t('Choose a teacher for the split (or leave TBD by editing later).'), 'warning');
      return;
    }
    setSavingAllocation(true);
    try {
      const res = await api.post('/timetable/allocations/', {
        lesson: lessonForm.id,
        teacher: allocationForm.teacher,
        periods: allocationForm.periods,
        is_double: allocationForm.is_double,
      });
      setAllocations([...allocations, res.data]);
      setAllocationForm({ teacher: '', periods: 1, is_double: false });
      addToast(t('Teacher split added.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to add teacher split.'), 'error');
    } finally {
      setSavingAllocation(false);
    }
  };

  const handleDeleteAllocation = async (allocation: any) => {
    try {
      await api.delete(`/timetable/allocations/${allocation.id}/`);
      setAllocations(allocations.filter((a) => a.id !== allocation.id));
      addToast(t('Teacher split removed.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(t('Failed to remove teacher split.'), 'error');
    }
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.subject) {
      addToast(t('Please select a subject.'), 'warning');
      return;
    }
    setSavingLesson(true);
    try {
      const payload = {
        timetable: selected.id,
        subject: lessonForm.subject,
        teacher: lessonForm.teacher || null,
        student_group: lessonForm.student_group || null,
        periods_per_week: lessonForm.periods_per_week,
        is_double: lessonForm.is_double,
        note: lessonForm.note,
      };
      if (lessonForm.id) {
        await api.put(`/timetable/lessons/${lessonForm.id}/`, payload);
        addToast(t('Lesson updated.'), 'success');
      } else {
        await api.post('/timetable/lessons/', payload);
        addToast(t('Lesson added.'), 'success');
      }
      setLessonModal(false);
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to save lesson.'), 'error');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lesson: any) => {
    if (!window.confirm(t('Delete all cards of {{name}}? This removes them from the grid too.', { name: lesson.subject_name }))) return;
    try {
      await api.delete(`/timetable/lessons/${lesson.id}/`);
      addToast(t('Lesson deleted.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(t('Failed to delete lesson.'), 'error');
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      await api.post(`/timetable/timetables/${selected.id}/suggest/`);
      addToast(t('Lessons built successfully from subject hours.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to build lessons.'), 'error');
    } finally {
      setSuggesting(false);
    }
  };

  // Place Lesson manually
  const startPlacing = (lesson: any) => {
    if (placingLesson?.id === lesson.id) {
      setPlacingLesson(null);
    } else {
      setPlacingLesson(lesson);
      addToast(t('Click any free cell to place {{name}}.', { name: lesson.subject_name }), 'info');
    }
  };

  const placeLessonAt = async (day: number, periodIdx: number) => {
    if (!placingLesson) return;
    const period = periodsOf(selected)[periodIdx];
    try {
      await api.post('/timetable/time-slots/', {
        timetable: selected.id,
        lesson: placingLesson.id,
        day_of_week: day,
        start_time: period.start,
        end_time: period.end,
        subject: placingLesson.subject,
        teacher: placingLesson.teacher || null,
        student_group: placingLesson.student_group || null,
        classroom: placingLesson.note || '',
      });
      addToast(t('Placed {{name}}.', { name: placingLesson.subject_name }), 'success');
      setPlacingLesson(null);
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to place lesson.'), 'error');
    }
  };

  // Week Editor operations
  const openWeekEditor = (scope: 'class' | 'section') => {
    setWeekScope(scope);
    setWeekForm(weekFromTimetable(selected));
    setWeekModal(true);
  };

  const handleSaveWeek = async () => {
    setSavingWeek(true);
    const periods = buildPeriods(weekForm);
    const days = weekForm.days.map(Number).sort();
    try {
      if (scopeIsSection()) {
        await api.post('/timetable/timetables/create_for_section/', {
          stream: selected.class_details?.stream || 'none',
          academic_year: selected.academic_year,
          periods,
          working_days: days,
        });
        addToast(t('Week setup saved for the whole section.'), 'success');
      } else {
        await api.patch(`/timetable/timetables/${selected.id}/`, {
          periods,
          working_days: days,
        });
        addToast(t('Week setup saved for this class.'), 'success');
      }
      setWeekModal(false);
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to save school week.'), 'error');
    } finally {
      setSavingWeek(false);
    }
  };

  const scopeIsSection = () => weekScope === 'section' || selected.class_details?.stream;

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await api.get(`/timetable/timetables/${selected.id}/validate/`);
      setIssues(res.data.issues);
      if (res.data.valid) {
        addToast(t('Timetable is valid and clash-free!'), 'success');
      } else {
        addToast(t('Found {{count}} clashes/issues.', { count: res.data.issues.length }), 'warning');
      }
    } catch (err: any) {
      addToast(t('Failed to validate timetable.'), 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(
      t('Approve this timetable? Its teachers and rooms become RESERVED school-wide — every other section will generate around it.')
    )) return;
    setApproving(true);
    try {
      const res = await api.post(`/timetable/timetables/${selected.id}/approve/`);
      addToast(res.data.message || t('Timetable approved.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to approve timetable.'), 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleUnderReview = async () => {
    try {
      const res = await api.post(`/timetable/timetables/${selected.id}/under_review/`);
      addToast(res.data.message || t('Timetable moved to under review.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to update status.'), 'error');
    }
  };

  const handleToggleActive = async () => {
    try {
      const nextActive = !selected.is_active;
      await api.patch(`/timetable/timetables/${selected.id}/`, { is_active: nextActive });
      setSelected((prev: any) => ({ ...prev, is_active: nextActive }));
      addToast(nextActive ? t('Timetable active/published.') : t('Timetable saved as draft.'), 'success');
    } catch (err: any) {
      addToast(t('Failed to toggle status.'), 'error');
    }
  };

  const handleDeleteTimetable = async (tt: any) => {
    if (!window.confirm(t('Delete timetable for {{name}}? This deletes all scheduled slots.', { name: tt.class_name }))) return;
    try {
      await api.delete(`/timetable/timetables/${tt.id}/`);
      addToast(t('Timetable deleted.'), 'success');
      onBack();
    } catch (err: any) {
      addToast(t('Failed to delete timetable.'), 'error');
    }
  };

  const handleGenerateSection = async () => {
    if (!singleClassSection(selected)) {
      const ok = window.confirm(
        `${t('Regenerate the whole {{section}} section together?', { section: selected.section_name })}\n\n` +
        t('All classes of this section are solved in one pass, so a shared teacher is never double-booked. Locked slots stay fixed and committed slots of other sections stay reserved.')
      );
      if (!ok) return;
    }
    setGeneratingSection(true);
    try {
      const res = await api.post('/timetable/timetables/generate_school/', {
        academic_year: selected.academic_year,
        stream: selected.class_details?.stream || 'none',
      });
      addToast(res.data.message || t('Timetable generated successfully.'), 'success');
      loadDetail(selected.id);
    } catch (err: any) {
      const reason = err.response?.data?.detail || err.response?.data?.message;
      addToast(
        reason
          ? t('{{reason}} — The button is ready again; fix it and regenerate, or retry for a different combination.', { reason })
          : t('Failed to generate timetable.'),
        'error'
      );
    } finally {
      setGeneratingSection(false);
    }
  };

  const singleClassSection = (tt: any) => !tt.class_details?.stream;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Detail header card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface"
              title={t('Back to list')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-on-surface">{selected.class_name}</h3>
                {statusPill(selected)}
              </div>
              <p className="text-sm text-on-surface-variant">
                {selected.academic_year_name} • {selected.section_name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateSection}
              disabled={generatingSection || selected.lessons?.length === 0}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
              title={singleClassSection(selected)
                ? t('Generate this class timetable')
                : t('Regenerate the whole {{section}} section in one pass (clash-free)', { section: selected.section_name })}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generatingSection ? t('Solving...') : selected.generation_status === 'generated'
                ? (singleClassSection(selected) ? t('Regenerate') : t('Regenerate section'))
                : (singleClassSection(selected) ? t('Generate timetable') : t('Generate section'))}
            </button>
            <button
              onClick={() => setTab('lessons')}
              className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-primary bg-primary/5 border border-primary/30 hover:bg-primary/15 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 inline mr-1" /> {t('Edit hours & lessons')}
            </button>
            {selected.is_committed ? (
              <span
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-300 text-green-700 text-xs font-black uppercase tracking-widest"
                title={selected.approved_by_name ? t('Approved by {{name}}', { name: selected.approved_by_name }) : t('Committed to the school schedule')}
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('Committed — resources reserved')}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                {selected.generation_status === 'generated' && (
                  <button
                    onClick={handleUnderReview}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 border border-indigo-300 hover:bg-indigo-500/20 transition-colors"
                    title={t('Mark as the working draft for manual editing (reserves nothing school-wide)')}
                  >
                    {t('Under review')}
                  </button>
                )}
                <button
                  onClick={handleApprove}
                  disabled={approving || !selected.slots?.length}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-green-600 text-white shadow-lg shadow-green-600/25 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-40"
                  title={t('Validate (RED clashes block) then commit teachers/rooms to the school schedule')}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {approving ? t('Approving...') : t('Approve & commit')}
                </button>
              </div>
            )}
            <button
              onClick={handleToggleActive}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${selected.is_active ? 'bg-secondary/10 text-secondary hover:bg-secondary/20' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {selected.is_active ? t('● Published') : t('○ Draft')}
            </button>
            <button
              onClick={() => openWeekEditor('class')}
              className="px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              {t('Week: {{days}} days × {{periods}} periods', { days: daysOf(selected).length, periods: periodsOf(selected).length })}
            </button>
            <button
              onClick={() => handleDeleteTimetable(selected)}
              className="px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
            >
              {t('Delete')}
            </button>
          </div>
        </div>
        {!singleClassSection(selected) && (
          <p className="mt-3 text-xs text-on-surface-variant bg-surface-container-low rounded-xl px-4 py-2.5">
            {t('This class is generated together with its whole')} <b>{selected.section_name}</b> {t('section —')}
            <b> {t('Regenerate section')}</b> {t('re-solves all of its classes in one pass from the same lessons, so a shared teacher is never double-booked. Locked slots stay fixed; committed slots of other sections stay reserved.')}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('grid')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-black uppercase tracking-widest transition-colors ${tab === 'grid' ? 'bg-surface-container-lowest text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <LayoutGrid className="w-4 h-4" /> {t('Timetable Grid')}
        </button>
        <button
          onClick={() => setTab('lessons')}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-black uppercase tracking-widest transition-colors ${tab === 'lessons' ? 'bg-surface-container-lowest text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <BookOpen className="w-4 h-4" /> {t('Lessons & Hours')}
        </button>
      </div>

      {/* ============ TAB: GRID ============ */}
      {tab === 'grid' && (
        <div className="bg-surface-container-lowest rounded-t-2xl rounded-b-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          {/* Grid toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-on-surface-variant">
                {t('{{days}} — {{count}} periods/day', { days: daysOf(selected).map(dayShort).join(' • '), count: periodsOf(selected).length })}
              </span>
              {placingLesson && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                  {t('Placing {{name}} — click a free cell', { name: placingLesson.subject_name })}
                  <button onClick={() => setPlacingLesson(null)} className="hover:opacity-70">✕</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-3 mr-1">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant"><span className="w-2 h-2 rounded-full bg-red-600" /> {t('Clash')}</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t('Availability')}</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant"><span className="w-2 h-2 rounded-full bg-outline" /> {t('TBD')}</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant"><span className="w-2 h-2 rounded-full bg-green-500" /> {t('OK')}</span>
              </div>
              <button
                onClick={handleValidate}
                disabled={validating || selected.slots?.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-variant transition-colors disabled:opacity-40"
              >
                {validating ? t('Checking...') : t('Check for clashes')}
              </button>
              <button
                onClick={() => openWeekEditor('class')}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                {t('Edit school week')}
              </button>
            </div>
          </div>

          {/* Status banner */}
          {selected.generation_status === 'generated' && selected.generation_message && (
            <div className="flex items-start gap-3 bg-green-50 border-b border-green-200 px-5 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-green-800">{t('Timetable generated — clash-free')}</p>
                <p className="text-sm text-green-700 whitespace-pre-line">{selected.generation_message}</p>
              </div>
            </div>
          )}
          {selected.generation_status === 'infeasible' && selected.generation_message && (
            <div className="flex items-start gap-3 bg-red-50 border-b border-red-200 px-5 py-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-800">{t('The week cannot be scheduled as configured')}</p>
                <p className="text-sm text-red-700 whitespace-pre-line">{selected.generation_message}</p>
              </div>
            </div>
          )}
          {issues !== null && issues.length === 0 && (
            <div className="flex items-start gap-3 bg-green-50 border-b border-green-200 px-5 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-green-800">{t('✓ No clashes. The grid is clean.')}</p>
            </div>
          )}
          {issues !== null && issues.length > 0 && (
            <div className="border-b border-outline-variant/10 px-5 py-3 space-y-2">
              <p className="text-sm font-bold text-amber-700">{issues.length} {t(issues.length > 1 ? 'issues found:' : 'issue found:')}</p>
              {issues.map((issue: any, i: number) => (
                <div key={i} className={`rounded-xl px-4 py-2.5 text-xs border ${issue.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800' : issue.severity === 'info' ? 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {detailLoading ? (
            <div className="text-center py-16 text-on-surface-variant">{t('Loading lessons...')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[920px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface-container-lowest text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-outline w-24">
                      {t('Period')}
                    </th>
                    {daysOf(selected).map((d: number) => (
                      <th key={d} className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-outline">
                        {t(dayLabel(d))}
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
                          {isBreak && <span className="block text-[9px] font-normal text-outline">{t('break')}</span>}
                        </td>
                        {daysOf(selected).map((d: number) => {
                          const slots = slotsAt(d, p);
                          const [bg] = slots[0] ? colorOf(slots[0].subject) : ['transparent', 'transparent'];
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
                              {slots.map((slot: any) => {
                                const [cBg, cFg] = colorOf(slot.subject);
                                const st = slotState(slot);
                                const meta = stateMeta(st?.level);
                                return (
                                <div
                                  key={slot.id}
                                  title={stateTooltip(slot) || undefined}
                                  className={`rounded-lg p-2 relative group/slot ${continuation ? 'opacity-80' : ''} ${meta.ring} ${st?.level === 'gray' ? 'border border-dashed border-outline' : ''}`}
                                  style={{ background: continuation ? bg : cBg }}
                                >
                                  {st?.level && st.level !== 'green' && (
                                    <span className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full ${meta.dot} ring-2 ring-white z-10`} title={t(meta.label)} />
                                  )}
                                  {!continuation ? (
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="font-black text-xs leading-tight" style={{ color: cFg }}>{slot.subject_name}</p>
                                      {slot.is_locked && <Lock className="w-3 h-3 shrink-0" style={{ color: cFg }} />}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-black text-on-surface-variant">{t('↳ cont.')}</p>
                                  )}
                                  <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                                    {slot.teacher_name}
                                    {!slot.teacher && <span className="ml-1 px-1 py-px rounded bg-white/60 text-[8px] font-black uppercase tracking-wider text-on-surface-variant">{t('TBD')}</span>}
                                  </p>
                                  {!continuation && (
                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                      {groupChip(slot)}
                                    </div>
                                  )}
                                  {slot.classroom && <p className="text-[9px] text-outline mt-0.5">🏫 {slot.classroom}</p>}
                                  {slot.room_name && <p className="text-[9px] text-outline mt-0.5">📍 {slot.room_name}</p>}
                                  <div className="absolute top-1 right-1 hidden group-hover/slot:flex gap-0.5 bg-white/95 rounded-md p-0.5 shadow-md z-10">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleLock(slot); }}
                                      title={slot.is_locked ? t('Unlock') : t('Lock (kept on regenerate)')}
                                      className="p-1 rounded hover:bg-black/5"
                                    >
                                      {slot.is_locked ? <Unlock className="w-3 h-3 text-amber-600" /> : <Lock className="w-3 h-3 text-on-surface-variant" />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); openCellModal(d, p, slot); }} title={t('Edit')} className="p-1 rounded hover:bg-black/5">
                                      <Pencil className="w-3 h-3 text-on-surface-variant" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot); }} title={t('Remove')} className="p-1 rounded hover:bg-black/5">
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    </button>
                                  </div>
                                </div>
                                );
                              })}
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
                <h3 className="text-lg font-bold">{t('Weekly hours')}</h3>
                <p className="text-sm text-on-surface-variant">{t('Hours per subject for this class, plus double-period flags.')}</p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                {t('{{count}} h/wk', { count: classSubjects.reduce((s: number, cs: any) => s + (cs.weekly_hours || 0), 0) })}
              </span>
            </div>
            <div className="space-y-2 mt-4 max-h-96 overflow-y-auto pr-1">
              {classSubjects.length === 0 && (
                <p className="text-xs text-outline bg-surface-container-low rounded-xl p-4">
                  {t('No subjects linked to this class yet. Link subjects to the class first.')}
                </p>
              )}
              {classSubjects.map((cs: any) => (
                <div key={cs.id} className="flex items-center justify-between gap-3 bg-surface-container-low rounded-xl px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {cs.subject_name}
                      {cs.group_name && <span className="ml-2 px-1.5 py-0.5 bg-secondary/10 text-secondary rounded text-[8px] font-black uppercase tracking-wider align-middle">{cs.group_name}</span>}
                    </p>
                    <p className="text-[10px] text-outline">{t('coeff {{coeff}}', { coeff: cs.coefficient })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-[10px] font-black uppercase tracking-wider transition-colors ${cs.is_double === true ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container'}`} title={t('Run as 2 consecutive periods')}>
                      <input
                        type="checkbox"
                        checked={cs.is_double === true}
                        onChange={(e) => {
                          const val = e.target.checked ? true : null;
                          setClassSubjects((list) => list.map((x) => (x.id === cs.id ? { ...x, is_double: val } : x)));
                          api.patch(`/academic/class-subjects/${cs.id}/`, { is_double: val }).catch((err: any) => {
                            addToast(err.response?.data?.detail || t('Failed to save double setting.'), 'error');
                            setClassSubjects((list) => list.map((x) => (x.id === cs.id ? { ...x, is_double: cs.is_double } : x)));
                          });
                        }}
                        className="hidden"
                      />
                      {t('Double')}
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
                              addToast(t('{{name}}: {{hours}} h/week saved.', { name: cs.subject_name, hours: v }), 'success');
                            })
                            .catch((err: any) => addToast(err.response?.data?.detail || t('Failed to save weekly hours.'), 'error'))
                            .finally(() => setHoursSaving((s) => { const n = { ...s }; delete n[`d-${cs.id}`]; return n; }));
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-14 bg-white border border-outline-variant/30 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-[10px] text-outline w-8">{t('h/wk')}</span>
                    {hoursSaving[`d-${cs.id}`] && <span className="text-[10px] text-primary animate-pulse">{t('saving')}</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-outline mt-3">
              {t('Changes save automatically. Press')} <b>{t('Suggest')}</b> {t('to turn these hours into lesson cards.')}
            </p>
          </div>

          {/* Lessons */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-lg font-bold">{t('Lessons to schedule')}</h3>
                <p className="text-sm text-on-surface-variant">{t('One card per subject. Doubles stay consecutive and never cross a break.')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openLessonForm(null)}
                  className="text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-colors"
                >
                  {t('+ Add')}
                </button>
                <button
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5" /> {suggesting ? t('Building...') : t('Suggest from hours')}
                </button>
              </div>
            </div>
            <div className="space-y-2 mt-4 max-h-96 overflow-y-auto pr-1">
              {selected.lessons?.length === 0 && (
                <p className="text-xs text-outline bg-surface-container-low rounded-xl p-4">
                  {t('No lessons yet. Set weekly hours, then press')} <b>{t('Suggest from hours')}</b> {t('— or add lessons manually.')}
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
                        {lesson.group_name && (
                          <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary rounded text-[9px] font-black uppercase tracking-wider shrink-0">{lesson.group_name}</span>
                        )}
                        {lesson.is_double && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-black uppercase tracking-wider shrink-0">{t('Double')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openLessonForm(lesson)} className="text-on-surface-variant hover:text-primary p-1.5 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity" title={t('Edit lesson')}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteLesson(lesson)} className="text-red-500 hover:bg-red-50 p-1.5 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity" title={t('Remove lesson')}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="min-w-0">
                        <p className="text-xs text-on-surface-variant truncate">
                          {lesson.teacher_name}
                          {lesson.teacher_status === 'UNASSIGNED' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-surface-container-highest text-[8px] font-black uppercase tracking-wider">{t('TBD')}</span>
                          )}
                        </p>
                        {lesson.allocations?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            <Users className="w-3 h-3 text-outline" />
                            {lesson.allocations.map((a: any) => (
                              <span key={a.id} className="px-1.5 py-0.5 rounded bg-primary/5 border border-primary/20 text-[9px] font-bold text-primary">
                                {a.teacher_name} ×{a.periods}
                                {a.is_double ? ' ' + t('2-in-a-row') : ''}
                              </span>
                            ))}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                lesson.allocations.reduce((s: number, a: any) => s + a.periods, 0) === lesson.periods_per_week
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {lesson.allocations.reduce((s: number, a: any) => s + a.periods, 0)}/{lesson.periods_per_week}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                          {placingLesson?.id === lesson.id ? t('Placing...') : t('Place on grid')}
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

      {/* ============ MODALS ============ */}

      {/* Cell editor (add / edit grid lesson) */}
      {cellModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <h3 className="text-xl font-bold">{slotForm.id ? t('Edit Lesson') : t('Add a Lesson')}</h3>
              <button onClick={() => setCellModal(null)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-sm">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="font-bold text-on-surface">{t(dayLabel(slotForm.day_of_week))}</span>
                <span className="text-on-surface-variant">• {slotForm.start_time} – {slotForm.end_time}</span>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Subject *')}</label>
                <select value={slotForm.subject} onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })} className={`${inputCls} mt-1`}>
                  <option value="">{t('Choose subject')}</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Teacher *')}</label>
                <select value={slotForm.teacher} onChange={(e) => setSlotForm({ ...slotForm, teacher: e.target.value })} className={`${inputCls} mt-1`}>
                  <option value="">{t('Choose teacher')}</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                </select>
              </div>
              {selected.student_groups?.length > 0 && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Student group')}</label>
                  <select value={slotForm.student_group} onChange={(e) => setSlotForm({ ...slotForm, student_group: e.target.value })} className={`${inputCls} mt-1`}>
                    <option value="">{t('Full cohort (all students)')}</option>
                    {selected.student_groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Room / resource')}</label>
                <select value={slotForm.room} onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })} className={`${inputCls} mt-1`}>
                  <option value="">{t('No specific room')}</option>
                  {selected.rooms?.map((r: any) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (${r.capacity})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Classroom (optional)')}</label>
                <input type="text" placeholder={t('e.g. Room 12')} value={slotForm.classroom} onChange={(e) => setSlotForm({ ...slotForm, classroom: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={slotForm.is_locked}
                  onChange={(e) => setSlotForm({ ...slotForm, is_locked: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary,#7c3aed)]"
                />
                <span className="text-sm font-semibold text-on-surface-variant">{t('Keep this lesson when regenerating')}</span>
              </label>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setCellModal(null)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">{t('Cancel')}</button>
                <button onClick={handleSaveSlot} disabled={savingSlot} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingSlot ? t('Saving...') : slotForm.id ? t('Save Changes') : t('Add Lesson')}
                </button>
              </div>
              {slotForm.id && (
                <button
                  onClick={() => handleDeleteSlot(selected.slots.find((s: any) => String(s.id) === String(slotForm.id)))}
                  className="w-full text-center py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  {t('Remove this lesson from the grid')}
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
              <h3 className="text-xl font-bold">{lessonForm.id ? t('Edit Lesson') : t('Add Lesson')}</h3>
              <button onClick={() => setLessonModal(false)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Subject *')}</label>
                <select
                  value={lessonForm.subject}
                  onChange={(e) => setLessonForm({ ...lessonForm, subject: e.target.value })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">{t('Choose subject')}</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Teacher (optional)')}</label>
                <select
                  value={lessonForm.teacher}
                  onChange={(e) => setLessonForm({ ...lessonForm, teacher: e.target.value })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">{t('Choose teacher')}</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                </select>
              </div>
              {selected.student_groups?.length > 0 && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Student group')}</label>
                  <select
                    value={lessonForm.student_group}
                    onChange={(e) => setLessonForm({ ...lessonForm, student_group: e.target.value })}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">{t('Full cohort (all students)')}</option>
                    {selected.student_groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Periods per week *')}</label>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Classroom (optional)')}</label>
                  <input
                    type="text"
                    placeholder={t('e.g. Lab 1')}
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
                <span className="text-sm font-semibold">{t('Double period (2 consecutive periods)')}</span>
              </label>

              {/* Multi-teacher split (spec §11-13) */}
              {lessonForm.id && (
                <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> {t('Teacher split')}</p>
                      <p className="text-[11px] text-on-surface-variant">{t('Split this subject across teachers. The shares must sum to the weekly volume.')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${allocations.reduce((s: number, a: any) => s + (a.periods || 0), 0) === lessonForm.periods_per_week ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {allocations.reduce((s: number, a: any) => s + (a.periods || 0), 0)}/{lessonForm.periods_per_week}
                    </span>
                  </div>
                  {allocations.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 bg-white border border-outline-variant/20 rounded-xl px-3 py-2">
                      <span className="flex-1 text-xs font-bold truncate">
                        {a.teacher_name}
                        {a.teacher_status === 'UNASSIGNED' && <span className="ml-1.5 px-1 py-px rounded bg-surface-container-highest text-[8px] font-black uppercase tracking-wider">{t('TBD')}</span>}
                      </span>
                      <span className="text-[10px] font-black text-on-surface-variant">{a.periods} {t('p/wk')}{a.is_double ? ' ' + t('• double') : ''}</span>
                      <button onClick={() => handleDeleteAllocation(a)} className="text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors" title={t('Remove split')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {allocations.length === 0 && (
                    <p className="text-[11px] text-outline">{t('No split — this subject is taught entirely by the lesson teacher above.')}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{t('Teacher')}</label>
                      <select
                        value={allocationForm.teacher}
                        onChange={(e) => setAllocationForm({ ...allocationForm, teacher: e.target.value })}
                        className={`${inputCls} mt-1 !py-2`}
                      >
                        <option value="">{t('Choose teacher')}</option>
                        {teachers.map((t: any) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{t('Periods')}</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={allocationForm.periods}
                        onChange={(e) => setAllocationForm({ ...allocationForm, periods: parseInt(e.target.value) || 1 })}
                        className={`${inputCls} mt-1 !py-2`}
                      />
                    </div>
                    <label className="flex items-center gap-1.5 pb-2.5 cursor-pointer text-[10px] font-black uppercase tracking-wider text-on-surface-variant" title={t("Run this teacher's share as 2 consecutive periods")}>
                      <input
                        type="checkbox"
                        checked={allocationForm.is_double}
                        onChange={(e) => setAllocationForm({ ...allocationForm, is_double: e.target.checked })}
                        className="w-4 h-4 accent-[var(--primary,#7c3aed)]"
                      />
                      {t('Double')}
                    </label>
                    <button
                      onClick={handleAddAllocation}
                      disabled={savingAllocation}
                      className="px-3.5 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {savingAllocation ? t('Adding...') : t('Add')}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-4 pt-2">
                <button onClick={() => setLessonModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">{t('Cancel')}</button>
                <button onClick={handleSaveLesson} disabled={savingLesson} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingLesson ? t('Saving...') : lessonForm.id ? t('Save Changes') : t('Add Lesson')}
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
                <h3 className="text-xl font-bold">{t('School Week')}</h3>
                <p className="text-sm text-on-surface-variant">
                  {weekScope === 'section' ? t('Applies to every class in the section') : t('Applies to this class')}
                </p>
              </div>
              <button onClick={() => setWeekModal(false)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('First period starts')}</label>
                  <input type="time" value={weekForm.start} onChange={(e) => setWeekForm({ ...weekForm, start: e.target.value })} className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Period length')}</label>
                  <select value={weekForm.periodLen} onChange={(e) => setWeekForm({ ...weekForm, periodLen: parseInt(e.target.value) })} className={`${inputCls} mt-1`}>
                    {[30, 35, 40, 45, 50, 55, 60].map((m) => (
                      <option key={m} value={m}>{t('{{m}} minutes', { m })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Periods per day')}</label>
                  <input type="number" min={2} max={14} value={weekForm.count} onChange={(e) => setWeekForm({ ...weekForm, count: Math.max(2, Math.min(14, parseInt(e.target.value) || 2)) })} className={`${inputCls} mt-1`} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Working days')}</label>
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
                      {t(d.label).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Breaks')}</label>
                  <button
                    onClick={() => setWeekForm((wf) => ({ ...wf, breaks: [...wf.breaks, { time: '10:00', len: 20 }] }))}
                    className="text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-colors"
                  >
                    {t('+ Add break')}
                  </button>
                </div>
                <div className="space-y-2">
                  {weekForm.breaks.length === 0 && (
                    <p className="text-xs text-outline">{t('No breaks — periods run back to back.')}</p>
                  )}
                  {weekForm.breaks.map((br, i) => (
                    <div key={i} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-outline w-16">{t('Break {{i}}', { i: i + 1 })}</span>
                      <input type="time" value={br.time} onChange={(e) => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.map((b, j) => (j === i ? { ...b, time: e.target.value } : b)) }))} className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-outline">{t('for')}</span>
                      <select value={br.len} onChange={(e) => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.map((b, j) => (j === i ? { ...b, len: parseInt(e.target.value) } : b)) }))} className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((m) => (
                          <option key={m} value={m}>{t('{{m}} min', { m })}</option>
                        ))}
                      </select>
                      <button onClick={() => setWeekForm((wf) => ({ ...wf, breaks: wf.breaks.filter((_, j) => j !== i) }))} className="ml-auto text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-2">{t('Preview')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {buildPeriods(weekForm).map((p, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-surface-container-highest text-[11px] font-bold text-on-surface-variant">
                      {p.start}–{p.end}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setWeekModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">{t('Cancel')}</button>
                <button onClick={handleSaveWeek} disabled={savingWeek} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all disabled:opacity-50">
                  {savingWeek ? t('Saving...') : weekScope === 'section' ? t('Save for whole section') : t('Save for this class')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
