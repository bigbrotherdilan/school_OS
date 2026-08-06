import { useState, useEffect } from 'react';

const TIME_ESTIMATES: Record<string, number> = {
  'REPORT_CARD_GENERATED': 15,
  'BATCH_REPORT_GENERATED': 15,
  'ATTENDANCE_RECORDED': 2,
  'FEE_PAYMENT_RECORDED': 5,
  'FEE_PAYMENT_CREATED': 5,
  'ANNOUNCEMENT_SENT': 10,
  'STUDENT_ENROLLED': 8,
  'ID_CARD_GENERATED': 3,
  'TEMPLATE_CREATED': 5,
};

function getMinutesForAction(action: string, description: string): number {
  const desc = (description || '').toLowerCase();
  if (desc.includes('report card') || desc.includes('batch generate')) return 15;
  if (desc.includes('attendance')) return 2;
  if (desc.includes('fee') || desc.includes('payment') || desc.includes('transaction')) return 5;
  if (desc.includes('announcement')) return 10;
  if (desc.includes('enroll') || desc.includes('student')) return 8;
  if (desc.includes('id card')) return 3;
  if (desc.includes('template')) return 5;
  if (action in TIME_ESTIMATES) return TIME_ESTIMATES[action];
  return 1;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

interface Props {
  auditLogs: any[];
  loading: boolean;
}

export default function TimeSavedWidget({ auditLogs, loading }: Props) {
  const [cumulative, setCumulative] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sos-time-saved-minutes');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        setCumulative(parsed);
        return;
      }
    }

    if (auditLogs.length > 0) {
      const totalMinutes = auditLogs.reduce((sum, log) => {
        return sum + getMinutesForAction(log.action, log.description);
      }, 0);
      localStorage.setItem('sos-time-saved-minutes', String(totalMinutes));
      setCumulative(totalMinutes);
    }
  }, [auditLogs]);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 animate-pulse">
        <div className="h-4 bg-surface-container-highest rounded w-32 mb-3" />
        <div className="h-8 bg-surface-container-highest rounded w-20" />
      </div>
    );
  }

  if (cumulative === null || cumulative === 0) return null;

  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 hover:border-secondary/20 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
        </div>
        <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Time Saved</span>
      </div>
      <p className="text-[2rem] font-bold text-on-surface leading-none">{formatHours(cumulative)}</p>
      <p className="text-xs text-on-surface-variant mt-2 leading-snug">
        School OS has saved you an estimated <span className="font-bold text-secondary">{formatHours(cumulative)}</span> this year
      </p>
    </div>
  );
}
