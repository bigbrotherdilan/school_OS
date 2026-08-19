import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DAYS = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' }, { value: 7, label: 'Sunday' },
];

const DEFAULT_PERIODS = [
  { start: '07:30', end: '08:20' }, { start: '08:20', end: '09:10' },
  { start: '09:10', end: '10:00' }, { start: '10:30', end: '11:20' },
  { start: '11:20', end: '12:10' }, { start: '12:10', end: '13:00' },
  { start: '13:40', end: '14:30' }, { start: '14:30', end: '15:20' },
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

const colorOf = (subj: any) => {
  const id = typeof subj === 'object' ? subj?.id : subj;
  if (!id) return PALETTE[8];
  const sId = String(id);
  let hash = 0;
  for (let i = 0; i < sId.length; i++) hash = sId.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const dayLabel = (val: number) => DAYS.find((d) => d.value === val)?.label || `Day ${val}`;

export default function TimetableSnapshotGrid({ tt }: { tt: any }) {
  const { t } = useTranslation('adminAcademic');
  const periods = tt?.periods?.length ? tt.periods : DEFAULT_PERIODS;
  const days = tt?.working_days?.length ? tt.working_days : [1, 2, 3, 4, 5];

  const statusPill = (status: string) => {
    const map: Record<string, string> = {
      published: 'bg-green-100 text-green-700',
      approved: 'bg-green-100 text-green-700',
      under_review: 'bg-indigo-100 text-indigo-700',
      generated: 'bg-blue-100 text-blue-700',
      relaxed: 'bg-amber-100 text-amber-700',
      infeasible: 'bg-red-100 text-red-700',
    };
    const cls = map[status] || 'bg-surface-container-highest text-on-surface-variant';
    return <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cls}`}>{t(status || 'draft')}</span>;
  };

  const slotsAt = (day: number, periodIdx: number) => {
    const period = periods[periodIdx];
    if (!period) return [];
    return (tt.slots || []).filter(
      (s: any) =>
        s.day_of_week === day &&
        s.start_time.slice(0, 5) === period.start &&
        s.end_time.slice(0, 5) === period.end
    );
  };

  return (
    <div className="snapshot-card bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden print:shadow-none print:border-black/20">
      {/* Header */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/10 print:border-black/20">
        <div>
          <p className="text-lg font-black text-on-surface">
            {tt.class_name || t('Class')}
            <span className="ml-2 text-xs font-bold text-on-surface-variant">({tt.section_name})</span>
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {tt.academic_year_name}{tt.term_name ? ` · ${tt.term_name}` : ''} — {t('{{days}} days × {{periods}} periods', { days: days.length, periods: periods.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tt.is_committed && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-700 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> {t('Committed')}
            </span>
          )}
          {statusPill(tt.generation_status)}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[860px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-outline w-24 bg-white print:bg-white">
                {t('Period')}
              </th>
              {days.map((d: number) => (
                <th key={d} className="px-2 py-2.5 text-[10px] font-black uppercase tracking-widest text-outline bg-white print:bg-white">
                  {t(dayLabel(d))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period: any, p: number) => {
              const isBreak = p > 0 && periods[p - 1].end !== period.start;
              return (
                <tr key={p} className={isBreak ? 'border-t-4 border-dashed border-outline-variant/40' : ''}>
                  <td className="px-3 py-2 text-xs font-bold text-on-surface-variant whitespace-nowrap bg-white print:bg-white">
                    {period.start}–{period.end}
                    {isBreak && <span className="block text-[9px] font-normal text-outline">{t('break')}</span>}
                  </td>
                  {days.map((d: number) => {
                    const slots = slotsAt(d, p);
                    const [bg] = slots[0] ? colorOf(slots[0].subject) : ['transparent', 'transparent'];
                    const prev = p > 0 ? slotsAt(d, p - 1)[0] : undefined;
                    const continuation = slots.length === 1 && slots[0].lesson && prev?.lesson === slots[0].lesson;
                    return (
                      <td key={d} className={`px-1.5 py-1.5 border border-outline-variant/10 align-top ${continuation ? 'opacity-80' : ''}`} style={slots.length ? { background: bg } : undefined}>
                        {slots.map((slot: any) => {
                          const [, cFg] = colorOf(slot.subject);
                          return (
                            <div key={slot.id} className="rounded-md p-1.5">
                              {!continuation ? (
                                <p className="font-black text-xs leading-tight" style={{ color: cFg }}>{slot.subject_name}</p>
                              ) : (
                                <p className="text-[10px] font-black text-on-surface-variant">{t('↳ cont.')}</p>
                              )}
                              <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                                {slot.teacher_name || '—'}
                                {!slot.teacher && <span className="ml-1 px-1 py-px rounded bg-white/60 text-[8px] font-black uppercase tracking-wider text-on-surface-variant">{t('TBD')}</span>}
                              </p>
                              {slot.group_name && <p className="text-[9px] text-outline mt-0.5">👥 {slot.group_name}</p>}
                              {slot.room_name ? (
                                <p className="text-[9px] text-outline mt-0.5">📍 {slot.room_name}</p>
                              ) : slot.classroom ? (
                                <p className="text-[9px] text-outline mt-0.5">🏫 {slot.classroom}</p>
                              ) : null}
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

      <div className="px-5 py-2.5 border-t border-outline-variant/10 text-[10px] text-outline print:border-black/20">
        {t('TBD = teacher not yet assigned')}
      </div>
    </div>
  );
}
