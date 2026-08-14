import { useState, useEffect } from 'react';
import { Trash2, Clock, CalendarDays, Plus } from 'lucide-react';
import { api } from '../../../../../services/api';
import { useToastStore } from '../../../../../stores/toastStore';

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

interface Step1SchoolWeekProps {
  sectionId: string;
  yearId: string;
  timetableSample: any;
  onNext: () => void;
}

export default function Step1SchoolWeek({
  sectionId,
  yearId,
  timetableSample,
  onNext,
}: Step1SchoolWeekProps) {
  const [form, setForm] = useState<WeekForm>({
    start: '07:30',
    periodLen: 45,
    count: 8,
    breaks: [{ time: '10:30', len: 30 }],
    days: ['1', '2', '3', '4', '5'],
  });
  const [saving, setSaving] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (timetableSample) {
      setForm(weekFromTimetable(timetableSample));
    }
  }, [timetableSample]);

  const handleSave = async () => {
    setSaving(true);
    const periods = buildPeriods(form);
    const days = form.days.map(Number).sort();
    try {
      await api.post('/timetable/timetables/create_for_section/', {
        stream: sectionId || 'none',
        academic_year: yearId,
        periods,
        working_days: days,
      });
      addToast('School week settings saved successfully!', 'success');
      onNext();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to save week settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 shadow-sm">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Step 1: School Week Settings
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          Configure working hours, days, periods per day, and break times for all classes in this section.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">First Period Starts</label>
            <input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Period Length (mins)</label>
            <select
              value={form.periodLen}
              onChange={(e) => setForm({ ...form, periodLen: parseInt(e.target.value) })}
              className={inputCls}
            >
              {[30, 35, 40, 45, 50, 55, 60].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Periods Per Day</label>
            <input
              type="number"
              min={2}
              max={14}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Math.max(2, Math.min(14, parseInt(e.target.value) || 2)) })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> Working Days
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = form.days.includes(String(d.value));
              return (
                <button
                  key={d.value}
                  onClick={() =>
                    setForm((wf) => ({
                      ...wf,
                      days: active
                        ? wf.days.filter((x) => x !== String(d.value))
                        : [...wf.days, String(d.value)],
                    }))
                  }
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-95 border ${
                    active
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/25'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10 hover:bg-surface-container'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 border-t border-outline-variant/10 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm">School Breaks</h4>
              <p className="text-xs text-on-surface-variant">Periods adjust automatically around these breaks.</p>
            </div>
            <button
              onClick={() => setForm((wf) => ({ ...wf, breaks: [...wf.breaks, { time: '10:00', len: 20 }] }))}
              className="text-xs font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Break
            </button>
          </div>

          <div className="space-y-3">
            {form.breaks.length === 0 && (
              <p className="text-xs text-outline italic">No breaks configured. Periods run back-to-back.</p>
            )}
            {form.breaks.map((br, i) => (
              <div key={i} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3 border border-outline-variant/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline w-20">Break {i + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">Starts after period ending at:</span>
                  <input
                    type="time"
                    value={br.time}
                    onChange={(e) =>
                      setForm((wf) => ({
                        ...wf,
                        breaks: wf.breaks.map((b, j) => (j === i ? { ...b, time: e.target.value } : b)),
                      }))
                    }
                    className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">Length:</span>
                  <select
                    value={br.len}
                    onChange={(e) =>
                      setForm((wf) => ({
                        ...wf,
                        breaks: wf.breaks.map((b, j) => (j === i ? { ...b, len: parseInt(e.target.value) } : b)),
                      }))
                    }
                    className="bg-white border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((m) => (
                      <option key={m} value={m}>{m} mins</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setForm((wf) => ({ ...wf, breaks: wf.breaks.filter((_, j) => j !== i) }))}
                  className="ml-auto text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-surface-container-low rounded-xl p-5 border border-outline-variant/10">
          <p className="text-[11px] font-black uppercase tracking-widest text-outline mb-2">Live Periods Preview</p>
          <div className="flex flex-wrap gap-2">
            {buildPeriods(form).map((p, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-white border border-outline-variant/10 text-xs font-bold text-on-surface">
                P{i + 1}: {p.start} – {p.end}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
