import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../../../services/analyticsApi';
import { api } from '../../../services/api';

export default function AcademicAnalytics() {
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [examData, setExamData] = useState<any>(null);
  const [subjectData, setSubjectData] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'subject' | 'class' | 'marks'>('overview');
  const [markStats, setMarkStats] = useState<any[]>([]);
  const [markStatsLoading, setMarkStatsLoading] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const data = await analyticsApi.getMetadata();
      setYears(data.academic_years || []);
      const years = data.academic_years || [];
      const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
        const now = new Date();
        return now >= new Date(y.start_date) && now <= new Date(y.end_date);
      });
      if (activeYear) setSelectedYear(activeYear.id);
      setTerms(data.terms || []);
      setClasses(data.classes || []);
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error('Failed to fetch analytics metadata', err);
    }
  };

  const fetchExamData = useCallback(async () => {
    if (!selectedTerm) return;
    setLoading(true);
    try {
      const data = await analyticsApi.getExamPerformance({
        term_id: selectedTerm,
        academic_year_id: selectedYear,
      });
      setExamData(data);
    } catch (err) {
      console.error('Failed to fetch exam performance', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedYear]);

  const fetchSubjectData = useCallback(async () => {
    if (!selectedSubject || !selectedTerm) return;
    setLoading(true);
    try {
      const data = await analyticsApi.getSubjectPerformance({
        subject_id: selectedSubject,
        term_id: selectedTerm,
        academic_year_id: selectedYear,
      });
      setSubjectData(data);
    } catch (err) {
      console.error('Failed to fetch subject performance', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, selectedTerm, selectedYear]);

  const fetchClassData = useCallback(async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoading(true);
    try {
      const data = await analyticsApi.getClassPerformance({
        class_id: selectedClass,
        term_id: selectedTerm,
        academic_year_id: selectedYear,
      });
      setClassData(data);
    } catch (err) {
      console.error('Failed to fetch class performance', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedTerm, selectedYear]);

  useEffect(() => {
    if (activeTab === 'overview' && selectedTerm) fetchExamData();
  }, [activeTab, selectedTerm, fetchExamData]);

  useEffect(() => {
    if (activeTab === 'subject' && selectedSubject && selectedTerm) fetchSubjectData();
  }, [activeTab, selectedSubject, selectedTerm, fetchSubjectData]);

  useEffect(() => {
    if (activeTab === 'class' && selectedClass && selectedTerm) fetchClassData();
  }, [activeTab, selectedClass, selectedTerm, fetchClassData]);

  useEffect(() => {
    if (activeTab === 'marks') {
      setMarkStatsLoading(true);
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSubject) params.append('subject', selectedSubject);
      if (selectedClass) params.append('class', selectedClass);
      params.append('only_open', 'true');

      api.get(`/assessments/mark-windows/mark-filling-stats/?${params.toString()}`)
        .then(res => setMarkStats(res.data || []))
        .catch(() => setMarkStats([]))
        .finally(() => setMarkStatsLoading(false));
    }
  }, [activeTab, selectedYear, selectedTerm, selectedSubject, selectedClass]);

  const renderGradeBar = (percentage: number | null) => {
    if (percentage === null || percentage === undefined) return null;
    const color = percentage >= 70 ? 'bg-secondary' : percentage >= 50 ? 'bg-primary' : 'bg-error';
    return (
      <div className="w-full bg-surface-container rounded-full h-2 mt-1">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: Math.min(percentage, 100) + '%' }} />
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Analytics</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Exam & Term Analytics</h2>
          <p className="text-on-surface-variant text-lg mt-2">School-wide performance analysis across subjects, classes, and streams.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Academic Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm">
              <option value="">Select Year</option>
              {years.map((y: any) => (
                <option key={y.id} value={y.id}>{y.name}{y.is_active ? ' (Active)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
              disabled={!selectedYear}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm disabled:opacity-50">
              <option value="">Select Term</option>
              {terms.filter((t: any) => t.academic_year === selectedYear || t.academic_year === parseInt(selectedYear)).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Subject (Detail)</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm">
              <option value="">All Subjects</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Class (Detail)</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm">
              <option value="">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.cycle_name || c.section_display || 'N/A'})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-outline-variant/15">
        {([
          { key: 'overview', label: 'School Overview', icon: 'dashboard' },
          { key: 'subject', label: 'Subject Analysis', icon: 'book' },
          { key: 'class', label: 'Class Analysis', icon: 'group' },
          { key: 'marks', label: 'Mark Filling', icon: 'edit_square' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
          <span className="ml-3 text-on-surface-variant font-medium">Loading analytics...</span>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && !loading && examData && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard label="Overall Average" value={examData.overall?.average ? `${examData.overall.average}/${examData.max_scale}` : 'N/A'} sub={`${examData.overall?.average_percentage || 0}%`} color={examData.overall?.average_percentage >= 70 ? 'text-secondary' : examData.overall?.average_percentage >= 50 ? 'text-primary' : 'text-error'} />
            <MetricCard label="Pass Rate" value={examData.overall?.pass_rate != null ? `${examData.overall.pass_rate}%` : 'N/A'} sub={`${examData.overall?.pass_count || 0} of ${examData.overall?.count || 0} students`} color={examData.overall?.pass_rate >= 70 ? 'text-secondary' : examData.overall?.pass_rate >= 50 ? 'text-primary' : 'text-error'} />
            <MetricCard label="Students Assessed" value={examData.total_students_assessed} sub={`${examData.total_exam_results} total results`} color="text-primary" />
            <MetricCard label="Subjects" value={examData.subjects_with_data} sub={`in ${examData.term}`} color="text-primary" />
          </div>

          {/* Grade Distribution */}
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/15 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface mb-6">Grade Distribution</h3>
            <div className="space-y-3">
              {Object.entries(examData.grade_distribution || {}).map(([bucket, count]: any) => {
                const total = examData.overall?.count || 1;
                const pct = ((count / total) * 100).toFixed(1);
                const barColor = bucket.startsWith('Distinction') ? 'bg-secondary' :
                  bucket.startsWith('Merit') ? 'bg-primary' :
                  bucket.startsWith('Credit') ? 'bg-on-tertiary-container' :
                  bucket.startsWith('Pass') ? 'bg-tertiary-fixed' : 'bg-error';
                return (
                  <div key={bucket} className="flex items-center gap-4">
                    <span className="text-xs font-bold text-on-surface-variant w-36 text-right">{bucket}</span>
                    <div className="flex-1 bg-surface-container rounded-full h-5 overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                        style={{ width: Math.min(parseFloat(pct), 100) + '%', minWidth: count > 0 ? '2rem' : '0' }}>
                        {count > 0 && <span className="text-[10px] font-bold text-white">{count}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant w-16">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject Breakdown */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
              <h3 className="text-lg font-bold text-on-surface">Subject Performance Breakdown</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Subject</th>
                  <th className="p-4">Coeff.</th>
                  <th className="p-4">Average</th>
                  <th className="p-4">Pass Rate</th>
                  <th className="p-4">Highest</th>
                  <th className="p-4">Lowest</th>
                  <th className="p-4 pr-6">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(examData.subject_breakdown || []).map((subj: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-on-surface">{subj.subject_name}</td>
                    <td className="p-4 text-sm">{subj.default_coefficient || subj.coefficient}</td>
                    <td className="p-4">
                      <span className={`font-bold ${subj.average_percentage >= 70 ? 'text-secondary' : subj.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                        {subj.average}
                      </span>
                      <span className="text-xs text-on-surface-variant ml-1">/{examData.max_scale}</span>
                    </td>
                    <td className="p-4">{renderGradeBar(subj.pass_rate)}<span className="text-xs font-semibold">{subj.pass_rate}%</span></td>
                    <td className="p-4 text-sm font-semibold text-secondary">{subj.highest}</td>
                    <td className="p-4 text-sm text-error">{subj.lowest}</td>
                    <td className="p-4 pr-6 text-sm text-on-surface-variant">{subj.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject Detail Tab */}
      {activeTab === 'subject' && !loading && subjectData && (
        <div className="space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/15 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-on-surface">{subjectData.subject} ({subjectData.subject_code})</h3>
                <p className="text-sm text-on-surface-variant">Coefficient: {subjectData.default_coefficient || subjectData.coefficient} | {subjectData.term}</p>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-black ${subjectData.overall?.average_percentage >= 70 ? 'text-secondary' : subjectData.overall?.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                  {subjectData.overall?.average || 'N/A'}
                </span>
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">School Avg</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Pass Rate" value={`${subjectData.overall?.pass_rate || 0}%`} />
              <StatBox label="Students" value={subjectData.overall?.count || 0} />
              <StatBox label="Highest" value={subjectData.overall?.highest || '-'} color="text-secondary" />
              <StatBox label="Lowest" value={subjectData.overall?.lowest || '-'} color="text-error" />
            </div>
          </div>

          {/* Class breakdown */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
              <h3 className="text-lg font-bold text-on-surface">Per-Class Performance</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Class</th>
                  <th className="p-4">Average</th>
                  <th className="p-4">Pass Rate</th>
                  <th className="p-4">Highest</th>
                  <th className="p-4">Lowest</th>
                  <th className="p-4 pr-6">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(subjectData.class_breakdown || []).map((cls: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-semibold">{cls.class_name}</td>
                    <td className="p-4">{cls.average}</td>
                    <td className="p-4">{renderGradeBar(cls.pass_rate)}<span className="text-xs font-semibold">{cls.pass_rate}%</span></td>
                    <td className="p-4 text-secondary font-semibold">{cls.highest}</td>
                    <td className="p-4 text-error">{cls.lowest}</td>
                    <td className="p-4 pr-6">{cls.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Students */}
          {subjectData.top_students?.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
                <h3 className="text-lg font-bold text-on-surface">Top Performers</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">#</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Class</th>
                    <th className="p-4">Score</th>
                    <th className="p-4 pr-6">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {subjectData.top_students.map((s: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-4 pl-6 text-lg font-black text-secondary">{i + 1}</td>
                      <td className="p-4 font-semibold">{s.student_name}</td>
                      <td className="p-4 text-sm text-on-surface-variant">{s.class_name}</td>
                      <td className="p-4 font-bold">{s.score}</td>
                      <td className="p-4 pr-6">
                        <span className="px-2 py-1 bg-secondary-container text-on-secondary-container text-xs font-bold rounded">{s.grade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Class Detail Tab */}
      {activeTab === 'class' && !loading && classData && (
        <div className="space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/15 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-on-surface">{classData.class_name}</h3>
                <p className="text-sm text-on-surface-variant">{classData.section} | {classData.student_count} students | {classData.term}</p>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-black ${classData.overall?.average_percentage >= 70 ? 'text-secondary' : classData.overall?.average_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                  {classData.overall?.average || 'N/A'}
                </span>
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Class Avg</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Pass Rate" value={`${classData.overall?.pass_rate || 0}%`} />
              <StatBox label="Students" value={classData.student_count} />
              <StatBox label="Subjects" value={(classData.subject_breakdown || []).length} />
                    <StatBox label="Section" value={classData.section || 'N/A'} />
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
              <h3 className="text-lg font-bold text-on-surface">Subject Breakdown</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Subject</th>
                  <th className="p-4">Coeff.</th>
                  <th className="p-4">Average</th>
                  <th className="p-4">Pass Rate</th>
                  <th className="p-4">Highest</th>
                  <th className="p-4 pr-6">Lowest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(classData.subject_breakdown || []).map((subj: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-semibold">{subj.subject_name}</td>
                    <td className="p-4 text-sm">{subj.default_coefficient || subj.coefficient}</td>
                    <td className="p-4 font-bold">{subj.average}</td>
                    <td className="p-4">{renderGradeBar(subj.pass_rate)}<span className="text-xs font-semibold">{subj.pass_rate}%</span></td>
                    <td className="p-4 text-secondary font-semibold">{subj.highest}</td>
                    <td className="p-4 pr-6 text-error">{subj.lowest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Student Rankings */}
          {(classData.student_rankings || []).length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30">
                <h3 className="text-lg font-bold text-on-surface">Student Rankings</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">Rank</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Admission No.</th>
                    <th className="p-4">Average</th>
                    <th className="p-4">Percentage</th>
                    <th className="p-4 pr-6">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(classData.student_rankings || []).slice(0, 50).map((s: any, i: number) => (
                    <tr key={s.student_id} className={`hover:bg-surface-container-low/50 transition-colors ${i < 3 ? 'bg-secondary-container/10' : ''}`}>
                      <td className="p-4 pl-6">
                        <span className={`text-lg font-black ${i === 0 ? 'text-secondary' : i === 1 ? 'text-primary' : i === 2 ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
                          #{s.rank}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">{s.student_name}</td>
                      <td className="p-4 text-xs text-on-surface-variant font-mono">{s.admission_number}</td>
                      <td className="p-4 font-bold">{s.average}</td>
                      <td className="p-4">{renderGradeBar(s.percentage)}<span className="text-xs font-semibold">{s.percentage}%</span></td>
                      <td className="p-4 pr-6">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          s.grade === 'A' || s.grade === 'TB' ? 'bg-secondary-container text-on-secondary-container' :
                          s.grade === 'B' || s.grade === 'B' ? 'bg-primary-container text-on-primary-container' :
                          s.grade === 'F' ? 'bg-error-container text-error' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>{s.grade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mark Filling Tab */}
      {activeTab === 'marks' && (
        <div className="space-y-8">
          {markStatsLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
              <span className="ml-3 text-on-surface-variant font-medium">Loading mark filling data...</span>
            </div>
          ) : markStats.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4 block">lock_clock</span>
              <p className="text-lg font-semibold text-on-surface mb-1">No Open Sequences Found</p>
              <p className="text-sm max-w-sm mx-auto leading-relaxed">
                {selectedTerm || selectedSubject || selectedClass
                  ? 'No currently open mark entry windows match your selected filters. Try adjusting the Term, Subject, or Class above.'
                  : 'There are no mark entry windows currently open. Open a sequence from the Exam Workflow page to see filling statistics here.'}
              </p>
            </div>
          ) : (
            markStats.map((termData: any) => (
              <div key={termData.term_id} className="space-y-4">
                <h3 className="text-xl font-bold text-on-surface px-2">{termData.term_name}</h3>
                {termData.sequences.map((seq: any) => (
                  <div key={seq.sequence_id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold text-on-surface">{seq.sequence_name}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${seq.is_open ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {seq.is_open ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-primary">{seq.filled_count}/{seq.total_teachers}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Teachers Filled</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-0 border-b border-outline-variant/15">
                      <div className="p-4 text-center border-r border-outline-variant/10">
                        <p className="text-2xl font-black text-on-surface">{seq.total_teachers}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Total Teachers</p>
                      </div>
                      <div className="p-4 text-center border-r border-outline-variant/10">
                        <p className="text-2xl font-black text-secondary">{seq.filled_count}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Filled</p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-2xl font-black text-error">{seq.not_filled_count}</p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Pending</p>
                      </div>
                    </div>

                    {seq.avg_score !== null && (
                      <div className="px-6 py-3 bg-surface-container-low/50 flex items-center justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">Average Score</span>
                        <span className="font-bold text-primary">{seq.avg_score} ({seq.total_results} results)</span>
                      </div>
                    )}

                    {seq.not_filled_teachers.length > 0 && (
                      <div className="p-6">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-error mb-3">Teachers Who Haven't Filled Marks</h5>
                        <div className="space-y-2">
                          {seq.not_filled_teachers.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between bg-error/5 rounded-xl px-4 py-3 border border-error/10">
                              <div>
                                <p className="text-sm font-bold text-on-surface">{t.name}</p>
                                <p className="text-xs text-on-surface-variant">{t.subject} &bull; {t.class_name}</p>
                              </div>
                              <span className="material-symbols-outlined text-error text-lg">pending</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seq.filled_teachers.length > 0 && (
                      <div className="p-6 border-t border-outline-variant/10">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">Teachers Who Filled Marks</h5>
                        <div className="space-y-2">
                          {seq.filled_teachers.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between bg-secondary/5 rounded-xl px-4 py-3 border border-secondary/10">
                              <div>
                                <p className="text-sm font-bold text-on-surface">{t.name}</p>
                                <p className="text-xs text-on-surface-variant">{t.subject} &bull; {t.class_name}</p>
                              </div>
                              <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'overview' && !loading && !examData && selectedTerm && (
        <div className="text-center py-12 text-on-surface-variant">
          No exam data available for the selected term.
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: any; sub: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-on-surface-variant mt-1">{sub}</p>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{label}</p>
      <p className={`text-xl font-black mt-1 ${color || 'text-on-surface'}`}>{value}</p>
    </div>
  );
}
