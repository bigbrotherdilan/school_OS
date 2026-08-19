import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const FAQ_ITEMS = [
  {
    q: 'How do I add a new student?',
    a: 'Go to Students in the sidebar, click "Add Student", fill in the required fields (name, admission number, class), and save.',
  },
  {
    q: 'How do I generate report cards?',
    a: 'Navigate to Academic > Report Cards, select a class and term, then click "Batch Generate" for all students or select individual students.',
  },
  {
    q: 'How do I create ID cards?',
    a: 'Go to Academic > ID Cards, select a class, pick students, and click "Generate". You can customize the design with the Design Studio.',
  },
  {
    q: 'How do I set up the academic year?',
    a: 'Go to Academic > Setup, create a new academic year, add terms (e.g. 1st Term, 2nd Term, 3rd Term), then set up classes and assign subjects.',
  },
  {
    q: 'How do I record attendance?',
    a: 'Go to Attendance, select the class and date, mark students as Present, Absent, or Late, then save.',
  },
  {
    q: 'How do I manage fees?',
    a: 'Navigate to Finance > Fees, select the class, and generate fees. You can track payments and arrears from the same page.',
  },
];

const SHORTCUTS = [
  { keys: ['G', 'then', 'D'], desc: 'Go to Dashboard' },
  { keys: ['G', 'then', 'S'], desc: 'Go to Students' },
  { keys: ['G', 'then', 'A'], desc: 'Go to Academics' },
  { keys: ['Esc'], desc: 'Close any open panel' },
];

export default function HelpPanel() {
  const { t } = useTranslation('layout');
  const [open, setOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        title={t('Help & Support')}
      >
        <span className="material-symbols-outlined">help</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent">
            <h3 className="font-bold text-slate-900 text-lg">{t('Help & Support')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t('Find answers to common questions')}</p>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {/* FAQ Section */}
            <div className="px-5 pt-4 pb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{t('Frequently Asked Questions')}</h4>
              <div className="space-y-2">
                {FAQ_ITEMS.map((item, i) => (
                  <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-700">{t(item.q)}</span>
                      <span
                        className={`material-symbols-outlined text-slate-400 text-lg transition-transform ${
                          expandedFaq === i ? 'rotate-180' : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-3">
                        <p className="text-sm text-slate-500 leading-relaxed">{t(item.a)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="px-5 pt-2 pb-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{t('Keyboard Shortcuts')}</h4>
              <div className="space-y-2">
                {SHORTCUTS.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">{t(s.desc)}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) =>
                        k === 'then' ? (
                          <span key={j} className="text-[10px] text-slate-400 mx-0.5">{t('then')}</span>
                        ) : (
                          <kbd
                            key={j}
                            className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono font-semibold text-slate-700 shadow-sm"
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">support_agent</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t('Need more help?')}</p>
                <p className="text-[11px] text-slate-400">{t('Contact your school administrator')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
