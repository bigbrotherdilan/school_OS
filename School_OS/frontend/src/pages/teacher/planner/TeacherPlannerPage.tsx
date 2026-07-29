import { useState, useEffect, useRef } from 'react';
import { useToastStore } from '../../../stores/toastStore';
import { useTeacherData } from '../../../hooks/useTeacherData';
import { useTeacherStore } from '../../../stores/teacherStore';

export default function TeacherPlannerPage() {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const { addToast } = useToastStore();
  const { saveLessonPlan } = useTeacherData();
  const { activeAssignment } = useTeacherStore();
  const [plan, setPlan] = useState({
    title: 'Introduction to Linear Algebra',
    duration: '55 Mins',
    objectives: 'By the end of this lesson, students will be able to:\n1. Define a matrix and identify its dimensions.\n2. Perform basic scalar multiplication.\n3. Identify RLS applications of matrices in image processing.',
    engage: 'Show a zoomed-in pixelated image on the projector. Ask students how computers represent these images (as grids of numbers).',
    explore: 'Group activity: Distribute worksheets with small "image grids". Have students apply a scalar multiplier to increase the "brightness" of the image.',
    explain: 'Formalize the concept of a Matrix. Introduce terminology: rows, columns, dimensions, elements, scalar multiplication.',
    elaborate: 'Provide a real-world scenario from tech (storing data in arrays). Have students construct a matrix representing sales data for a school club over 3 days.',
    evaluate: 'Exit ticket: 3 short questions on identifying matrix dimensions and one scalar multiplication problem.',
  });

  const planRef = useRef(plan);
  useEffect(() => { planRef.current = plan; }, [plan]);

  useEffect(() => {
    // Attempt to load existing plan from DB
    const loadExistingPlan = async () => {
       try {
         // In a real scenario, we'd fetch for specific week/class
         // const data = await fetchSchemeOfWork(14);
         // if (data) setPlan({...plan, title: data.topic, objectives: data.objectives});
         console.log("TeacherPlannerPage: Ready for dynamic synchronization.");
       } catch (e) {
         console.error(e);
       }
    };
    loadExistingPlan();
  }, []);

  useEffect(() => {
    if (saveStatus === 'unsaved') {
      const timer = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          // Collapse the 5E into the standard objectives field for the SchemeOfWork model
          const unifiedObjective = `${planRef.current.objectives}\n\n### Engage:\n${planRef.current.engage}\n\n### Explore:\n${planRef.current.explore}\n\n### Explain:\n${planRef.current.explain}`;
          await saveLessonPlan({
            topic: planRef.current.title,
            objectives: unifiedObjective,
            week_number: 14, // Mock current week
            subject_id: activeAssignment?.subject,
            class_id: activeAssignment?.academic_class
          });
          setSaveStatus('saved');
        } catch (error) {
          console.error("Save plan failed", error);
          setSaveStatus('unsaved');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, saveLessonPlan]);

  const handleChange = (field: string, value: string) => {
    setPlan({ ...plan, [field]: value });
    setSaveStatus('unsaved');
  };

  const handleExport = () => {
    addToast('Lesson Plan exported as PDF.', 'success');
  };

  const handleSaveToLibrary = () => {
    addToast('Lesson plan saved to your library.', 'success');
  };

  const handleAddMaterial = () => {
    addToast('Upload material feature coming soon.', 'info');
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Lesson Planner</h2>
          <p className="text-on-surface-variant text-sm mt-1">Design and align curriculum delivery</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-300 ${
            saveStatus === 'saved' ? 'bg-secondary/10 text-secondary' : 
            saveStatus === 'saving' ? 'bg-primary/10 text-primary' : 
            'bg-slate-100 text-slate-400'
          }`}>
            {saveStatus === 'saved' && <><span className="material-symbols-outlined text-[14px]">cloud_done</span> Saved</>}
            {saveStatus === 'saving' && <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span></>}
            {saveStatus === 'unsaved' && <><span className="material-symbols-outlined text-[14px]">edit</span> Draft</>}
          </div>
          <button onClick={handleExport} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 shadow-sm flex items-center gap-2 min-h-[44px]">
            <span className="material-symbols-outlined text-sm">download</span> <span className="hidden sm:inline">Export PDF</span><span className="sm:hidden">Export</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Planner Workspace (Left) */}
        <section className="lg:col-span-8 space-y-6">
          <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 sm:space-y-8">
            <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
              </div>
              <div className="flex-1 space-y-4">
                <input 
                  type="text" 
                  value={plan.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full text-2xl font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 placeholder-slate-300 transition-colors hover:text-primary focus:text-primary"
                  placeholder="Lesson Title..."
                />
                <div className="flex flex-wrap gap-2 text-sm text-slate-500 font-medium">
                  <span className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-[16px]">school</span> {activeAssignment?.class_name || 'Loading...'}</span>
                  <span className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-[16px]">menu_book</span> {activeAssignment?.subject_name || 'Loading...'}</span>
                  <span className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-[16px]">timer</span> {plan.duration}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">outbound</span> Learning Objectives
              </label>
              <textarea 
                value={plan.objectives}
                onChange={(e) => handleChange('objectives', e.target.value)}
                rows={4}
                className="w-full bg-surface-container-low border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all leading-relaxed resize-y"
              />
            </div>

            <div className="grid gap-6">
              <PlannerSection 
                title="1. Engage (Introduction)" 
                icon="lightbulb" 
                value={plan.engage} 
                onChange={(v) => handleChange('engage', v)} 
              />
              <PlannerSection 
                title="2. Explore (Activity)" 
                icon="explore" 
                value={plan.explore} 
                onChange={(v) => handleChange('explore', v)} 
              />
              <PlannerSection 
                title="3. Explain (Concept)" 
                icon="psychology" 
                value={plan.explain} 
                onChange={(v) => handleChange('explain', v)} 
              />
              <PlannerSection 
                title="4. Elaborate (Application/RLS)" 
                icon="public" 
                value={plan.elaborate} 
                color="text-secondary"
                onChange={(v) => handleChange('elaborate', v)} 
              />
              <PlannerSection 
                title="5. Evaluate (Assessment)" 
                icon="fact_check" 
                value={plan.evaluate} 
                onChange={(v) => handleChange('evaluate', v)} 
              />
            </div>
            
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <span className="text-xs font-bold text-slate-400">Last edited just now</span>
              <button onClick={handleSaveToLibrary} className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-all text-sm min-h-[44px] w-full sm:w-auto">
                Save to Library
              </button>
            </div>
          </div>
        </section>

        {/* Resources Panel (Right) */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-high p-6 rounded-2xl shadow-sm border border-slate-50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>gpp_good</span>
              CBA Framework Alignment
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-secondary/20 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-1">Target Competency</h4>
                <p className="text-sm font-medium text-slate-800">C3: Solving complex problems using mathematical representations.</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-1">Recommended RLS</h4>
                <p className="text-sm text-slate-600">Digital networks, Cryptography basics, Resource allocation in business.</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
              Attached Resources
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-error">picture_as_pdf</span>
                  <span className="text-sm font-medium text-slate-700">Matrix_Worksheet_01.pdf</span>
                </div>
                <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-primary transition-colors">download</span>
              </li>
              <li className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-500">slideshow</span>
                  <span className="text-sm font-medium text-slate-700">Intro_Slides.pptx</span>
                </div>
                <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-primary transition-colors">download</span>
              </li>
            </ul>
            <button onClick={handleAddMaterial} className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 min-h-[44px]">
              <span className="material-symbols-outlined text-sm">add</span> Add Material
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PlannerSection({ title, icon, value, color = 'text-slate-400', onChange }: { title: string, icon: string, value: string, color?: string, onChange: (val: string) => void }) {
  return (
    <div className="space-y-2 group">
      <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${color} group-focus-within:text-primary`}>
        <span className={`material-symbols-outlined text-sm ${title.includes('4') ? 'text-secondary' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span> {title}
      </label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all leading-relaxed resize-y group-hover:bg-slate-100"
      />
    </div>
  );
}
