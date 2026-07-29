import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { reportsApi } from '../../../services/reportsApi';
import ReportCardPreview, { type ReportCardStyle, DEFAULT_REPORT_CARD_STYLE } from '../../../components/admin/ReportCardPreview';
import ReportCardCustomizer from '../../../components/admin/ReportCardCustomizer';
import ConfettiBurst from '../../../components/ui/ConfettiBurst';

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

export default function ReportCardManagement() {
  const { addToast } = useToastStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'individual' | 'batch'>('individual');

  // Preview
  const [previewStudent, setPreviewStudent] = useState<any>(null);

  // Design customization
  const [customStyle, setCustomStyle] = useState<ReportCardStyle>(DEFAULT_REPORT_CARD_STYLE);
  const [showDesigner, setShowDesigner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // Unfilled teachers warning modal
  const [showUnfilledWarning, setShowUnfilledWarning] = useState(false);
  const [unfilledWarningData, setUnfilledWarningData] = useState<{
    teachers: { key: string; name: string; subject: string; class_name: string; sequences: string[] }[];
    termName: string;
    totalPending: number;
  } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchTerms(selectedYear);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass || selectedTerm || selectedStudent) {
      fetchReportCards();
    }
  }, [selectedClass, selectedTerm, selectedStudent]);

  // Load preview student when selection changes in individual mode
  useEffect(() => {
    if (mode === 'individual' && selectedStudent) {
      const student = students.find(s => s.id === selectedStudent);
      if (student) setPreviewStudent(student);
    } else {
      setPreviewStudent(null);
    }
  }, [selectedStudent, mode, students]);

  const fetchInitialData = async () => {
    try {
      const [classesRes, yearsRes] = await Promise.all([
        api.get('/academic/classes/').catch(() => ({ data: [] })),
        api.get('/academic/academic-years/').catch(() => ({ data: [] })),
      ]);
      setClasses(classesRes.data.results || classesRes.data || []);
      const years = yearsRes.data.results || yearsRes.data || [];
      setAcademicYears(years);
      const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
        const now = new Date();
        return now >= new Date(y.start_date) && now <= new Date(y.end_date);
      });
      if (activeYear) setSelectedYear(activeYear.id);
    } catch (err) {
      console.error('Failed to fetch initial data', err);
    }
    reportsApi.listTemplates()
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const fetchTerms = async (yearId: string) => {
    try {
      const res = await api.get(`/academic/terms/?academic_year=${yearId}`);
      setTerms(res.data.results || res.data);
      setSelectedTerm('');
    } catch (err) {
      console.error('Failed to fetch terms', err);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const res = await api.get(`/students/students/?current_class=${classId}`);
      setStudents(res.data.results || res.data);
      setSelectedStudent('');
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  const fetchReportCards = async () => {
    try {
      const params: any = {};
      if (selectedClass) params.class_id = selectedClass;
      if (selectedTerm) params.term_id = selectedTerm;
      if (selectedStudent) params.student_id = selectedStudent;
      const data = await reportsApi.listReportCards(params);
      setReportCards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch report cards', err);
    }
  };

  const getStylePayload = () => {
    const hasCustomStyle = JSON.stringify(customStyle) !== JSON.stringify(DEFAULT_REPORT_CARD_STYLE);
    return hasCustomStyle ? customStyle : undefined;
  };

  const doBatchGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await reportsApi.batchGenerate({
        class_id: selectedClass,
        term_id: selectedTerm,
        academic_year_id: selectedYear,
        style_overrides: getStylePayload(),
      });
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'report_cards.zip'
        : 'report_cards.zip';
      downloadBlob(new Blob([response.data], { type: 'application/zip' }), filename);
      fetchReportCards();
      setShowConfetti(true);
      addToast('Report cards generated! Parents are going to love these.', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate report cards.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedTerm, selectedYear, customStyle]);

  const handleBatchGenerate = async () => {
    if (!selectedClass || !selectedTerm) {
      setError('Please select both a class and a term.');
      return;
    }

    // Check for teachers who haven't filled marks
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      params.append('term', selectedTerm);
      params.append('class', selectedClass);
      params.append('only_open', 'true');

      const res = await api.get(`/assessments/mark-windows/mark-filling-stats/?${params.toString()}`);
      const data: any[] = res.data || [];

      // Group unfilled teachers by identity - each teacher appears once with all pending sequences
      const teacherMap = new Map<string, { key: string; name: string; subject: string; class_name: string; sequences: string[] }>();
      let firstTermName = '';

      for (const termData of data) {
        for (const seq of termData.sequences) {
          if (seq.is_open && seq.not_filled_teachers.length > 0) {
            if (!firstTermName) firstTermName = termData.term_name;
            for (const t of seq.not_filled_teachers) {
              const key = t.id || `${t.name}_${t.subject}_${t.class_name}`;
              if (teacherMap.has(key)) {
                teacherMap.get(key)!.sequences.push(seq.sequence_name);
              } else {
                teacherMap.set(key, {
                  key,
                  name: t.name,
                  subject: t.subject,
                  class_name: t.class_name,
                  sequences: [seq.sequence_name],
                });
              }
            }
          }
        }
      }

      const grouped = Array.from(teacherMap.values());

      if (grouped.length > 0) {
        setUnfilledWarningData({
          teachers: grouped,
          termName: firstTermName,
          totalPending: grouped.length,
        });
        setShowUnfilledWarning(true);
        return;
      }
    } catch {
      // If check fails, proceed anyway
    }

    await doBatchGenerate();
  };

  const handleNotifyPending = async () => {
    setNotifying(true);
    try {
      const payload: any = {};
      if (selectedYear) payload.academic_year = selectedYear;
      if (selectedTerm) payload.term_id = selectedTerm;
      if (selectedClass) payload.class_id = selectedClass;
      const res = await api.post('/assessments/mark-windows/notify-pending-teachers/', payload);
      addToast(res.data.detail || 'Notifications sent!', 'success');
    } catch {
      addToast('Failed to send notifications.', 'error');
    } finally {
      setNotifying(false);
    }
  };

  const handleSingleGenerate = async () => {
    if (!selectedStudent || !selectedTerm) {
      setError('Please select both a student and a term.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const response = await reportsApi.generateSingle({
        student_id: selectedStudent,
        term_id: selectedTerm,
        academic_year_id: selectedYear,
        style_overrides: getStylePayload(),
      });
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'report_card.pdf'
        : 'report_card.pdf';
      downloadBlob(new Blob([response.data], { type: 'application/pdf' }), filename);
      fetchReportCards();
      setShowConfetti(true);
      addToast('Report card ready! This is what parents will remember.', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate report card.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (id: string, studentName: string) => {
    try {
      const response = await reportsApi.downloadReportCard(id);
      const filename = `Report_Card_${studentName.replace(/\s+/g, '_')}.pdf`;
      downloadBlob(new Blob([response.data], { type: 'application/pdf' }), filename);
    } catch (err) {
      console.error('Failed to download report card', err);
    }
  };

  const selectedTermName = terms.find((t: any) => t.id === selectedTerm)?.name || '1ST TERM';
  const selectedYearName = academicYears.find((y: any) => y.id === selectedYear)?.name || '2024/2025';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Unfilled Teachers Warning Modal */}
      {showUnfilledWarning && unfilledWarningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUnfilledWarning(false)} />

          {/* Modal */}
          <div className="relative bg-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-error/30 animate-in fade-in zoom-in-95 duration-200">
            {/* Red gradient header */}
            <div className="bg-gradient-to-br from-error to-error/80 p-8 rounded-t-3xl text-white">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">⚠️ Incomplete Marks Detected</h2>
                  <p className="mt-1 text-white/80 text-sm leading-relaxed">
                    The following teachers have <strong>not yet submitted marks</strong> for one or more open sequences in{' '}
                    <strong>{unfilledWarningData.termName}</strong>. Generating report cards now will produce{' '}
                    <strong>inaccurate or incomplete results</strong> for affected students.
                  </p>
                </div>
              </div>

              {/* Stats pills */}
              <div className="mt-6 flex gap-3 flex-wrap">
                <div className="bg-white/20 rounded-xl px-4 py-2 text-sm font-bold">
                  {unfilledWarningData.totalPending} teacher{unfilledWarningData.totalPending !== 1 ? 's' : ''} pending
                </div>
              </div>
            </div>

            {/* Teachers list */}
            <div className="p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-error mb-3">Teachers With Missing Submissions</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {unfilledWarningData.teachers.map((t) => (
                  <div key={t.key} className="bg-error/5 border border-error/15 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface text-sm">{t.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{t.subject} &bull; {t.class_name}</p>
                      </div>
                      <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">pending</span>
                    </div>
                    {/* Pending sequences as pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {t.sequences.map((seq) => (
                        <span
                          key={seq}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-error/10 text-error px-2.5 py-1 rounded-lg border border-error/20"
                        >
                          <span className="material-symbols-outlined text-[11px]">remove_done</span>
                          {seq}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-outline-variant/15" />

              <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">
                Do you want to continue generating report cards despite missing submissions? Students without marks will show empty scores.
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleNotifyPending}
                  disabled={notifying}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-lg ${notifying ? 'animate-spin' : ''}`}>
                    {notifying ? 'sync' : 'notifications'}
                  </span>
                  {notifying ? 'Notifying...' : 'Notify All Pending'}
                </button>
                <button
                  onClick={() => setShowUnfilledWarning(false)}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold border border-outline-variant/30 text-on-surface hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowUnfilledWarning(false);
                    await doBatchGenerate();
                  }}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold bg-error text-white hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-error/20"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  Yes, Generate Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            description
          </span>
          <h1 className="text-2xl font-bold text-on-surface">Report Card Generator</h1>
        </div>
        <p className="text-on-surface-variant">
          Generate official PDF report cards with customizable design
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left Panel - Controls + Customizer */}
        <div className="xl:col-span-3 space-y-4">
          {/* Mode Toggle */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-4">
            <label className="text-sm font-medium text-on-surface mb-3 block">Generation Mode</label>
            <div className="flex gap-4">
              <button
                onClick={() => { setMode('individual'); setSelectedStudent(''); setPreviewStudent(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === 'individual'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-lg mr-2">person</span>
                Individual
              </button>
              <button
                onClick={() => { setMode('batch'); setSelectedStudent(''); setPreviewStudent(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === 'batch'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-lg mr-2">groups</span>
                Class Batch
              </button>
            </div>
          </div>

          {/* Selection */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
            <h2 className="text-lg font-semibold text-on-surface mb-4">Selection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Academic Year *</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm"
                >
                  <option value="">Select Year</option>
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Term *</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  disabled={!selectedYear}
                  className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm disabled:opacity-50"
                >
                  <option value="">Select Term</option>
                  {terms.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Class *</label>
                <select
                  value={selectedClass}
                  onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                  className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm"
                >
                  <option value="">Select Class</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {mode === 'individual' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Student *</label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    disabled={!selectedClass}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm disabled:opacity-50"
                  >
                    <option value="">Select Student</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Student List (Individual mode) */}
          {mode === 'individual' && selectedClass && students.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <h2 className="text-lg font-semibold text-on-surface mb-4">
                Students ({students.length})
                {selectedStudent && <span className="text-sm font-normal text-on-surface-variant ml-2">- 1 selected</span>}
              </h2>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {students.map((student: any) => (
                  <label
                    key={student.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedStudent === student.id
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="radio"
                      name="student-select"
                      checked={selectedStudent === student.id}
                      onChange={() => setSelectedStudent(student.id)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface truncate">{student.full_name}</div>
                      <div className="text-sm text-on-surface-variant truncate">
                        {student.admission_number} • {student.current_class?.name || 'No class'}
                      </div>
                    </div>
                    {selectedStudent === student.id && (
                      <span className="material-symbols-outlined text-primary text-xl">visibility</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={mode === 'individual' ? handleSingleGenerate : handleBatchGenerate}
            disabled={generating || !selectedTerm || (mode === 'individual' ? !selectedStudent : !selectedClass)}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin">sync</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">description</span>
                {mode === 'individual' ? 'Generate Report Card' : 'Batch Generate (ZIP)'}
              </>
            )}
          </button>

          {/* Customize Design Toggle */}
          <button
            onClick={() => setShowDesigner(!showDesigner)}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-all ${
              showDesigner
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface-container-lowest border-outline-variant/15 text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-lg">palette</span>
            {showDesigner ? 'Hide Design Studio' : 'Customize Design'}
          </button>

          {/* Design Studio (collapsible) */}
          {showDesigner && (
            <ReportCardCustomizer
              style={customStyle}
              onChange={setCustomStyle}
              templates={templates}
              onTemplateLoad={setCustomStyle}
              onTemplatesRefresh={fetchInitialData}
            />
          )}
        </div>

        {/* Right Panel - Preview + History */}
        <div className="xl:col-span-2 xl:sticky xl:top-6 xl:self-start space-y-4">
          {/* Live Preview */}
          {mode === 'individual' && previewStudent ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <h2 className="text-lg font-semibold text-on-surface mb-4">Live Preview</h2>
              <div className="flex justify-center overflow-x-auto py-2">
                <ReportCardPreview
                  style={customStyle}
                  studentName={previewStudent.full_name}
                  className={previewStudent.current_class?.name || 'N/A'}
                  admissionNumber={previewStudent.admission_number}
                  termName={selectedTermName}
                  academicYear={selectedYearName}
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <h2 className="text-lg font-semibold text-on-surface mb-4">Report Card Preview</h2>
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-40">description</span>
                <p className="text-sm text-center">
                  {mode === 'individual'
                    ? 'Select a student to preview their report card'
                    : 'Choose batch mode and select a class to generate all report cards'}
                </p>
              </div>
            </div>
          )}

          {/* Generation History */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
            <h2 className="text-lg font-semibold text-on-surface mb-4">Generated Report Cards</h2>
            {reportCards.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2 block">description</span>
                <p className="text-on-surface-variant text-sm font-medium">No report cards yet. Generate your first ones - parents are waiting!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {reportCards.slice(0, 20).map((rc: any) => (
                  <div
                    key={rc.id}
                    className="flex items-center justify-between p-3 bg-surface-container rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-on-surface text-sm truncate">{rc.student_name}</div>
                      <div className="text-xs text-on-surface-variant">{rc.admission_number} • {rc.term_name}</div>
                    </div>
                    <button
                      onClick={() => handleDownload(rc.id, rc.student_name)}
                      className="text-primary hover:underline text-xs font-semibold flex items-center gap-1 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
