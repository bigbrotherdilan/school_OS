import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../../stores/toastStore';
import { useTeacherData } from '../../../hooks/useTeacherData';
import { useAuthStore } from '../../../stores/authStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { useAutoSave } from '../../../hooks/useAutoSave';

// ─── Types ───────────────────────────────────────────────────────
interface Assignment {
  id: string;
  subject: string;
  subject_name: string;
  academic_class: string;
  class_name: string;
  academic_year: string;
  academic_year_name: string;
}

interface Sequence {
  id: number | string;
  name: string;
  order_number: number;
  term: number | string;
  term_name: string;
  academic_year_id: number | string;
}

interface TermWithSequences {
  id: number | string;
  name: string;
  order_number: number;
  sequences: Sequence[];
}

interface ExamDef {
  id: string;
  name: string;
  weight: string;
  sequence: number;
}

interface BackendStudent {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
}

interface BackendExamResult {
  id: string;
  exam: string;
  student: string;
  subject: string;
  sequence?: string | number;
  score: string | number | null;
  comments: string;
}

interface StudentRow {
  id: string;
  name: string;
  avatar: string;
  marks: Record<string, number | ''>;
}

// ─── Component ───────────────────────────────────────────────────
export default function TeacherAssessmentsPage() {
  const { t } = useTranslation('teacher');
  const { addToast } = useToastStore();
  const {
    fetchMyAssignments,
    fetchStudents,
    fetchTerms,
    checkMarkWindowStatus,
    fetchExams,
    fetchExamResults,
    bulkUpdateMarks,
    createExam,
  } = useTeacherData();

  const [searchParams] = useSearchParams();
  const urlSequence = searchParams.get('sequence');

  const { tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const activeTenant = tenants.find(t => t.id === activeTenantId);

  const isFrancophone = activeTenant?.education_type === 'francophone' || activeTenant?.education_type === 'bilingual';
  const maxScore = isFrancophone ? 20 : 100;
  const passMark = isFrancophone ? 10 : 50;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [terms, setTerms] = useState<TermWithSequences[]>([]);
  const [allSequences, setAllSequences] = useState<Sequence[]>([]);
  const [exams, setExams] = useState<ExamDef[]>([]);

  const [selectedAssignment, setSelectedAssignment] = useState<string>('');
  const [selectedSequence, setSelectedSequence] = useState<string>('');

  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(false);
  const [windowMessage, setWindowMessage] = useState<string>('');

  const [students, setStudents] = useState<StudentRow[]>([]);
  const dirtyMarks = useRef<Set<string>>(new Set());

  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // Initial setup of assignments and sequences
  useEffect(() => {
    const init = async () => {
      try {
        const [assignData, termData] = await Promise.all([
          fetchMyAssignments(),
          fetchTerms(),
        ]);
        setAssignments(assignData);
        setTerms(termData);

        const seqs: Sequence[] = [];
        for (const t of termData) {
          if (t.sequences) {
            for (const s of t.sequences) {
              seqs.push({ ...s, term_name: t.name, term: t.id });
            }
          }
        }
        setAllSequences(seqs);

        if (assignData.length > 0) {
          setSelectedAssignment(assignData[0].id);
        }
        if (seqs.length > 0) {
          const seqToSelect = urlSequence && seqs.some((s: Sequence) => String(s.id) === urlSequence)
            ? urlSequence
            : String(seqs[0].id);
          setSelectedSequence(seqToSelect);
        }
      } catch (err) {
        console.error('Failed to init assessments page:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, [fetchMyAssignments, fetchTerms, urlSequence]);

  const currentAssignment = assignments.find(a => a.id === selectedAssignment);
  const currentClassId = currentAssignment?.academic_class || '';
  const currentSubjectId = currentAssignment?.subject || '';
  const currentSeq = allSequences.find(s => String(s.id) === selectedSequence);

  // Check window status and fetch/ensure sequence assessment columns
  useEffect(() => {
    if (!selectedSequence) return;

    const checkWindowAndExams = async () => {
      const status = await checkMarkWindowStatus(selectedSequence);
      setIsWindowOpen(status.is_open);
      setWindowMessage(status.message);

      let examData = await fetchExams(selectedSequence);

      // If no explicit exam object exists in DB for this sequence/term,
      // create a default sequence assessment automatically or use sequence fallback
      if (examData.length === 0) {
        const seqObj = allSequences.find(s => String(s.id) === selectedSequence);
        if (seqObj) {
          try {
            await createExam({
              name: t('{{name}} Assessment', { name: seqObj.name }),
              term: seqObj.term,
              academic_year: seqObj.academic_year_id,
              weight: 100,
            });
            examData = await fetchExams(selectedSequence);
          } catch {
            // Fallback synthetic exam column if createExam API fails
            examData = [{
              id: `seq_${selectedSequence}`,
              name: t('{{name}} Marks', { name: seqObj.name }),
              weight: '100',
              sequence: Number(selectedSequence),
            }];
          }
        }
      }

      setExams(examData.length > 0 ? examData : [{
        id: `seq_${selectedSequence}`,
        name: t('{{name}} Marks', { name: currentSeq?.name || 'Sequence' }),
        weight: '100',
        sequence: Number(selectedSequence),
      }]);
    };

    checkWindowAndExams();
  }, [selectedSequence, checkMarkWindowStatus, fetchExams, createExam, allSequences, currentSeq?.name]);

  const handleAutoSave = useCallback(async () => {
    const payload = Array.from(dirtyMarks.current).map(key => {
      const [studentId, examId] = key.split(':');
      const student = students.find(s => s.id === studentId);
      const score = student?.marks[examId];
      return {
        exam: examId.startsWith('seq_') ? undefined : examId,
        student: studentId,
        subject: currentSubjectId,
        sequence: selectedSequence || undefined,
        score: score === '' ? null : Number(score),
      };
    });
    if (payload.length > 0) {
      await bulkUpdateMarks(payload);
    }
    dirtyMarks.current.clear();
  }, [students, currentSubjectId, selectedSequence, bulkUpdateMarks]);

  const { saveState, markDirty, triggerSave, resetState } = useAutoSave(handleAutoSave, {
    enabled: isWindowOpen,
  });

  // Load student rows & existing scores for the gradebook
  const loadGradebook = useCallback(async () => {
    if (!currentClassId || !currentSubjectId) {
      setStudents([]);
      return;
    }

    setTableLoading(true);
    try {
      const studentData: BackendStudent[] = await fetchStudents(currentClassId);

      const allResults: BackendExamResult[] = [];
      if (exams.length > 0) {
        for (const exam of exams) {
          const results = await fetchExamResults({
            exam: exam.id.startsWith('seq_') ? undefined : exam.id,
            subject: currentSubjectId,
            classId: currentClassId,
            sequence: selectedSequence || undefined,
          });
          allResults.push(...results);
        }
      }

      const rows: StudentRow[] = studentData.map(s => {
        const marks: Record<string, number | ''> = {};
        for (const exam of exams) {
          const result = allResults.find(
            r => r.student === s.id && (r.exam === exam.id || (exam.id.startsWith('seq_') && String(r.sequence) === selectedSequence))
          );
          marks[exam.id] = result?.score != null ? Number(result.score) : '';
        }
        return {
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          avatar: s.photo_url || `https://ui-avatars.com/api/?name=${s.first_name}+${s.last_name}&background=00236f&color=fff&size=64`,
          marks,
        };
      });

      setStudents(rows);
      dirtyMarks.current.clear();
      resetState();
    } catch (err) {
      console.error('Failed to load gradebook:', err);
      addToast(t('Failed to load student data.'), 'error');
    } finally {
      setTableLoading(false);
    }
  }, [currentClassId, currentSubjectId, exams, selectedSequence, fetchStudents, fetchExamResults, addToast, resetState]);

  useEffect(() => {
    loadGradebook();
  }, [loadGradebook]);

  const handleMarkChange = (studentId: string, examId: string, value: string) => {
    if (!isWindowOpen) return;

    const numValue = value === '' ? '' : Math.min(maxScore, Math.max(0, Number(value)));
    setStudents(prev =>
      prev.map(s =>
        s.id === studentId
          ? { ...s, marks: { ...s.marks, [examId]: numValue } }
          : s
      )
    );
    dirtyMarks.current.add(`${studentId}:${examId}`);
    markDirty();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    examId: string
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`mark_input_${rowIndex + 1}_${examId}`) as HTMLInputElement | null;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(`mark_input_${rowIndex - 1}_${examId}`) as HTMLInputElement | null;
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  };

  const handleSubmit = async () => {
    if (!isWindowOpen) {
      addToast(t('Marks entry is closed for this sequence.'), 'error');
      return;
    }

    dirtyMarks.current.clear();
    for (const s of students) {
      for (const e of exams) {
        if (s.marks[e.id] !== '' && s.marks[e.id] !== undefined) {
          dirtyMarks.current.add(`${s.id}:${e.id}`);
        }
      }
    }

    try {
      await triggerSave();
      addToast(t('Marks officially submitted to Administration.'), 'success');
    } catch {
      addToast(t('Failed to submit marks. Please try again.'), 'error');
    }
  };

  const calculateAverage = (examId: string) => {
    const validMarks = students
      .map(s => s.marks[examId])
      .filter((m): m is number => typeof m === 'number');
    if (validMarks.length === 0) return 0;
    return Math.round((validMarks.reduce((a, b) => a + b, 0) / validMarks.length) * 10) / 10;
  };

  const calculateOverallPassRate = () => {
    if (students.length === 0 || exams.length === 0) return 0;
    const passed = students.filter(s => {
      const scores = exams.map(e => Number(s.marks[e.id]) || 0);
      const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      return avg >= passMark;
    }).length;
    return Math.round((passed / students.length) * 100);
  };

  const getHighestScore = () => {
    let max = 0;
    let label = '';
    students.forEach(s => {
      exams.forEach(e => {
        const score = Number(s.marks[e.id]) || 0;
        if (score > max) {
          max = score;
          label = e.name;
        }
      });
    });
    return { max, label };
  };

  const getLowestScore = () => {
    let min = maxScore + 1;
    let label = '';
    students.forEach(s => {
      exams.forEach(e => {
        const score = s.marks[e.id];
        if (typeof score === 'number' && score < min) {
          min = score;
          label = e.name;
        }
      });
    });
    return { min: min > maxScore ? 0 : min, label };
  };

  const getMissingEntries = () => {
    let count = 0;
    students.forEach(s => {
      exams.forEach(e => {
        if (s.marks[e.id] === '' || s.marks[e.id] === undefined) count++;
      });
    });
    return count;
  };

  const uniqueAssignments = assignments.reduce<Assignment[]>((acc, curr) => {
    const key = `${curr.academic_class}:${curr.subject}`;
    if (!acc.find(a => `${a.academic_class}:${a.subject}` === key)) {
      acc.push(curr);
    }
    return acc;
  }, []);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-primary animate-pulse">fact_check</span>
          <p className="text-sm text-on-surface-variant font-medium">{t('Loading assessments...')}</p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">school</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800">{t('No Assignments Found')}</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {t("You don't have any teaching assignments yet. Please contact your school administrator to be assigned to classes and subjects.")}
          </p>
        </div>
      </div>
    );
  }

  const highest = getHighestScore();
  const lowest = getLowestScore();

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('Assessments & Marks')}</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {currentAssignment ? `${currentAssignment.class_name} - ${currentAssignment.subject_name}` : t('Select an assignment')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <div className="bg-white px-1 py-1 border border-slate-200 rounded-xl shadow-sm flex-1 sm:flex-none">
            <select
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-primary focus:outline-none cursor-pointer border-none py-2 sm:py-1.5 pl-3 pr-8"
            >
              {uniqueAssignments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.class_name} - {a.subject_name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white px-1 py-1 border border-slate-200 rounded-xl shadow-sm flex-1 sm:flex-none">
            <select
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-slate-600 focus:outline-none cursor-pointer border-none py-2 sm:py-1.5 pl-3 pr-8"
            >
              {terms.map(t => (
                <optgroup key={t.id} label={t.name}>
                  {(t.sequences || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Sequence Status Banner */}
      {!isWindowOpen && selectedSequence && (
        <div className="bg-error/5 border border-error/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
          </div>
          <div>
            <h4 className="font-bold text-error text-sm">{t('Marks Entry Closed')}</h4>
            <p className="text-xs text-error/70 mt-0.5">{windowMessage || t('This sequence is not open for marks entry. Contact your administrator to activate it.')}</p>
          </div>
        </div>
      )}

      {isWindowOpen && selectedSequence && (
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_open</span>
          <p className="text-xs font-semibold text-secondary">
            {windowMessage || t('Marks entry is open for {{name}}.', { name: currentSeq?.name || 'this sequence' })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <section className="lg:col-span-9 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400">
              {t('Class Gradebook')} <span className="text-primary ml-2">({currentSeq?.name || t('Sequence Marks')})</span>
            </h3>

            <div className={`flex items-center gap-2 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-300 ${
              saveState === 'saved' ? 'bg-secondary/10 text-secondary' :
              saveState === 'saving' ? 'bg-primary/10 text-primary' :
              'bg-slate-100 text-slate-400'
            }`}>
              {saveState === 'saved' && <><span className="material-symbols-outlined text-[12px] sm:text-[14px]">cloud_done</span> <span className="hidden sm:inline">{t('Saved to Cloud')}</span><span className="sm:hidden">{t('Saved')}</span></>}
              {saveState === 'saving' && <><span className="material-symbols-outlined text-[12px] sm:text-[14px] animate-spin">sync</span> {t('Saving...')}</>}
              {saveState === 'unsaved' && <><span className="material-symbols-outlined text-[12px] sm:text-[14px]">edit</span> <span className="hidden sm:inline">{t('Unsaved changes')}</span><span className="sm:hidden">{t('Unsaved')}</span></>}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {tableLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <span className="material-symbols-outlined text-3xl text-primary animate-spin">sync</span>
                  <p className="text-xs text-on-surface-variant font-medium">{t('Loading gradebook...')}</p>
                </div>
              </div>
            ) : students.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">group_off</span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    {t('No students found in this class.')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50/50 z-10 min-w-[200px]">{t('Student')}</th>
                        {exams.map((exam, i) => (
                          <th
                            key={exam.id}
                            className={`p-4 text-xs font-bold uppercase tracking-wider text-center min-w-[140px] ${
                              i === exams.length - 1
                                ? 'text-primary bg-primary/5'
                                : 'text-slate-500'
                            }`}
                          >
                            {exam.name}
                            <span className="block text-[10px] font-medium normal-case opacity-70">/{maxScore}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {students.map((student, rowIndex) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4 flex items-center gap-3 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10">
                            <img src={student.avatar} alt={student.name} className="w-8 h-8 rounded-full border border-slate-200 group-hover:border-primary transition-colors" />
                            <span className="font-semibold text-slate-700">{student.name}</span>
                          </td>
                          {exams.map((exam, i) => (
                            <td key={exam.id} className={`p-2 ${i === exams.length - 1 ? 'bg-primary/5' : ''}`}>
                              <input
                                id={`mark_input_${rowIndex}_${exam.id}`}
                                type="number"
                                max={maxScore}
                                min={0}
                                value={student.marks[exam.id] ?? ''}
                                onChange={(e) => handleMarkChange(student.id, exam.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, exam.id)}
                                onFocus={(e) => e.target.select()}
                                disabled={!isWindowOpen}
                                placeholder={t('Enter mark')}
                                className={`w-full text-center bg-transparent border-2 border-slate-100 rounded-lg py-2 font-semibold transition-all ${
                                  isWindowOpen
                                    ? 'hover:border-slate-300 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 cursor-text'
                                    : 'opacity-60 cursor-not-allowed'
                                } ${i === exams.length - 1 ? 'font-bold text-primary' : 'text-slate-800'}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {students.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-slate-100 font-bold text-slate-600">
                        <tr>
                          <td className="p-4 text-right uppercase text-xs tracking-wider sticky left-0 bg-slate-50 z-10">{t('Class Average')}</td>
                          {exams.map((exam, i) => (
                            <td key={exam.id} className={`p-4 text-center ${i === exams.length - 1 ? 'text-primary' : ''}`}>
                              {calculateAverage(exam.id)} /{maxScore}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-50">
                  {students.map((student, rowIndex) => (
                    <div key={student.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} alt={student.name} className="w-9 h-9 rounded-full border border-slate-200" />
                        <span className="font-semibold text-slate-700 text-sm">{student.name}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {exams.map((exam, i) => (
                          <div key={exam.id} className={`flex items-center justify-between gap-3 p-2 rounded-lg ${i === exams.length - 1 ? 'bg-primary/5' : 'bg-slate-50'}`}>
                            <label className="text-xs font-medium text-slate-500 shrink-0">{exam.name} <span className="opacity-50">/{maxScore}</span></label>
                            <input
                              id={`mark_input_${rowIndex}_${exam.id}`}
                              type="number"
                              max={maxScore}
                              min={0}
                              value={student.marks[exam.id] ?? ''}
                              onChange={(e) => handleMarkChange(student.id, exam.id, e.target.value)}
                              disabled={!isWindowOpen}
                              placeholder="-"
                              className={`w-20 text-center border-2 border-slate-100 rounded-lg py-2 text-sm font-semibold transition-all ${
                                isWindowOpen
                                  ? 'focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20'
                                  : 'opacity-60 cursor-not-allowed'
                              } ${i === exams.length - 1 ? 'font-bold text-primary' : 'text-slate-800'}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
{/* Mobile Class Average */}
                   <div className="p-4 bg-slate-50 flex items-center justify-between">
                     <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('Class Average')}</span>
                     <div className="flex gap-4">
                       {exams.map((exam, i) => (
                         <span key={exam.id} className={`text-sm font-bold ${i === exams.length - 1 ? 'text-primary' : ''}`}>
                           {calculateAverage(exam.id)}/{maxScore}
                         </span>
                       ))}
                     </div>
                   </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-premium rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20 mb-4">
              <span className="material-symbols-outlined text-2xl sm:text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
            </div>
            <h4 className="font-bold text-slate-900 mb-2">{t('Finalize Marks')}</h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{t('Ensure all cells are filled. Submitting will lock the gradebook for administrative review.')}</p>
            <button
              onClick={handleSubmit}
              disabled={!isWindowOpen || saveState === 'saving' || students.length === 0}
              className="w-full py-3.5 bg-primary text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2 min-h-[48px]"
            >
              <span className="material-symbols-outlined text-sm">send</span> {t('Submit to Admin')}
            </button>
            {!isWindowOpen && (
              <p className="text-[10px] text-error mt-2 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[10px]">lock</span> {t('Sequence closed')}
              </p>
            )}
            {saveState === 'saving' && (
              <p className="text-[10px] text-primary mt-2 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[10px] animate-spin">sync</span> {t('Waiting for sync...')}
              </p>
            )}
          </div>

          <div className="bg-primary p-6 rounded-2xl text-white shadow-premium relative overflow-hidden group">
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative z-10 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-primary-fixed-dim uppercase tracking-widest mb-1">{t('Pass Rate')}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black">{calculateOverallPassRate()}%</span>
                  <span className="text-xs text-secondary-fixed">{currentAssignment?.class_name || '-'}</span>
                </div>
              </div>
              <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary-fixed h-full rounded-full transition-all duration-700" style={{ width: `${calculateOverallPassRate()}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
              {t('Quick Insights')}
            </h4>
            <ul className="space-y-4">
              <li className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('Highest Score')}</span>
                <span className="font-bold text-secondary">{highest.max > 0 ? `${highest.max} (${highest.label})` : '-'}</span>
              </li>
              <li className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('Lowest Score')}</span>
                <span className="font-bold text-error">{lowest.min <= maxScore && lowest.label ? `${lowest.min} (${lowest.label})` : '-'}</span>
              </li>
              <li className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('Missing Entries')}</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{getMissingEntries()}</span>
              </li>
              <li className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('Total Students')}</span>
                <span className="font-bold text-slate-800">{students.length}</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
