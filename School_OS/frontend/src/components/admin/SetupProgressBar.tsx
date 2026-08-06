import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

interface SetupProgressBarProps {
  studentCount: number | null;
  classCount: number | null;
  sectionCount: number | null;
  hasFinance: boolean;
}

interface ChecklistItem {
  label: string;
  done: boolean;
  link: string;
  icon: string;
}

export default function SetupProgressBar({ studentCount, classCount, sectionCount, hasFinance }: SetupProgressBarProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('sos-setup-dismissed') === 'true');
  const [reportCardCount, setReportCardCount] = useState<number | null>(null);

  useEffect(() => {
    api.get('/reports/report-cards/')
      .then((res) => {
        const d = res.data;
        setReportCardCount(d.count ?? d.results?.length ?? 0);
      })
      .catch(() => setReportCardCount(0));
  }, []);

  if (dismissed) return null;

  const items: ChecklistItem[] = [
    { label: 'Create sections', done: (sectionCount ?? 0) > 0, link: '/admin/academic/setup', icon: 'layers' },
    { label: 'Create classes', done: (classCount ?? 0) > 0, link: '/admin/academic/setup', icon: 'class' },
    { label: 'Enroll students', done: (studentCount ?? 0) > 0, link: '/admin/academic/students/new', icon: 'person_add' },
    { label: 'Generate report cards', done: (reportCardCount ?? 0) > 0, link: '/admin/academic/report-cards', icon: 'description' },
    { label: 'Configure fees', done: hasFinance, link: '/admin/finance/fee-setup', icon: 'payments' },
  ];

  const completed = items.filter((i) => i.done).length;
  const percent = Math.round((completed / items.length) * 100);

  if (percent === 100) return null;

  const handleDismiss = () => {
    localStorage.setItem('sos-setup-dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>progress_activity</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">School Setup</h3>
            <p className="text-xs text-on-surface-variant">Your school is {percent}% set up</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors" title="Hide this">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-4">
        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.link)}
            className={`flex items-center gap-2.5 p-3 rounded-lg border transition-all text-left group ${
              item.done
                ? 'border-secondary/20 bg-secondary/5'
                : 'border-outline-variant/15 hover:border-primary/30 hover:bg-primary/5'
            }`}
          >
            <span
              className={`material-symbols-outlined text-lg flex-shrink-0 ${
                item.done ? 'text-secondary' : 'text-on-surface-variant'
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {item.done ? 'check_circle' : item.icon}
            </span>
            <span className={`text-xs font-medium leading-tight ${item.done ? 'text-on-surface-variant line-through' : 'text-on-surface group-hover:text-primary'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
