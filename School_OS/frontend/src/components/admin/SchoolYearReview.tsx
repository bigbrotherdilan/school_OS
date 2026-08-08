import { useState, useEffect } from 'react';
import { reportsApi } from '../../services/reportsApi';

interface YearReviewData {
  academic_year: { id: string; name: string; start_date: string; end_date: string };
  school: { name: string; logo_url: string; motto: string };
  students: { total: number; active: number; enrolled_this_year: number };
  teachers: { total: number };
  classes: { total: number };
  attendance: { rate: number | null; total_sessions: number };
  finance: { total_billed: number; total_collected: number; outstanding: number; collection_rate: number | null; total_expenses: number; net: number };
  academics: { report_cards_generated: number; average_score: number | null };
  generated_at: string;
}

function formatCFA(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toFixed(0);
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-lg text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <p className="text-[2rem] font-bold text-gray-900 leading-none">{value}</p>
    </div>
  );
}

export default function SchoolYearReview() {
  const [data, setData] = useState<YearReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.getYearReview()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load year review data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-3">sync</span>
        <span className="font-medium">Loading year review...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-error mb-3 block">error</span>
        <p className="text-on-surface-variant font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const handlePrint = () => window.print();

  return (
    <>
      {/* Print button - hidden when printing */}
      <div className="no-print mb-6 flex justify-end">
        <button
          onClick={handlePrint}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          Print / Save as PDF
        </button>
      </div>

      {/* Printable page */}
      <div className="bg-white rounded-2xl border border-outline-variant/15 overflow-hidden max-w-4xl mx-auto shadow-sm">
        {/* Cover Header */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-12 text-center">
          {data.school.logo_url && (
            <img src={data.school.logo_url} alt="School Logo" className="h-16 mx-auto mb-4 object-contain" />
          )}
          <h1 className="text-3xl font-bold mb-1">{data.school.name}</h1>
          {data.school.motto && <p className="text-gray-300 text-sm italic mb-4">"{data.school.motto}"</p>}
          <div className="inline-block bg-white/10 px-6 py-2 rounded-full mt-2">
            <span className="text-lg font-semibold">School Year in Review {data.academic_year.name}</span>
          </div>
          <p className="text-gray-400 text-xs mt-4">
            {data.academic_year.start_date} - {data.academic_year.end_date}
          </p>
        </div>

        <div className="p-10 space-y-10">
          {/* Key Metrics */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Students" value={data.students.total.toLocaleString()} icon="groups" color="bg-blue-500" />
              <StatCard label="Teachers" value={data.teachers.total.toLocaleString()} icon="person" color="bg-violet-500" />
              <StatCard label="Classes" value={data.classes.total.toLocaleString()} icon="class" color="bg-indigo-500" />
              <StatCard label="Attendance" value={data.attendance.rate !== null ? `${data.attendance.rate}%` : '-'} icon="how_to_reg" color="bg-emerald-500" />
            </div>
          </section>

          {/* Academic Performance */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Academic Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Average Score</span>
                <p className="text-3xl font-bold text-gray-900">{data.academics.average_score !== null ? `${data.academics.average_score}%` : '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Report Cards Generated</span>
                <p className="text-3xl font-bold text-gray-900">{data.academics.report_cards_generated.toLocaleString()}</p>
              </div>
            </div>
          </section>

          {/* Financial Summary */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Financial Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Total Fees</span>
                <p className="text-2xl font-bold text-gray-900">{formatCFA(data.finance.total_billed)} CFA</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Collected</span>
                <p className="text-2xl font-bold text-emerald-600">{formatCFA(data.finance.total_collected)} CFA</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Outstanding</span>
                <p className="text-2xl font-bold text-amber-600">{formatCFA(data.finance.outstanding)} CFA</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Collection Rate</span>
                <p className="text-2xl font-bold text-gray-900">{data.finance.collection_rate !== null ? `${data.finance.collection_rate}%` : '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Expenses</span>
                <p className="text-2xl font-bold text-red-600">{formatCFA(data.finance.total_expenses)} CFA</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Net</span>
                <p className={`text-2xl font-bold ${data.finance.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data.finance.net >= 0 ? '+' : ''}{formatCFA(data.finance.net)} CFA
                </p>
              </div>
            </div>
          </section>

          {/* Growth */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Growth</h2>
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">New Students This Year</span>
                  <p className="text-3xl font-bold text-gray-900">{data.students.enrolled_this_year.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Attendance Sessions Held</span>
                  <p className="text-3xl font-bold text-gray-900">{data.attendance.total_sessions.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-10 py-4 flex items-center justify-between">
          <span className="text-[9px] text-gray-400 font-medium tracking-wide">
            Generated on {new Date(data.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="text-[9px] text-gray-400 font-medium tracking-wide">Powered by School OS</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}
