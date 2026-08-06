import { useState, useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { useTenantStore } from '../../../stores/tenantStore';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';
import StudentIDCard, { type StudentIDCardData, type IDCardStyle, DEFAULT_CARD_STYLE } from '../../../components/admin/StudentIDCard';
import IDCardCustomizer from '../../../components/admin/IDCardCustomizer';
import PreviewFullscreenModal from '../../../components/admin/PreviewFullscreenModal';
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

export default function IDCardGenerator() {
  const { addToast } = useToastStore();
  const { activeSectionId } = useSectionStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [outputFormat, setOutputFormat] = useState('single');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'individual' | 'batch'>('individual');

  // Preview state
  const [previewStudent, setPreviewStudent] = useState<any>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back' | 'both'>('both');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Card style customization
  const [customStyle, setCustomStyle] = useState<IDCardStyle>(DEFAULT_CARD_STYLE);
  const [showDesigner, setShowDesigner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Tenant info for card preview
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, [activeSectionId]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass || selectedYear) {
      fetchGeneratedCards();
    }
  }, [selectedClass, selectedYear]);

  // Load preview: individual = selected student, batch = first selected or first in class
  useEffect(() => {
    if (mode === 'individual') {
      const student = selectedStudents.length > 0
        ? students.find(s => s.id === selectedStudents[0])
        : null;
      setPreviewStudent(student || null);
    } else {
      const student = selectedStudents.length > 0
        ? students.find(s => s.id === selectedStudents[0])
        : students[0] || null;
      setPreviewStudent(student || null);
    }
  }, [selectedStudents, mode, students]);

  // Auto-scroll the preview into view so it is never missed
  useEffect(() => {
    if (previewStudent) {
      const t = setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [previewStudent, mode]);

  const fetchInitialData = async () => {
    try {
      const [classesRes, yearsRes, templatesRes, tenantRes] = await Promise.all([
        api.get('/academic/classes/', { params: activeSectionId ? { stream: activeSectionId } : undefined }),
        api.get('/academic/academic-years/'),
        api.get('/documents/id-card-templates/'),
        api.get('/tenants/').catch(() => null),
      ]);
      setClasses(classesRes.data.results || classesRes.data);
      const years = yearsRes.data.results || yearsRes.data;
      setAcademicYears(years);
      const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
        const now = new Date();
        return now >= new Date(y.start_date) && now <= new Date(y.end_date);
      });
      if (activeYear) setSelectedYear(activeYear.id);
      setTemplates(templatesRes.data.results || templatesRes.data);
      if (tenantRes?.data) {
        const results = tenantRes.data.results || tenantRes.data;
        const activeTenantId = useTenantStore.getState().activeTenantId;
        const tenant = Array.isArray(results)
          ? results.find((t: any) => t.id === activeTenantId) || results[0]
          : results;
        setTenantInfo(tenant);
      }
    } catch (err) {
      console.error('Failed to fetch initial data', err);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const res = await api.get(`/students/students/?current_class=${classId}&status=active`);
      setStudents(res.data.results || res.data);
      setSelectedStudents([]);
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  const fetchGeneratedCards = async () => {
    try {
      const params: any = {};
      if (selectedYear) params.academic_year = selectedYear;
      const res = await api.get('/documents/id-cards/', { params });
      setGeneratedCards(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch generated cards', err);
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    if (mode === 'individual') {
      setSelectedStudents([studentId]);
    } else {
      setSelectedStudents(prev =>
        prev.includes(studentId)
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    }
  };

  const handleGenerate = async () => {
    if (!selectedYear) {
      setError('Please select an academic year.');
      return;
    }
    if (selectedStudents.length === 0 && !selectedClass) {
      setError('Please select a class or students.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const payload: any = {
        academic_year_id: selectedYear,
        output_format: mode === 'individual' ? 'single' : outputFormat,
      };

      if (selectedTemplate) payload.template_id = selectedTemplate;

      // Send style overrides if user customized from defaults
      const hasCustomStyle = JSON.stringify(customStyle) !== JSON.stringify(DEFAULT_CARD_STYLE);
      if (hasCustomStyle) {
        payload.style_overrides = customStyle;
      }

      if (mode === 'individual') {
        payload.student_ids = selectedStudents;
      } else {
        payload.class_id = selectedClass;
      }

      const response = await api.post('/documents/id-cards/generate/', payload, {
        responseType: 'arraybuffer',
      });

      const contentType = String(response.headers['content-type'] || '');
      if (contentType.includes('application/json')) {
        const text = new TextDecoder().decode(response.data);
        const parsed = JSON.parse(text);
        setError(parsed.detail || parsed.error || 'Generation failed.');
        return;
      }

      const contentDisposition = String(response.headers['content-disposition'] || '');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'id_cards.pdf'
        : 'id_cards.pdf';

      downloadBlob(new Blob([response.data], { type: contentType }), filename);
      fetchGeneratedCards();
      setShowConfetti(true);
      const count = mode === 'individual' ? 1 : selectedStudents.length;
      addToast(`ID cards ready! ${count} student${count !== 1 ? 's' : ''} now have their official school ID.`, 'success');
    } catch (err: any) {
      console.error('ID Card generation error:', err);
      if (err.response?.data) {
        const ct = String(err.response.headers?.['content-type'] || '');
        if (ct.includes('application/json')) {
          try {
            const text = new TextDecoder().decode(err.response.data);
            const parsed = JSON.parse(text);
            setError(parsed.detail || parsed.error || `Server error (${err.response.status})`);
          } catch {
            setError(`Server error (${err.response.status})`);
          }
        } else {
          setError(`Server error (${err.response.status})`);
        }
      } else {
        setError(err.message || 'Failed to generate ID cards.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPrinted = async (cardId: string) => {
    try {
      await api.post(`/documents/id-cards/${cardId}/mark_printed/`);
      fetchGeneratedCards();
    } catch (err) {
      console.error('Failed to mark as printed', err);
    }
  };

  // Build card data from student + tenant
  const buildCardData = (student: any): StudentIDCardData => {
    const className = student.class_display || student.current_class_name || student.current_class?.name || 'N/A';
    return {
      school_name: tenantInfo?.school_name || 'School Name',
      school_logo: tenantInfo?.logo_url || tenantInfo?.logo || undefined,
      school_motto: tenantInfo?.motto || undefined,
      school_website: tenantInfo?.email || undefined,
      school_address: tenantInfo?.address || undefined,
      school_phone: tenantInfo?.phone || undefined,
      school_email: tenantInfo?.email || undefined,
      student_name: student.full_name || `${student.last_name} ${student.first_name}`,
      admission_number: student.admission_number || 'N/A',
      class_name: className,
      gender: student.gender === 'M' ? 'Male' : 'Female',
      date_of_birth: student.date_of_birth
        ? new Date(student.date_of_birth).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
        : '-',
      blood_group: student.blood_group || undefined,
      emergency_contact: student.emergency_contact || undefined,
      photo_url: student.photo_url || undefined,
      academic_year: academicYears.find(y => y.id === selectedYear)?.name || undefined,
    };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            badge
          </span>
          <h1 className="text-2xl font-bold text-on-surface">ID Card Generator</h1>
        </div>
        <p className="text-on-surface-variant">
          Generate premium student identification cards with live preview
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left Panel - Controls + Customizer (scrollable) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Mode Toggle */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-4">
            <label className="text-sm font-medium text-on-surface mb-3 block">Generation Mode</label>
            <div className="flex gap-4">
              <button
                onClick={() => { setMode('individual'); setSelectedStudents([]); setPreviewStudent(null); }}
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
                onClick={() => { setMode('batch'); setSelectedStudents([]); setPreviewStudent(null); }}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant mb-2 block">Academic Year *</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Year</option>
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant mb-2 block">Class *</label>
                <select
                  value={selectedClass}
                  onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudents([]); }}
                  className="w-full px-4 py-3 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Class</option>
                  {classes.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'batch' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-on-surface-variant mb-2 block">Output Format</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="multi">Multi-page PDF (cards on A4)</option>
                    <option value="zip">ZIP Archive (individual PDFs)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-on-surface-variant mb-2 block">Template (Optional)</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Default Template</option>
                    {templates.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Student List */}
          {selectedClass && students.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-on-surface">
                  Students ({students.length})
                  {selectedStudents.length > 0 && (
                    <span className="text-sm font-normal text-on-surface-variant ml-2">
                      - {selectedStudents.length} selected
                    </span>
                  )}
                </h2>
                {mode === 'batch' && (
                  <button
                    onClick={handleSelectAll}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {students.map((student: any) => (
                  <label
                    key={student.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedStudents.includes(student.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type={mode === 'individual' ? 'radio' : 'checkbox'}
                      name={mode === 'individual' ? 'student-select' : undefined}
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => handleToggleStudent(student.id)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface truncate">{student.full_name}</div>
                      <div className="text-sm text-on-surface-variant truncate">
                        {student.admission_number} • {student.class_display || 'No class'}
                      </div>
                    </div>
                    {student.photo_url && (
                      <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    )}
                    {mode === 'individual' && selectedStudents.includes(student.id) && (
                      <span className="material-symbols-outlined text-primary text-xl">visibility</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {selectedClass && students.length === 0 && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2 block">group_off</span>
              <p className="text-on-surface-variant">No active students found in this class.</p>
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
            onClick={handleGenerate}
            disabled={generating || !selectedYear || selectedStudents.length === 0}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin">sync</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">badge</span>
                {mode === 'individual' ? 'Generate ID Card' : `Generate ${selectedStudents.length || ''} ID Cards`}
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
            <IDCardCustomizer
              style={customStyle}
              onChange={setCustomStyle}
              templates={templates}
              onTemplateLoad={setCustomStyle}
              onTemplatesRefresh={fetchInitialData}
            />
          )}
        </div>

        {/* Right Panel - Preview only (sticky, always visible) */}
        <div className="xl:col-span-2 xl:sticky xl:top-6 xl:self-start space-y-4">
          {/* Live Preview */}
          {previewStudent ? (
            <div ref={previewRef} className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h2 className="text-lg font-semibold text-on-surface">Live Preview</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
                    {(['both', 'front', 'back'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPreviewSide(s)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          previewSide === s
                            ? 'bg-primary text-white'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowFullscreen(true)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                    title="Open fullscreen preview"
                  >
                    <span className="material-symbols-outlined text-sm">fullscreen</span>
                    Enlarge
                  </button>
                </div>
              </div>
              {mode === 'batch' && (
                <p className="text-xs text-on-surface-variant mb-2 -mt-2">
                  {selectedStudents.length > 1
                    ? `Previewing first of ${selectedStudents.length} selected students`
                    : selectedStudents.length === 1
                      ? 'Previewing selected student'
                      : 'Previewing first student in class'}
                </p>
              )}
              <div
                className="flex justify-center overflow-x-auto py-2 cursor-zoom-in"
                onClick={() => setShowFullscreen(true)}
                title="Click to enlarge"
              >
                <StudentIDCard data={buildCardData(previewStudent)} side={previewSide} style={customStyle} />
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
              <h2 className="text-lg font-semibold text-on-surface mb-4">Card Preview</h2>
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-40">badge</span>
                <p className="text-sm text-center">
                  {mode === 'individual'
                    ? 'Select a student to preview their ID card'
                    : 'Select students to preview their ID cards'}
                </p>
              </div>
            </div>
          )}

          {/* Generation History */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-6">
            <h2 className="text-lg font-semibold text-on-surface mb-4">Recent Generations</h2>
            {generatedCards.length === 0 ? (
              <p className="text-on-surface-variant text-center py-6 text-sm font-medium">
                No ID cards yet. Generate your first batch - students are waiting!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {generatedCards.slice(0, 20).map((card: any) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between p-3 bg-surface-container rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-on-surface text-sm truncate">{card.student_name}</div>
                      <div className="text-xs text-on-surface-variant">{card.student_admission} • {card.academic_year_name}</div>
                    </div>
                    {card.is_printed ? (
                      <span className="px-2 py-0.5 bg-success-container text-on-success-container text-xs rounded-full flex items-center gap-1 flex-shrink-0">
                        <span className="material-symbols-outlined text-xs">check</span>
                        Printed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkPrinted(card.id)}
                        className="px-2 py-0.5 bg-surface-container-highest text-on-surface text-xs rounded-full hover:bg-surface-container-high flex-shrink-0"
                      >
                        Mark Printed
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen preview modal */}
      <PreviewFullscreenModal
        open={showFullscreen && !!previewStudent}
        onClose={() => setShowFullscreen(false)}
        title={previewStudent ? `ID Card — ${previewStudent.full_name}` : 'ID Card Preview'}
        fit="contain"
        maxScale={6}
        controls={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
              {(['both', 'front', 'back'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPreviewSide(s)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    previewSide === s
                      ? 'bg-primary text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {previewStudent && (
          <StudentIDCard data={buildCardData(previewStudent)} side={previewSide} style={customStyle} />
        )}
      </PreviewFullscreenModal>
    </div>
  );
}
