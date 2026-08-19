import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../../services/api';
import { useToastStore } from '../../../../../stores/toastStore';
import { User, Plus, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const inputCls = 'w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20';

interface Props {
  sectionId: string | null;
  yearId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3TeacherAvailability({ sectionId, yearId, onNext, onBack }: Props) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<{ teacherId: string; teacherName: string } | null>(null);
  const [addForm, setAddForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '10:00', reason: '', whole_day: false });
  const [dayRange, setDayRange] = useState({ start: '07:30', end: '16:10' });
  const [addSaving, setAddSaving] = useState(false);
  const { t } = useTranslation('adminAcademic');
  const { addToast } = useToastStore();

  useEffect(() => { loadTeachers(); }, [sectionId, yearId]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const res = await api.post('/timetable/timetables/teacher_availability_summary/', {
        academic_year: yearId,
        stream: sectionId || 'none',
      });
      const list: any[] = res.data.teachers || [];
      setTeachers(list);
      if (res.data.day_start && res.data.day_end) {
        setDayRange({ start: res.data.day_start, end: res.data.day_end });
      }
      if (list.length) setExpanded(list[0].id);
    } catch {
      addToast(t('Failed to load teacher availability data.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (teacherId: string, teacherName: string) => {
    setAddForm({
      day_of_week: 1,
      start_time: dayRange.start,
      end_time: dayRange.end,
      reason: '',
      whole_day: false,
    });
    setAddModal({ teacherId, teacherName });
  };

  const toggleWholeDay = (on: boolean) => {
    setAddForm(f => ({
      ...f,
      whole_day: on,
      start_time: on ? dayRange.start : f.start_time,
      end_time: on ? dayRange.end : f.end_time,
    }));
  };

  const handleAdd = async () => {
    if (!addModal) return;
    if (!addForm.whole_day && addForm.start_time >= addForm.end_time) {
      addToast(t('End time must be after start time.'), 'warning');
      return;
    }
    setAddSaving(true);
    try {
      if (addForm.whole_day) {
        const teacher = teachers.find(t => t.id === addModal.teacherId);
        const onDay = (teacher?.windows || []).filter((w: any) => w.day_of_week === addForm.day_of_week);
        for (const w of onDay) {
          await api.delete(`/timetable/unavailability/${w.id}/`);
        }
        addToast(
          onDay.length
            ? t('Day cleared — {{name}} is free all day.', { name: addModal.teacherName })
            : t('{{name}} is already free all day.', { name: addModal.teacherName }),
          'success'
        );
      } else {
        await api.post('/timetable/unavailability/', {
          teacher: addModal.teacherId,
          day_of_week: addForm.day_of_week,
          start_time: addForm.start_time,
          end_time: addForm.end_time,
          reason: addForm.reason,
        });
        addToast(t('Unavailability block saved.'), 'success');
      }
      setAddModal(null);
      loadTeachers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || t('Failed to save block.'), 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDelete = async (windowId: string) => {
    try {
      await api.delete(`/timetable/unavailability/${windowId}/`);
      addToast(t('Block removed.'), 'success');
      loadTeachers();
    } catch {
      addToast(t('Failed to remove block.'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t('Step 3: Teacher Availability')}</h3>
            <p className="text-sm text-on-surface-variant">{t('Block out times when teachers are unavailable — the generator will never use those slots.')}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-on-surface-variant animate-pulse">{t('Loading teachers…')}</div>
        ) : teachers.length === 0 ? (
          <div className="py-12 text-center bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <User className="w-10 h-10 text-outline mx-auto mb-3" />
            <p className="font-semibold text-on-surface-variant text-sm">{t('No teachers assigned yet.')}</p>
            <p className="text-xs text-outline mt-1">{t('Link teachers to subjects in this section first, then return here.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teachers.map(t => {
              const isOpen = expanded === t.id;
              return (
                <div key={t.id} className="border border-outline-variant/15 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{t.name}</p>
                        <p className="text-[10px] text-on-surface-variant line-clamp-1 max-w-xs">{(t.assignments || []).join(' • ')}</p>
                      </div>
                      {t.windows?.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full shrink-0">
                          {t.windows.length} {t(t.windows.length > 1 ? 'blocks' : 'block')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); openAddModal(t.id, t.name); }}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Plus className="w-3 h-3" /> {t('Block')}
                      </button>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 bg-surface-container-lowest animate-in slide-in-from-top-1 duration-150 space-y-2">
                      {!t.windows?.length ? (
                        <p className="text-xs text-outline text-center py-4">{t('No blocks set — teacher is fully available.')}</p>
                      ) : (
                        t.windows.map((w: any) => (
                          <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-amber-800">
                                  {t(DAYS.find((d) => d.value === w.day_of_week)?.label || '')} · {w.start_time}–{w.end_time}
                                </p>
                                {w.reason && <p className="text-[10px] text-amber-600">{w.reason}</p>}
                              </div>
                            </div>
                            <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">
          {t('← Back')}
        </button>
        <button onClick={onNext} className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
          {t('Continue →')}
        </button>
      </div>

      {/* Add block modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">{t('Block Unavailability')}</h3>
                <p className="text-sm text-on-surface-variant">{addModal.teacherName}</p>
              </div>
              <button onClick={() => setAddModal(null)} className="text-on-surface-variant hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Day')}</label>
                <select value={addForm.day_of_week} onChange={e => setAddForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))} className={`${inputCls} mt-1`}>
                  {DAYS.map(d => <option key={d.value} value={d.value}>{t(d.label)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('From')}</label>
                  <input
                    type="time"
                    value={addForm.start_time}
                    disabled={addForm.whole_day}
                    onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))}
                    className={`${inputCls} mt-1 disabled:opacity-40`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('To')}</label>
                  <input
                    type="time"
                    value={addForm.end_time}
                    disabled={addForm.whole_day}
                    onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
                    className={`${inputCls} mt-1 disabled:opacity-40`}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addForm.whole_day}
                  onChange={e => toggleWholeDay(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm font-semibold">{t('Free all day')}</span>
                <span className="text-[10px] text-on-surface-variant">
                  {t('clears any blocks on this day — teacher can be scheduled anywhere')}
                </span>
              </label>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Reason (optional)')}</label>
                <input type="text" placeholder={t('e.g. Other school, meetings')} value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} className={`${inputCls} mt-1`} />
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setAddModal(null)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all">{t('Cancel')}</button>
                <button onClick={handleAdd} disabled={addSaving} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                  {addSaving ? t('Saving…') : addForm.whole_day ? t('Free Day') : t('Save Block')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
