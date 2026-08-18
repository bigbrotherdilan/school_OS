import { useState, useEffect, useRef, useCallback } from 'react';
import { useTeacherStore } from '../../../stores/teacherStore';
import { useTeacherData } from '../../../hooks/useTeacherData';
import { useToastStore } from '../../../stores/toastStore';
import { useAutoSave, type SaveState } from '../../../hooks/useAutoSave';

interface SchemeWeek {
  id: string;
  week_number: number;
  topic: string;
  objectives: string;
  expected_outcome: string;
  essential_knowledge: string;
  homework: string;
  status: 'planned' | 'taught';
  taught_at: string | null;
  teacher_name: string | null;
  notes: string;
  term: string;
  term_name: string;
}

interface Term {
  id: string;
  name: string;
  order_number: number;
  academic_year: string;
  start_date: string | null;
  end_date: string | null;
}

export default function TeacherPlannerPage() {
  const { activeAssignment } = useTeacherStore();
  const { fetchSchemes, updateScheme, markTaught, markPlanned, fetchTerms } = useTeacherData();
  const { addToast } = useToastStore();

  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [weeks, setWeeks] = useState<SchemeWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notesRef = useRef<Record<string, string>>({});
  const lastEditedWeekId = useRef<string | null>(null);

  // Load terms once (for the assignment's academic year)
  useEffect(() => {
    let cancelled = false;
    fetchTerms().then((all) => {
      if (cancelled) return;
      const mine = all.filter((t) => t.academic_year === activeAssignment?.academic_year);
      setTerms(mine);
      setSelectedTerm((prev) => prev || currentTerm(mine) || mine[0]?.id || '');
    });
    return () => { cancelled = true; };
  }, [activeAssignment?.academic_year]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTerm = (list: Term[]) =>
    list.find((t) => {
      if (!t.start_date || !t.end_date) return false;
      const now = new Date();
      return new Date(t.start_date) <= now && now <= new Date(t.end_date);
    })?.id;

  // Load the plan for the selected term
  useEffect(() => {
    if (!activeAssignment || !selectedTerm) return;
    let cancelled = false;
    setLoading(true);
    fetchSchemes({
      subject: activeAssignment.subject,
      class_obj: activeAssignment.academic_class,
      term: selectedTerm,
    }).then((rows) => {
      if (cancelled) return;
      setWeeks(rows);
      rows.forEach((r: SchemeWeek) => { notesRef.current[r.id] = r.notes || ''; });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeAssignment, selectedTerm, fetchSchemes]);

  const doSaveNotes = useCallback(async () => {
    const id = lastEditedWeekId.current;
    if (!id) return;
    await updateScheme(id, { notes: notesRef.current[id] || '' });
  }, [updateScheme]);

  const { saveState, markDirty, triggerSave, clearPending } = useAutoSave(doSaveNotes);

  const handleNotesChange = (id: string, value: string) => {
    notesRef.current[id] = value;
    setWeeks((prev) => prev.map((w) => (w.id === id ? { ...w, notes: value } : w)));
    lastEditedWeekId.current = id;
    markDirty();
  };

  const handleToggle = async (week: SchemeWeek, toTaught: boolean) => {
    if (busyId) return;
    setBusyId(week.id);
    clearPending();
    if (lastEditedWeekId.current === week.id) {
      await updateScheme(week.id, { notes: notesRef.current[week.id] || '' }).catch(() => {});
    }
    try {
      const updated = toTaught ? await markTaught(week.id) : await markPlanned(week.id);
      setWeeks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      notesRef.current[updated.id] = updated.notes || '';
      if (toTaught) addToast(`Week ${week.week_number} marked as taught.`, 'success');
      else addToast(`Week ${week.week_number} returned to planned.`, 'info');
    } catch (e: any) {
      addToast(e.response?.data?.detail || 'Could not update this week.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const taughtCount = weeks.filter((w) => w.status === 'taught').length;
  const progress = weeks.length ? Math.round((taughtCount / weeks.length) * 100) : 0;

  const weekOfToday = (() => {
    const term = terms.find((t) => t.id === selectedTerm);
    if (!term?.start_date) return null;
    const diff = Math.floor((Date.now() - new Date(term.start_date).getTime()) / (7 * 86400000));
    return Math.max(0, diff) + 1;
  })();

  if (!activeAssignment) {
    return (
      <div className="p-10 text-center text-slate-500 font-medium">
        No active class/subject selected. Pick an assignment to see your lesson plan.
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Lesson Planner</h2>
          <p className="text-slate-500 text-sm mt-1">
            {activeAssignment.class_name} &bull; {activeAssignment.subject_name} — your plan for the term
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Term
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            >
              {terms.length === 0 && <option value="">No terms</option>}
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full ${
            progress === 100 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-secondary/10 text-secondary'
          }`}>
            <span className="material-symbols-outlined text-sm">trending_up</span>
            {taughtCount}/{weeks.length} weeks • {progress}%
          </div>
        </div>
      </section>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between text-sm font-bold text-slate-600 mb-3">
          <span>Term progress</span>
          <span className="text-primary">{progress}% covered</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Mark a week <b>Done</b> when you have covered it — this is your signature of record for work coverage.
        </p>
      </div>

      {/* Weeks */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 font-medium">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
          Loading your lesson plan...
        </div>
      ) : weeks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl text-slate-300">menu_book</span>
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">No lessons planned yet</h4>
          <p className="text-sm text-slate-500 max-w-md">
            Your school office hasn't filled in the year plan for this class and subject yet.
            Once they do, every week will show up here for you to mark as done.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => {
            const isThisWeek = weekOfToday === week.week_number;
            return (
              <div key={week.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                isThisWeek ? 'border-primary/40 ring-1 ring-primary/20' : 'border-slate-100'
              }`}>
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${
                    week.status === 'taught' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className="text-lg leading-none">{week.week_number}</span>
                    <span className="text-[9px] uppercase tracking-wider">Week</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">{week.topic}</h4>
                      {isThisWeek && (
                        <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">This week</span>
                      )}
                      {week.status === 'taught' ? (
                        <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">verified</span> Done
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Planned</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      {week.objectives && <Field icon="outbound" label="Objectives" value={week.objectives} />}
                      {week.expected_outcome && <Field icon="flag" label="Expected outcome" value={week.expected_outcome} />}
                      {week.essential_knowledge && <Field icon="lightbulb" label="Essential knowledge" value={week.essential_knowledge} />}
                      {week.homework && <Field icon="home_work" label="Homework" value={week.homework} />}
                    </div>
                    {week.status === 'taught' && week.teacher_name && (
                      <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">how_to_reg</span>
                        Recorded by {week.teacher_name} on {week.taught_at ? new Date(week.taught_at).toLocaleString() : ''}
                      </p>
                    )}
                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1.5">
                        <span className="material-symbols-outlined text-sm">edit_note</span> My teaching notes
                      </label>
                      <textarea
                        value={week.notes}
                        onChange={(e) => handleNotesChange(week.id, e.target.value)}
                        rows={2}
                        placeholder="What actually happened in class, anything to remember..."
                        className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all leading-relaxed resize-y"
                      />
                      <SaveChip state={saveState} />
                    </div>
                  </div>
                  <div className="sm:ml-auto">
                    {week.status === 'taught' ? (
                      <button
                        onClick={() => handleToggle(week, false)}
                        disabled={busyId === week.id}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 shadow-sm flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-sm">undo</span> Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggle(week, true)}
                        disabled={busyId === week.id}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
                      >
                        {busyId === week.id
                          ? <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          : <span className="material-symbols-outlined text-sm">check_circle</span>}
                        Mark as Done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
        <span className="material-symbols-outlined text-sm">{icon}</span> {label}
      </p>
      <p className="text-sm text-slate-700 whitespace-pre-line">{value}</p>
    </div>
  );
}

function SaveChip({ state }: { state: SaveState }) {
  if (state === 'saved') return null;
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
      state === 'saving' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`material-symbols-outlined text-sm ${state === 'saving' ? 'animate-spin' : ''}`}>
        {state === 'saving' ? 'sync' : 'edit'}
      </span>
      {state === 'saving' ? 'Saving...' : 'Unsaved changes'}
    </div>
  );
}
