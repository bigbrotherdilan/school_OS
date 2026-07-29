import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { reportsApi } from '../../../services/reportsApi';
import { useToastStore } from '../../../stores/toastStore';

export default function PerformanceReports() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  useEffect(() => {
    fetchReports();
    fetchAcademicData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchTerms(selectedYear);
    }
  }, [selectedYear]);

  const fetchReports = async () => {
    try {
      const data = await reportsApi.listPerformanceReports();
      setReports(data.results || data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicData = async () => {
    try {
      const res = await api.get('/academic/academic-years/');
      const years = res.data.results || res.data;
      setAcademicYears(years);
      const activeYear = years.find((y: any) => y.is_active) || years.find((y: any) => {
        const now = new Date();
        return now >= new Date(y.start_date) && now <= new Date(y.end_date);
      });
      if (activeYear) setSelectedYear(activeYear.id);
    } catch (err) {
      console.error('Failed to fetch academic years', err);
    }
  };

  const fetchTerms = async (yearId: string) => {
    try {
      const res = await api.get(`/academic/terms/?academic_year=${yearId}`);
      setTerms(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch terms', err);
    }
  };

  const handleGenerateReport = async (reportType: string) => {
    if (!selectedYear) {
      addToast('Please select an academic year first.', 'info');
      return;
    }
    setGenerating(true);
    try {
      await reportsApi.generatePerformanceReport({
        report_type: reportType,
        term_id: selectedTerm || undefined,
        academic_year_id: selectedYear,
      });
      addToast(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully.`, 'success');
      fetchReports();
    } catch (err) {
      addToast('Failed to generate report.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes = [
    { type: 'academic', label: 'Academic Performance', icon: 'school', color: 'bg-primary-container text-on-primary-container' },
    { type: 'financial', label: 'Financial Summary', icon: 'account_balance', color: 'bg-secondary-container text-on-secondary-container' },
    { type: 'attendance', label: 'Attendance Report', icon: 'how_to_reg', color: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    { type: 'compliance', label: 'Compliance & Audit', icon: 'verified_user', color: 'bg-error-container text-on-error-container' },
    { type: 'comprehensive', label: 'Comprehensive', icon: 'summarize', color: 'bg-primary-fixed text-on-primary-fixed' },
  ];

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block">Analytics & Governance</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Performance Reports</h2>
          <p className="text-on-surface-variant text-lg mt-2">Generate comprehensive reports for internal review and government dashboard submission.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/admin/academic/report-cards')}
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            Student Report Cards
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Academic Year</label>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Term / Sequence</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              disabled={!selectedYear}
              className="w-full bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-3 focus:ring-primary shadow-sm disabled:opacity-50"
            >
              <option value="">Full Year</option>
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => navigate('/admin/academic/report-cards')}
              className="w-full bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all"
            >
              <span className="material-symbols-outlined text-lg">assignment</span>
              Manage Report Cards
            </button>
          </div>
        </div>
      </div>

      {/* Report Type Quick Generate */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {reportTypes.map((rt, i) => (
          <button
            key={i}
            onClick={() => handleGenerateReport(rt.type)}
            disabled={generating || !selectedYear}
            className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/15 shadow-sm flex flex-col items-center text-center hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`w-12 h-12 ${rt.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <span className="material-symbols-outlined">
                {generating ? 'sync' : rt.icon}
              </span>
            </div>
            <span className="text-sm font-bold text-on-surface">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
          <h3 className="text-xl font-bold text-on-surface">Generated Reports</h3>
          <span className="text-xs text-on-surface-variant font-medium">{reports.length} reports</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-on-surface-variant flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary mb-4">sync</span>
            <p>Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-outline">assessment</span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-2">No Reports Generated</h4>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
              Select an academic year and use the quick generate buttons above to compile institutional analytics.
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Report Title</th>
                <th className="p-4">Type</th>
                <th className="p-4">Period</th>
                <th className="p-4">Generated By</th>
                <th className="p-4">Gov Status</th>
                <th className="p-4 text-right pr-6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {reports.map((r, i) => (
                <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-semibold text-on-surface">{r.title}</div>
                    <div className="text-[10px] text-outline uppercase mt-1">{r.academic_year_name}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-highest text-on-surface-variant px-2 py-1 rounded">
                      {r.report_type_display}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant">{r.term_name || 'Full Year'}</td>
                  <td className="p-4 text-sm text-on-surface-variant">{r.generated_by_name || 'System'}</td>
                  <td className="p-4">
                    {r.is_submitted_to_gov ? (
                      <div className="flex items-center gap-1 text-secondary">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <span className="text-xs font-bold">Submitted</span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-on-surface-variant">Local Only</span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right text-sm text-on-surface-variant">
                    {new Date(r.generated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
