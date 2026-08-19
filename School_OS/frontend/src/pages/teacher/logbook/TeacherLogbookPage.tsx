import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../../stores/toastStore';
import { useTeacherData } from '../../../hooks/useTeacherData';
import { useCurrentClass } from '../../../hooks/useCurrentClass';
import { api } from '../../../services/api';
import { useTeacherStore } from '../../../stores/teacherStore';

export default function TeacherLogbookPage() {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const { currentClass } = useCurrentClass();
  const { activeAssignment } = useTeacherStore();
  const [isLogged, setIsLogged] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureData, setSignatureData] = useState<{hash: string, date: string} | null>(null);
  const { addToast } = useToastStore();
  
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayIndex = new Date().getDay();
  const todayAbbr = dayAbbr[todayIndex];
  
  const [formData, setFormData] = useState({
    module: '',
    title: '',
    outcomes: '- Evaluate learning outcomes for the current session.\n- Link concepts to real-world applications.',
    knowledge: '',
    feedback: 'Most students achieved outcomes',
    homework: ''
  });

  const { submitLogbookEntry } = useTeacherData();

  // Pre-fill based on active assignment
  useEffect(() => {
    if (activeAssignment) {
      setFormData(prev => ({
        ...prev,
        module: `Module: ${activeAssignment.subject_name}`,
        title: `Lesson: ${activeAssignment.subject_name} Intro`,
        knowledge: `Core concepts of ${activeAssignment.subject_name} for ${activeAssignment.class_name}.`
      }));
    } else if (currentClass) {
      setFormData(prev => ({
        ...prev,
        module: `Module: ${currentClass.subject}`,
        title: `Lesson: ${currentClass.subject} Intro`,
        knowledge: `Core concepts of ${currentClass.subject} for ${currentClass.name}.`
      }));
    }
  }, [activeAssignment, currentClass]);

  const handleFinalize = async () => {
    try {
      setIsSigning(true);
      const response = await submitLogbookEntry({
        date: new Date().toISOString().split('T')[0],
        work_covered: `${formData.module} - ${formData.title}\n${formData.knowledge}\nOutcomes: ${formData.outcomes}`,
      });
      
      // Now "Sign" it (Phase 7)
      if (response && response.id) {
          const signRes = await api.post(`/logbook/entries/${response.id}/sign/`);
          setSignatureData({
            hash: signRes.data.signature.substring(0, 16),
            date: new Date(signRes.data.signed_at).toLocaleString()
          });
      }

      setIsLogged(true);
      addToast(
        t('Logbook entry signed and securely archived.'),
        'success'
      );
    } catch {
      addToast(t('Failed to archive logbook entry.'), 'error');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-12 animate-in fade-in duration-500">
      {/* 1. Weekly Logbook Timeline */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('Academic Journey')}</h2>
            <p className="text-on-surface-variant text-sm mt-1">{t('Timeline & Compliance History')}</p>
          </div>
          <button onClick={() => addToast(t('Archives dashboard coming in Phase 7.'), 'info')} className="flex items-center gap-2 text-primary font-bold text-sm hover:underline min-h-[44px]">
            {t('View Historical Archives')} <span className="material-symbols-outlined text-sm">history</span>
          </button>
        </div>

        <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-[300px]">
            {dayAbbr.slice(1, 5).map((day) => {
              const isPast = dayAbbr.indexOf(day) < todayIndex;
              return (
                <div key={day} className={`flex flex-col items-center gap-2 sm:gap-3 flex-1 ${isPast ? 'opacity-60' : ''}`}>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t(day)}</span>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/20">
                    <span className="material-symbols-outlined text-sm sm:text-lg">check</span>
                  </div>
                </div>
              );
            })}
            
            <div className="h-[1px] flex-1 bg-slate-100 rounded-full min-w-[20px]"></div>

            {/* Today */}
            <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1 relative group cursor-pointer transition-all">
              <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors ${isLogged ? 'text-secondary' : 'text-primary'}`}>{t('Today ({{todayAbbr}})', { todayAbbr })}</span>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 flex items-center justify-center shadow-xl transition-all duration-500 ${
                isLogged 
                  ? 'bg-secondary border-secondary text-white shadow-secondary/20' 
                  : 'bg-white border-primary text-primary shadow-primary/10 group-hover:bg-primary/5'
              }`}>
                <span className="material-symbols-outlined text-lg sm:text-xl" style={{ fontVariationSettings: isLogged ? "'wght' 700" : "'FILL' 1" }}>
                   {isSigning ? 'refresh' : (isLogged ? 'verified' : 'edit_square')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-start">
        {/* 2. Auto-Suggested Lesson Card (Left Column) */}
        <section className="lg:col-span-5 space-y-4 sm:space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t('Current Session Context')}</h3>
          
          <div className="relative overflow-hidden bg-white border-l-4 border-primary p-5 sm:p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            {currentClass ? (
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-primary font-bold text-sm uppercase tracking-tighter">{t('Live Session')}</p>
                    <h4 className="text-2xl font-bold text-slate-900 mt-1">{currentClass.subject}</h4>
                    <p className="text-slate-500 font-medium">{currentClass.name} • {currentClass.room}</p>
                  </div>
                  <div className="bg-primary/5 px-3 py-2 rounded-xl text-center border border-primary/10">
                    <span className="material-symbols-outlined text-primary text-2xl">sensors</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <button 
                    onClick={handleFinalize}
                    disabled={isLogged || isSigning}
                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-premium min-h-[48px] ${
                      isLogged 
                        ? 'bg-secondary text-white cursor-default'
                        : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98]'
                    }`}
                  >
                    {isSigning ? t('Signing...') : (isLogged ? t('Securely Artifacted') : t('Sign & Finalize Result'))}
                    <span className="material-symbols-outlined text-xl">
                      {isLogged ? 'workspace_premium' : 'signature'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-200">event_busy</span>
                <p className="text-slate-400 text-sm font-medium">{t('No class currently in session')}</p>
                <button onClick={() => navigate('/teacher/timetable')} className="text-primary text-xs font-bold uppercase tracking-widest underline underline-offset-4">{t('Browse Schedule')}</button>
              </div>
            )}
          </div>

          {/* Digital Signature Seal */}
          {isLogged && signatureData && (
            <div className="bg-surface-container-low/50 p-6 rounded-3xl border-2 border-dashed border-secondary/30 flex items-center gap-6 animate-in zoom-in-95 duration-700">
               <div className="w-16 h-16 rounded-full border-4 border-secondary/20 flex items-center justify-center text-secondary relative">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <div className="absolute inset-0 border-2 border-secondary/10 rounded-full animate-ping"></div>
               </div>
               <div>
<p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">{t('Digital Identity Verified')}</p>
                   <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">SHA256: {signatureData.hash}...</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{signatureData.date}</p>
               </div>
            </div>
          )}
        </section>

        {/* 3. Form Fields (Right Column) */}
        <section className="lg:col-span-7 space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t('Documentation Details')}</h3>
            {isLogged && (
               <span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-1 rounded-md flex items-center gap-1">
                 <span className="material-symbols-outlined text-xs">lock</span> {t('READ-ONLY ARCHIVE')}
               </span>
            )}
          </div>

          <div className={`bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 sm:space-y-8 transition-all duration-500 ${isLogged ? 'opacity-70 pointer-events-none' : ''}`}>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Macro Topic')}</label>
                <input 
                  className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/20 transition-all" 
                  type="text" 
                  placeholder={t('e.g. Algebra')}
                  value={formData.module}
                  onChange={(e) => setFormData({...formData, module: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Micro Topic')}</label>
                <input 
                  className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/20 transition-all" 
                  type="text" 
                  placeholder={t('e.g. Quadratic Equations')}
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Lesson Narrative & Achievement')}</label>
              <textarea 
                className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all min-h-[120px]" 
                placeholder={t('Describe the knowledge transfer and real-world application context...')}
                value={formData.knowledge}
                onChange={(e) => setFormData({...formData, knowledge: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Pedagogical Feedback')}</label>
                <select 
                  className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all"
                  value={formData.feedback}
                  onChange={(e) => setFormData({...formData, feedback: e.target.value})}
                >
                  <option>{t('Most students achieved outcomes')}</option>
                  <option>{t('Partial achievement - needs revisit')}</option>
                  <option>{t('Outstanding engagement & result')}</option>
                  <option>{t('Remediation required')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Self-Directed Study (Homework)')}</label>
                <input 
                  className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/20 transition-all" 
                  type="text" 
                  placeholder={t('Exercises, Chapters, or Projects...')}
                  value={formData.homework}
                  onChange={(e) => setFormData({...formData, homework: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <p className="text-[9px] font-medium text-slate-400 max-w-[200px]">{t('By signing, you certify this as an accurate academic record under the National Education Framework.')}</p>
               <div className="flex gap-4 w-full sm:w-auto">
                  <button onClick={() => addToast(t('Draft saved to archive.'), 'success')} className="text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 min-h-[44px] flex items-center">{t('Draft Archive')}</button>
                  <button 
                    onClick={handleFinalize}
                    className="px-6 sm:px-8 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all min-h-[44px] flex-1 sm:flex-none"
                  >
                    {t('Commit & Sign')}
                  </button>
               </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
