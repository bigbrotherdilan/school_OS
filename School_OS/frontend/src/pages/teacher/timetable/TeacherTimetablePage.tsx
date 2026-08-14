import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTeacherData } from '../../../hooks/useTeacherData';
import { useToastStore } from '../../../stores/toastStore';
import { api } from '../../../services/api';

interface Session {
  id: string;
  subject: string;
  className: string; // Changed from 'class' to 'className' to avoid reserved word issues
  room: string;
  type: 'lecture' | 'lab' | 'tutorial';
  isActive?: boolean;
}

interface TimeSlotRow {
  time: string;
  monday?: Session;
  tuesday?: Session;
  wednesday?: Session;
  thursday?: Session;
  friday?: Session;
}

interface BackendTimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_details?: { name: string };
  class_details?: { name: string };
  classroom?: string;
}

interface Assignment {
  academic_class: string;
  class_name: string;
  subject: string;
  subject_name: string;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function timeRange(slot: BackendTimeSlot): string {
  return `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`;
}

export default function TeacherTimetablePage() {
  const { fetchTimetables, fetchMyAssignments } = useTeacherData();
  const { addToast } = useToastStore();
  const [schedule, setSchedule] = useState<TimeSlotRow[]>([]);
  const [currentWeek, setCurrentWeek] = useState(14);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    day: '1',
    startTime: '08:00',
    endTime: '09:00',
    classroom: '',
  });
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today: string = dayNames[new Date().getDay()];

  const loadTimetable = async () => {
    setLoading(true);
    const data = await fetchTimetables();
    if (data && data.length > 0) {
      // Group raw backend TimeSlots into the row-based TimeSlotRow[] structure
      const rows: TimeSlotRow[] = [];
      // Map backend day integers to keys
      const dayMap: Record<number, keyof TimeSlotRow> = {
        1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday'
      };

      (data as BackendTimeSlot[]).forEach((slot) => {
        const timeRangeStr = timeRange(slot);
        let row = rows.find(r => r.time === timeRangeStr);
        if (!row) {
          row = { time: timeRangeStr };
          rows.push(row);
        }
        const dayKey = dayMap[slot.day_of_week];
        if (dayKey && dayKey !== 'time') {
          row[dayKey] = {
            id: slot.id,
            subject: slot.subject_details?.name || 'Unknown',
            className: slot.class_details?.name || 'N/A',
            room: slot.classroom || 'N/A',
            type: 'lecture', // Default for now
            isActive: false
          };
        }
      });

      if (rows.length > 0) {
        setSchedule(rows.sort((a, b) => a.time.localeCompare(b.time)));
      } else {
        setSchedule([]);
      }
    } else {
      setSchedule([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTimetable();
    fetchMyAssignments().then((list) => {
      const mapped = (list as any[]).map((a) => ({
        academic_class: a.academic_class,
        class_name: a.class_name,
        subject: a.subject,
        subject_name: a.subject_name,
      }));
      setAssignments(mapped);
      if (mapped.length > 0) {
        setForm((f) => ({
          ...f,
          classId: mapped[0].academic_class,
          subjectId: mapped.find((m) => m.academic_class === mapped[0].academic_class)?.subject || '',
        }));
      }
    });
  }, []);

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    assignments.forEach((a) => seen.set(a.academic_class, a.class_name));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [assignments]);

  const subjectsForClass = useMemo(() => {
    const seen = new Map<string, string>();
    assignments
      .filter((a) => a.academic_class === form.classId)
      .forEach((a) => seen.set(a.subject, a.subject_name));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [assignments, form.classId]);

  useEffect(() => {
    if (subjectsForClass.length > 0 && !subjectsForClass.some((s) => s.id === form.subjectId)) {
      setForm((f) => ({ ...f, subjectId: subjectsForClass[0].id }));
    }
  }, [subjectsForClass, form.subjectId]);

  const allSlots = useMemo(() => {
    const dayKeys: Array<keyof TimeSlotRow> = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const slots: Array<{ id: string; day: string; time: string; subject: string; className: string }> = [];
    schedule.forEach((row) => {
      dayKeys.forEach((key) => {
        const session = row[key] as Session | undefined;
        if (session) {
          slots.push({
            id: session.id,
            day: key.charAt(0).toUpperCase() + key.slice(1),
            time: row.time,
            subject: session.subject,
            className: session.className,
          });
        }
      });
    });
    return slots;
  }, [schedule]);

  const handleSave = async () => {
    if (!form.classId || !form.subjectId) {
      addToast('Select a class and a subject first.', 'error');
      return;
    }
    if (form.startTime >= form.endTime) {
      addToast('The lesson must end after it starts.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/timetable/time-slots/my_slots/', {
        class_id: form.classId,
        subject_id: form.subjectId,
        day_of_week: Number(form.day),
        start_time: form.startTime,
        end_time: form.endTime,
        classroom: form.classroom,
      });
      addToast('Lesson added to your timetable.', 'success');
      setForm((f) => ({ ...f, classroom: '' }));
      await loadTimetable();
    } catch (err: any) {
      addToast(err.response?.data?.detail || err.response?.data?.[0] || 'Failed to add lesson.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!window.confirm('Remove this lesson from your timetable?')) return;
    try {
      await api.delete(`/timetable/time-slots/${slotId}/`);
      addToast('Lesson removed.', 'success');
      await loadTimetable();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to remove lesson.', 'error');
    }
  };

  const inputRow = (label: string, children: ReactNode) => (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );

  const selectCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">My Timetable</h2>
          <p className="text-on-surface-variant text-sm mt-1">Week {currentWeek}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditor(v => !v)}
            className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">{showEditor ? 'close' : 'edit_calendar'}</span>
            {showEditor ? 'Close editor' : 'Edit schedule'}
          </button>
          <button onClick={() => setCurrentWeek(w => Math.max(1, w - 1))} className="p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-primary transition-colors hover:shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <span className="text-sm font-bold text-slate-700 w-24 text-center">Week {currentWeek}</span>
          <button onClick={() => setCurrentWeek(w => w + 1)} className="p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-primary transition-colors hover:shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      </section>

      {showEditor && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary">edit_calendar</span>
            <h3 className="font-bold text-slate-800">Input your schedule</h3>
            <span className="text-xs text-slate-400 ml-1">Lessons you add appear below and are kept even if the admin regenerates timetables.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inputRow('Class', (
              <select
                className={selectCls}
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, subjectId: '' }))}
              >
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ))}
            {inputRow('Subject', (
              <select
                className={selectCls}
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              >
                {subjectsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ))}
            {inputRow('Day', (
              <select
                className={selectCls}
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
              >
                {DAY_NAMES.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}
              </select>
            ))}
            {inputRow('Start time', (
              <input
                type="time"
                className={selectCls}
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            ))}
            {inputRow('End time', (
              <input
                type="time"
                className={selectCls}
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            ))}
            {inputRow('Room (optional)', (
              <input
                type="text"
                className={selectCls}
                placeholder="e.g. Lab 2"
                value={form.classroom}
                onChange={(e) => setForm((f) => ({ ...f, classroom: e.target.value }))}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Adding...' : <><span className="material-symbols-outlined text-lg">add</span> Add lesson</>}
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>

          {allSlots.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Your scheduled lessons ({allSlots.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allSlots.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-lg min-w-[52px] text-center">{slot.day.slice(0, 3)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{slot.subject}</p>
                      <p className="text-xs text-slate-500 truncate">{slot.className} &bull; {slot.time}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove lesson"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center animate-pulse">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">schedule</span>
          <p className="text-slate-400 font-medium">Loading timetable...</p>
        </div>
      ) : schedule.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">calendar_today</span>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Timetable Yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">Your timetable hasn't been set up yet. It will appear here once your administrator publishes the school timetable — or input your own schedule below.</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">edit_calendar</span>
            Input your schedule
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="min-w-[800px] overflow-x-auto">
              <div className="grid grid-cols-6 border-b border-slate-100 bg-slate-50/50">
                <div className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Time</div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                  <div key={day} className={`p-4 text-xs font-bold uppercase tracking-wider text-center border-l border-slate-100 ${day === today ? 'text-primary bg-primary/5' : 'text-slate-500'}`}>
                    {day}
                    {day === today && <span className="block w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1"></span>}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-slate-100">
                {schedule.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-6 min-h-[120px]">
                    <div className="p-4 text-xs font-semibold text-slate-400 text-center flex items-center justify-center flex-col gap-1">
                      <span className="material-symbols-outlined text-slate-300 text-lg">schedule</span>
                      {slot.time}
                    </div>

                    {slot.time.includes('Break') ? (
                      <div className="col-span-5 border-l border-slate-100 flex items-center justify-center bg-slate-50/50 text-slate-400 text-sm font-bold tracking-widest uppercase">
                        <span className="material-symbols-outlined mr-2">restaurant</span> Student Break
                      </div>
                    ) : (
                      <>
                        <TimeSlotCell session={slot.monday} isToday={'Monday' === today} />
                        <TimeSlotCell session={slot.tuesday} isToday={'Tuesday' === today} />
                        <TimeSlotCell session={slot.wednesday} isToday={'Wednesday' === today} />
                        <TimeSlotCell session={slot.thursday} isToday={'Thursday' === today} />
                        <TimeSlotCell session={slot.friday} isToday={'Friday' === today} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {schedule.map((slot, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                  <span className="text-sm font-bold text-slate-700">{slot.time}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).map((day) => {
                    const session = slot[day];
                    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                    const isTodayDay = dayLabel === today;
                    if (!session) return null;
                    return (
                      <div key={day} className={`px-4 py-3 flex items-center gap-3 ${isTodayDay ? 'bg-primary/5' : ''}`}>
                        <div className={`w-1 h-8 rounded-full ${isTodayDay ? 'bg-primary' : 'bg-slate-200'}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isTodayDay ? 'text-primary' : 'text-slate-400'}`}>{dayLabel}</span>
                            {isTodayDay && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded">TODAY</span>}
                          </div>
                          <p className="font-bold text-sm text-slate-800 mt-0.5">{session.subject}</p>
                          <p className="text-xs text-slate-500">{session.className} &bull; {session.room}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TimeSlotCell({ session, isToday }: { session?: Session, isToday?: boolean }) {
  if (!session) {
    return <div className={`p-2 border-l border-slate-100 ${isToday ? 'bg-primary/5' : ''}`}></div>;
  }

  const { subject, className, room, type, isActive } = session;

  const typeConfig = {
    lecture: { icon: 'menu_book', color: 'border-blue-200 bg-blue-50 text-blue-800' },
    lab: { icon: 'biotech', color: 'border-purple-200 bg-purple-50 text-purple-800' },
    tutorial: { icon: 'group', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
  } as const;

  const config = typeConfig[type];

  if (isActive) {
    return (
      <div className="p-2 border-l border-slate-100 bg-primary/5 relative">
        <div className="absolute top-0 left-0 w-full h-full border-2 border-primary rounded-xl animate-pulse opacity-50 z-0"></div>
        <div className="h-full bg-primary text-white rounded-xl p-3 flex flex-col justify-between shadow-lg shadow-primary/20 relative z-10 hover:-translate-y-1 transition-transform cursor-pointer group">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
            </span>
            <span className="material-symbols-outlined text-sm opacity-70 group-hover:opacity-100">{config.icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight mb-1">{subject}</h4>
            <p className="text-xs font-semibold text-primary-fixed-dim">{className}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/80 mt-2">
            <span className="material-symbols-outlined text-[12px]">location_on</span> {room}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-2 border-l border-slate-100 ${isToday ? 'bg-primary/5' : ''}`}>
      <div className={`h-full rounded-xl border ${config.color} p-3 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group`}>
        <div className="flex justify-between items-start">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{type}</span>
          <span className="material-symbols-outlined text-sm opacity-50 group-hover:opacity-100 transition-opacity">{config.icon}</span>
        </div>
        <div>
          <h4 className="font-bold text-sm leading-tight text-slate-900 mb-1">{subject}</h4>
          <p className="text-xs font-medium text-slate-600">{className}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-2">
          <span className="material-symbols-outlined text-[12px]">location_on</span> {room}
        </div>
      </div>
    </div>
  );
}
