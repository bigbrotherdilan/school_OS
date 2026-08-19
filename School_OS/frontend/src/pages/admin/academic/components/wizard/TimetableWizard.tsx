import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, BookOpen, User, Sparkles, CheckCircle2 } from 'lucide-react';
import Step1SchoolWeek from './Step1SchoolWeek';
import Step2SubjectHours from './Step2SubjectHours';
import Step3TeacherAvailability from './Step3TeacherAvailability';
import Step4GenerateReview from './Step4GenerateReview';

const STEPS = [
  { label: 'School Week',     icon: CalendarDays },
  { label: 'Subject Hours',   icon: BookOpen     },
  { label: 'Availability',    icon: User         },
  { label: 'Generate',        icon: Sparkles     },
];

interface Props {
  sectionId: string | null;
  yearId: string;
  timetableSample: any;  // any existing timetable for the section (for week defaults)
  onDone: (result: any) => void;
  onCancel: () => void;
}

export default function TimetableWizard({ sectionId, yearId, timetableSample, onDone, onCancel }: Props) {
  const { t } = useTranslation('adminAcademic');
  const [step, setStep] = useState(0);  // 0-indexed

  const next = () => setStep(s => Math.min(s + 1, 3));
  const back = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Step indicator */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between relative">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-5 h-0.5 bg-outline-variant/20 -z-0 mx-12" />
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const Icon = s.icon;
            return (
              <div key={i} className="flex flex-col items-center gap-2 z-10">
                <button
                  onClick={() => { if (done) setStep(i); }}
                  disabled={!done}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    done
                      ? 'bg-primary border-primary text-white cursor-pointer hover:opacity-80'
                      : active
                        ? 'bg-white border-primary text-primary shadow-lg shadow-primary/20 scale-110'
                        : 'bg-surface-container border-outline-variant/30 text-outline'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>
                <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                  active ? 'text-primary' : done ? 'text-on-surface' : 'text-outline'
                }`}>
                  {t(s.label)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cancel link */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onCancel}
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {t('✕ Exit wizard')}
          </button>
        </div>
      </div>

      {/* Step content */}
      <div className="animate-in fade-in duration-200" key={step}>
        {step === 0 && (
          <Step1SchoolWeek
            sectionId={sectionId || 'none'}
            yearId={yearId}
            timetableSample={timetableSample}
            onNext={next}
          />
        )}
        {step === 1 && (
          <Step2SubjectHours
            sectionId={sectionId}
            yearId={yearId}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 2 && (
          <Step3TeacherAvailability
            sectionId={sectionId}
            yearId={yearId}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 3 && (
          <Step4GenerateReview
            sectionId={sectionId}
            yearId={yearId}
            onDone={onDone}
            onBack={back}
          />
        )}
      </div>
    </div>
  );
}
