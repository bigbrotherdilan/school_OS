import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { reportsApi } from '../../../services/reportsApi';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';

interface Sequence {
  id: number;
  name: string;
  order_number: number;
  term: number;
  term_name: string;
  academic_year_id: number;
}

interface Term {
  id: number;
  academic_year: number;
  name: string;
  order_number: number;
  sequences: Sequence[];
}

interface MarkWindow {
  id: string;
  sequence: number | string;
  sequence_name: string;
  term_name: string;
  academic_year: number | string;
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
  share_results: boolean;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export default function ExamWorkflow() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [terms, setTerms] = useState<Term[]>([]);
  const [windows, setWindows] = useState<MarkWindow[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [togglingWindow, setTogglingWindow] = useState<string | null>(null);
  const [togglingShare, setTogglingShare] = useState<string | null>(null);
  const [generatingTerm, setGeneratingTerm] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState<number | null>(null);
  const { activeSectionId } = useSectionStore();

  useEffect(() => {
    fetchData();
  }, [activeSectionId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [termsRes, windowsRes, classesRes, yearsRes] = await Promise.all([
        api.get('/academic/terms/'),
        api.get('/assessments/mark-windows/'),
        api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }).catch(() => ({ data: [] })),
        api.get('/academic/academic-years/').catch(() => ({ data: [] })),
      ]);

      const termsData = termsRes.data.results || termsRes.data;
      setTerms(termsData);
      setWindows(windowsRes.data.results || windowsRes.data);
      setClasses(classesRes.data.results || classesRes.data || []);

      const yearsData = yearsRes.data.results || yearsRes.data || [];
      setAcademicYears(yearsData);
      const activeYear = yearsData.find((y: any) => y.is_active);
      if (activeYear) setSelectedYear(activeYear.id);
    } catch (err) {
      console.error('Failed to load workflow data:', err);
      addToast('Failed to load workflow data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getWindowForSequence = (seqId: number) =>
    windows.find(w => Number(w.sequence) === Number(seqId));

  const handleToggleWindow = async (windowId: string, currentState: boolean) => {
    console.log('Toggling window:', { windowId, currentState });
    setTogglingWindow(windowId);
    try {
      const res = await api.post(`/assessments/mark-windows/${windowId}/toggle/`);
      console.log('Toggle response:', res.data);

      if (!currentState) {
        const win = windows.find(w => w.id === windowId);
        if (win) {
          const seq = terms.flatMap(t => t.sequences || []).find((s: any) => Number(s.id) === Number(win.sequence));
          if (seq && seq.term && selectedYear) {
            await api.post('/assessments/exams/ensure-for-term/', {
              term_id: seq.term,
              academic_year_id: selectedYear,
            }).catch(() => {});
          }
        }
      }

      addToast(`Window ${!currentState ? 'OPENED' : 'CLOSED'} successfully.`, 'success');
      fetchData();
    } catch (err: any) {
      console.error('Toggle error:', err.response?.data || err.message);
      addToast(err.response?.data?.detail || 'Toggle failed.', 'error');
    } finally {
      setTogglingWindow(null);
    }
  };

  const handleToggleShare = async (windowId: string, currentShare: boolean) => {
    setTogglingShare(windowId);
    try {
      await api.post(`/assessments/mark-windows/${windowId}/toggle-share/`);
      addToast(
        currentShare ? 'Results hidden from parents.' : 'Results now visible to parents.',
        'success'
      );
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to toggle sharing.', 'error');
    } finally {
      setTogglingShare(null);
    }
  };

  const handleCreateSequences = async (termId: number, count: number = 2) => {
    try {
      const promises = Array.from({ length: count }, () =>
        api.post('/academic/sequences/', { term: termId })
      );
      await Promise.all(promises);
      addToast(`${count} sequence(s) created for this term.`, 'success');
      fetchData();
    } catch (err: any) {
      console.error('Create sequences error:', err.response?.data || err.message);
      const msg = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to create sequences.';
      addToast(msg, 'error');
    }
  };

  const handleCreateWindow = async (sequenceId: number, academicYearId: number) => {
    console.log('Creating window:', { sequenceId, academicYearId });
    try {
      const res = await api.post('/assessments/mark-windows/', {
        academic_year: academicYearId,
        sequence: sequenceId,
        start_date: new Date().toISOString().split('T')[0],
        end_date: null,
      });
      console.log('Window created:', res.data);

      const seq = terms.flatMap(t => t.sequences || []).find((s: any) => Number(s.id) === Number(sequenceId));
      if (seq && seq.term) {
        await api.post('/assessments/exams/ensure-for-term/', {
          term_id: seq.term,
          academic_year_id: academicYearId,
        }).catch(() => {});
      }

      addToast('Mark entry window created. Toggle Open to activate.', 'success');
      fetchData();
    } catch (err: any) {
      console.error('Create window error:', err.response?.data || err.message);
      const detail = err.response?.data;
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.sequence?.[0] || detail?.academic_year?.[0]
        || JSON.stringify(detail) || 'Failed to create window.';
      addToast(msg, 'error');
    }
  };

  const handleGenerateTermReportCards = async (termId: number) => {
    if (!selectedClass) {
      addToast('Please select a class first.', 'error');
      return;
    }
    setGeneratingTerm(termId);
    try {
      const response = await reportsApi.batchGenerate({
        class_id: selectedClass,
        term_id: String(termId),
        academic_year_id: selectedYear,
      });
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'report_cards.zip'
        : 'report_cards.zip';
      downloadBlob(new Blob([response.data], { type: 'application/zip' }), filename);
      addToast('Report cards generated successfully!', 'success');
      setShowGenerateModal(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate report cards.';
      addToast(msg, 'error');
    } finally {
      setGeneratingTerm(null);
    }
  };

  const getTermProgress = (term: Term) => {
    const sorted = [...(term.sequences || [])].sort((a, b) => a.order_number - b.order_number);
    const seq1 = sorted[0];
    const seq2 = sorted[1];
    const win1 = seq1 ? getWindowForSequence(seq1.id) : undefined;
    const win2 = seq2 ? getWindowForSequence(seq2.id) : undefined;

    const seq1Created = !!win1;
    const seq2Created = !!win2;
    const seq1Open = win1?.is_open ?? false;
    const seq2Open = win2?.is_open ?? false;

    const totalSequences = term.sequences?.length || 0;

    let canGenerate = false;
    if (totalSequences === 1) {
      const onlyWin = win1 || win2;
      canGenerate = !!onlyWin && !onlyWin.is_open && !!onlyWin.start_date;
    } else {
      canGenerate = seq1Created && seq2Created && !seq1Open && !seq2Open &&
        !!(win1?.start_date || win2?.start_date);
    }

    return { seq1Created, seq2Created, seq1Open, seq2Open, win1, win2, canGenerate, totalSequences };
  };

  const getStepStatus = (created: boolean, isOpen: boolean, prevDone: boolean): 'pending' | 'active' | 'done' => {
    if (isOpen) return 'active';
    if (created && !isOpen && prevDone) return 'done';
    if (created && !isOpen && !prevDone) return 'done';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-12 max-w-[1400px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-primary animate-pulse">sync</span>
          <p className="text-on-surface-variant font-medium">Loading exam workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Assessment Pipeline</span>
          <h1 className="text-4xl font-semibold tracking-tight text-on-surface">Exam Workflow</h1>
          <p className="text-on-surface-variant text-lg mt-2">
            Each term has two sequences (50% each). Open a sequence, teachers fill marks, close it, then move to the next.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/academic/mark-status')}
            className="bg-primary/10 border border-primary/20 text-primary px-5 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">edit_square</span>
            Mark Fill Status
          </button>
          <button
            onClick={() => navigate('/admin/academic')}
            className="bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-5 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Academic Registry
          </button>
        </div>
      </div>

      {/* Quick Selectors */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select Year</option>
            {academicYears.map((y: any) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">Class (for report cards)</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select Class</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Terms Pipeline */}
      <div className="space-y-6">
        {terms.map((term) => {
          const progress = getTermProgress(term);
          const sorted = [...(term.sequences || [])].sort((a, b) => a.order_number - b.order_number);
          const seq1 = sorted[0];
          const seq2 = sorted[1];
          const hasTwoSequences = progress.totalSequences >= 2;

          const step1Status = getStepStatus(progress.seq1Created, progress.seq1Open, false);
          const step2Status = hasTwoSequences
            ? getStepStatus(progress.seq2Created, progress.seq2Open, step1Status === 'done' && !progress.seq1Open)
            : null;

          return (
            <div key={term.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
              {/* Term Header */}
              <div className="p-6 border-b border-outline-variant/10 bg-surface-container-low/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                      progress.canGenerate ? 'bg-secondary-container text-on-secondary-container' :
                      progress.seq1Open || progress.seq2Open ? 'bg-primary/10 text-primary' :
                      'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {term.order_number}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-on-surface">{term.name}</h2>
                      <p className="text-sm text-on-surface-variant">
                        {hasTwoSequences
                          ? `${sorted[0]?.name || 'Seq 1'} (50%) + ${sorted[1]?.name || 'Seq 2'} (50%)`
                          : sorted.length === 1
                            ? `${sorted[0]?.name || 'Sequence'} (100%)`
                            : 'No sequences'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGenerateModal(term.id)}
                    disabled={!progress.canGenerate}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 ${
                      progress.canGenerate
                        ? 'bg-secondary text-white shadow-lg shadow-secondary/20 hover:opacity-90 animate-pulse-once'
                        : 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm mr-1 align-middle">description</span>
                    {progress.canGenerate ? 'Generate Report Cards' : 'Report Cards Locked'}
                  </button>
                </div>
              </div>

              {/* Sequence Steps */}
              <div className="p-6">
                {progress.totalSequences === 0 ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-outline mb-3">queue</span>
                    <p className="text-sm text-on-surface-variant mb-4">No sequences configured for this term yet.</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handleCreateSequences(term.id, 1)}
                        className="px-5 py-2.5 bg-primary/80 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm mr-1 align-middle">add</span>
                        Add 1 Sequence
                      </button>
                      <button
                        onClick={() => handleCreateSequences(term.id, 2)}
                        className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm mr-1 align-middle">add</span>
                        Add 2 Sequences
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`grid gap-6 ${hasTwoSequences ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 max-w-md'}`}>
                      <SequenceStep
                        label={seq1?.name || 'Sequence 1'}
                        weight={hasTwoSequences ? '50% of term' : '100% of term'}
                        status={step1Status}
                        window={progress.win1}
                        onToggle={() => progress.win1 && handleToggleWindow(progress.win1.id, progress.win1.is_open)}
                        onToggleShare={() => progress.win1 && handleToggleShare(progress.win1.id, progress.win1.share_results)}
                        onCreate={() => seq1 && handleCreateWindow(seq1.id, seq1.academic_year_id)}
                        toggling={togglingWindow === progress.win1?.id}
                        togglingShare={togglingShare === progress.win1?.id}
                      />

                      {hasTwoSequences && (
                        <div className="hidden md:flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl text-outline/40">arrow_forward</span>
                        </div>
                      )}

                      {hasTwoSequences && step2Status && seq2 && (
                        <SequenceStep
                          label={seq2.name}
                          weight="50% of term"
                          status={step2Status}
                          window={progress.win2}
                          onToggle={() => progress.win2 && handleToggleWindow(progress.win2.id, progress.win2.is_open)}
                          onToggleShare={() => progress.win2 && handleToggleShare(progress.win2.id, progress.win2.share_results)}
                          onCreate={() => handleCreateWindow(seq2.id, seq2.academic_year_id)}
                          toggling={togglingWindow === progress.win2?.id}
                          togglingShare={togglingShare === progress.win2?.id}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Report Card Status */}
                <div className="mt-6 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-xl ${
                      progress.canGenerate ? 'text-secondary' : 'text-outline'
                    }`}>
                      {progress.canGenerate ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-on-surface-variant">
                      {progress.canGenerate
                        ? 'All sequences closed - Ready to generate report cards'
                        : progress.seq1Open || progress.seq2Open
                          ? 'Close the open sequence first'
                          : 'Open and close all sequences first'}
                    </span>
                  </div>
                  {progress.canGenerate && (
                    <button
                      onClick={() => setShowGenerateModal(term.id)}
                      disabled={generatingTerm === term.id}
                      className="px-5 py-2.5 bg-secondary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {generatingTerm === term.id ? (
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                          Generating...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">download</span>
                          Download ZIP
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generate Confirmation Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 bg-secondary">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white">Generate Report Cards</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {terms.find(t => t.id === showGenerateModal)?.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowGenerateModal(null)}
                  className="text-white hover:rotate-90 transition-transform p-2"
                >
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-on-surface-variant text-sm">
                This will generate PDF report cards for all students in the selected class for this term.
                The ZIP file will download automatically.
              </p>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">Select Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Choose a class...</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-surface-container rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">school</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">
                      {terms.find(t => t.id === showGenerateModal)?.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {academicYears.find(y => y.id === selectedYear)?.name || ''}
                    </p>
                  </div>
                </div>
              </div>

              {!selectedClass && (
                <div className="bg-amber-500/10 text-amber-700 p-4 rounded-xl flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined">info</span>
                  Select a class above to proceed.
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setShowGenerateModal(null)}
                  className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showGenerateModal && handleGenerateTermReportCards(showGenerateModal)}
                  disabled={!selectedClass || generatingTerm === showGenerateModal}
                  className="flex-1 py-3 bg-secondary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {generatingTerm === showGenerateModal ? 'Generating...' : 'Generate & Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sequence Step Component ─────────────────────────────────────
function SequenceStep({
  label,
  weight,
  status,
  window,
  onToggle,
  onToggleShare,
  onCreate,
  toggling,
  togglingShare,
}: {
  label: string;
  weight: string;
  status: 'pending' | 'active' | 'done';
  window: MarkWindow | undefined;
  onToggle: () => void;
  onToggleShare: () => void;
  onCreate: () => void;
  toggling: boolean;
  togglingShare: boolean;
}) {
  const statusConfig = {
    pending: { icon: 'radio_button_unchecked', iconColor: 'text-outline', label: 'Not Started' },
    active: { icon: 'edit_note', iconColor: 'text-primary', label: 'Open - Teachers entering marks' },
    done: { icon: 'check_circle', iconColor: 'text-secondary', label: 'Completed' },
  };

  const cfg = statusConfig[status];

  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      status === 'active' ? 'bg-primary/5 border-primary/20' :
      status === 'done' ? 'bg-secondary/5 border-secondary/20' :
      'bg-surface-container-low border-outline-variant/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-bold text-on-surface text-sm">{label}</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">{weight}</p>
        </div>
        <span className={`material-symbols-outlined text-2xl ${cfg.iconColor}`} style={status !== 'pending' ? { fontVariationSettings: "'FILL' 1" } : {}}>
          {cfg.icon}
        </span>
      </div>

      <p className={`text-xs font-semibold mb-4 ${
        status === 'active' ? 'text-primary' :
        status === 'done' ? 'text-secondary' :
        'text-on-surface-variant'
      }`}>
        {cfg.label}
      </p>

      {status === 'pending' && !window && (
        <button
          onClick={onCreate}
          className="w-full py-2.5 bg-primary/10 text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Create Window
        </button>
      )}

      {window && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              window.is_open ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {window.is_open ? 'OPEN' : 'CLOSED'}
            </span>
          </div>

          {window.start_date && (
            <p className="text-[10px] text-outline font-mono">
              {window.start_date} → {window.end_date || 'open-ended'}
            </p>
          )}

          <button
            onClick={onToggle}
            disabled={toggling}
            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
              window.is_open
                ? 'bg-error/10 text-error hover:bg-error/20'
                : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
            }`}
          >
            {toggling ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">
                  {window.is_open ? 'lock' : 'lock_open'}
                </span>
                {window.is_open ? 'Close Sequence' : 'Open for Marks'}
              </span>
            )}
          </button>

          {!window.is_open && (
            <button
              onClick={onToggleShare}
              disabled={togglingShare}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 mt-2 ${
                window.share_results
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20'
              }`}
            >
              {togglingShare ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  Updating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">
                    {window.share_results ? 'visibility' : 'visibility_off'}
                  </span>
                  {window.share_results ? 'Visible to Parents' : 'Share with Parents'}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-secondary text-xs font-bold">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Sequence completed
        </div>
      )}
    </div>
  );
}
