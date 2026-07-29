import { useState, useEffect } from 'react';
import { useParentStore } from '../../stores/parentStore';
import { useAuthStore } from '../../stores/authStore';
import { reportsApi } from '../../services/reportsApi';

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

const ParentReports = () => {
  const { dashboardData } = useParentStore();
  const { user } = useAuthStore();
  const wards = dashboardData?.wards || [];
  const dateLocale = user?.default_language === 'fr' ? 'fr-FR' : 'en-GB';
  const [activeWardId, setActiveWardId] = useState<string>('');
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (wards.length > 0 && !activeWardId) {
      setActiveWardId(wards[0].id);
    }
  }, [wards, activeWardId]);

  useEffect(() => {
    if (activeWardId) {
      fetchReportCards(activeWardId);
    }
  }, [activeWardId]);

  const fetchReportCards = async (wardId: string) => {
    setLoading(true);
    try {
      const data = await reportsApi.listReportCards({ student_id: wardId });
      setReportCards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch report cards', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, studentName: string, termName: string) => {
    setDownloadingId(id);
    try {
      const response = await reportsApi.downloadReportCard(id);
      const filename = `Report_Card_${studentName.replace(/\s+/g, '_')}_${termName.replace(/\s+/g, '_')}.pdf`;
      downloadBlob(new Blob([response.data], { type: 'application/pdf' }), filename);
    } catch (err) {
      console.error('Failed to download report card', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const activeWard = wards.find(w => w.id === activeWardId);

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Report Cards</h1>
        <p className="text-sm text-slate-500 mt-1">Download termly academic reports</p>
      </header>

      {/* Ward Switcher (if multiple children) */}
      {wards.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wards.map((ward) => {
            const isActive = ward.id === activeWardId;
            const initials = `${ward.first_name[0]}${ward.last_name[0]}`.toUpperCase();
            return (
              <button
                key={ward.id}
                onClick={() => setActiveWardId(ward.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {initials}
                </span>
                {ward.first_name}
              </button>
            );
          })}
        </div>
      )}

      {/* Report Cards List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : reportCards.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">description</span>
          <p className="font-bold text-slate-900">No Report Cards Yet</p>
          <p className="text-sm text-slate-500 mt-1">Report cards will appear once your school generates them.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reportCards.map((rc) => (
            <div key={rc.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">{rc.academic_year_name}</p>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">{rc.term_name}</h3>
                  <p className="text-sm text-slate-500">{rc.class_name}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(rc.generated_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <button
                onClick={() => handleDownload(rc.id, rc.student_name, rc.term_name)}
                disabled={downloadingId === rc.id}
                className="w-full py-3 bg-blue-900 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {downloadingId === rc.id ? (
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">download</span>
                )}
                {downloadingId === rc.id ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ward Info (only shown if there are report cards) */}
      {activeWard && reportCards.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm">
              {activeWard.first_name[0]}{activeWard.last_name[0]}
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900 text-sm">{activeWard.first_name} {activeWard.last_name}</p>
              <p className="text-xs text-slate-500">{activeWard.grade} • {reportCards.length} report(s)</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Attendance</p>
              <p className="font-bold text-slate-900">{activeWard.attendance_percentage}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentReports;
