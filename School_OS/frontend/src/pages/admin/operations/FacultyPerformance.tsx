import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function FacultyPerformance() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const [modal, setModal] = useState<{ type: 'approve' | 'reject'; item: any } | null>(null);
  const [evalModal, setEvalModal] = useState(false);
  const [evalForm, setEvalForm] = useState({ teacherId: '', score: '', comments: '' });
  const [teachers, setTeachers] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leaveRes, reviewRes, teachersRes] = await Promise.all([
        api.get('/staff/leave-requests/'),
        api.get('/staff/performance-reviews/'),
        api.get('/staff/teachers/')
      ]);
      setLeaveRequests(leaveRes.data.results || leaveRes.data);
      setReviews(reviewRes.data.results || reviewRes.data);
      setTeachers(teachersRes.data.results || teachersRes.data);
    } catch {
      console.error('Failed to fetch faculty data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const status = modal.type === 'approve' ? 'approved' : 'rejected';
      await api.patch(`/staff/leave-requests/${modal.item.id}/`, { status });
      addToast(`Leave request ${status} successfully.`, 'success');
      setModal(null);
      setReason('');
      fetchData();
    } catch {
      addToast('Failed to update leave request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEvaluation = async () => {
    if (!evalForm.teacherId || !evalForm.score) {
      addToast('Please select a teacher and provide a score.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/staff/performance-reviews/', {
        teacher: evalForm.teacherId,
        score: parseInt(evalForm.score),
        comments: evalForm.comments,
      });
      addToast('Faculty evaluation recorded.', 'success');
      setEvalModal(false);
      setEvalForm({ teacherId: '', score: '', comments: '' });
      fetchData();
    } catch {
      addToast('Failed to create evaluation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/staff/performance-reviews/');
      const data = res.data.results || res.data;
      const csv = ['Teacher,Score,Comments,Date'];
      data.forEach((r: any) => {
        csv.push(`"${r.teacher_name || ''}",${r.score || 0},"${(r.comments || '').replace(/"/g, '""')}",${r.review_date || ''}`);
      });
      const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `faculty_evaluations_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      addToast('Performance report ready for review.', 'success');
    } catch {
      addToast('Failed to export report.', 'error');
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block">Staff Management</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Teacher Appraisal & Leave</h2>
          <p className="text-on-surface-variant text-lg mt-2">Monitor teaching effectiveness, approve leave requests, and review staff workload.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExport} className="bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:bg-surface-container-highest active:scale-95">
            <span className="material-symbols-outlined text-lg">download</span>
            Export Report
          </button>
          <button onClick={() => setEvalModal(true)} className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>rate_review</span>
            New Evaluation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Leave Requests */}
        <div className="col-span-12 xl:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">Leave Requests</h3>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              <button className="px-4 py-1.5 text-sm font-bold bg-white text-on-surface rounded shadow-sm">Pending</button>
              <button className="px-4 py-1.5 text-sm font-bold text-on-surface-variant hover:text-on-surface">All</button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
              Loading leave requests...
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-outline">beach_access</span>
              </div>
              <h4 className="text-lg font-bold text-on-surface mb-2">No Leave Requests</h4>
              <p className="text-sm text-on-surface-variant max-w-sm">All faculty members are currently active with no pending leave applications.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {leaveRequests.map((lr: any) => (
                <div key={lr.id} className="p-6 hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-on-surface">{lr.teacher_name}</div>
                      <div className="text-[10px] text-outline uppercase font-bold mt-1">{lr.leave_type || 'General'} Leave</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${lr.status === 'pending' ? 'bg-secondary-container text-on-secondary-container' : lr.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      {lr.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-4">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    <span>{lr.start_date} → {lr.end_date}</span>
                  </div>
                  {lr.reason && <p className="text-xs text-on-surface-variant mb-4 italic">"{lr.reason}"</p>}
                  {lr.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => setModal({ type: 'approve', item: lr })} className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">Approve</button>
                      <button onClick={() => setModal({ type: 'reject', item: lr })} className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-highest">Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Reviews */}
        <div className="col-span-12 xl:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">Performance Evaluations</h3>
            <select className="bg-white border border-outline-variant/30 rounded-lg text-sm font-medium px-4 py-2 focus:ring-primary shadow-sm">
              <option>Current Year</option>
              <option>Previous Year</option>
            </select>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
              Loading evaluations...
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-outline">star_rate</span>
              </div>
              <h4 className="text-lg font-bold text-on-surface mb-2">No Evaluations Yet</h4>
              <p className="text-sm text-on-surface-variant max-w-sm mb-6">Start the faculty appraisal cycle by initiating a new performance evaluation.</p>
              <button className="text-primary font-semibold hover:underline border border-primary/20 px-6 py-2 rounded-lg">Begin Evaluation Cycle</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Teacher</th>
                  <th className="p-4">Academic Year</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Evaluator</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {reviews.map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-on-surface">{r.teacher_name}</td>
                    <td className="p-4 text-sm text-on-surface-variant">{r.academic_year_name}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: r.score + '%' }}></div>
                        </div>
                        <span className="text-sm font-bold text-primary">{r.score}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-on-surface-variant">{r.evaluator_name || 'Admin'}</td>
                    <td className="p-4 pr-6 text-right">
                      <button className="text-primary hover:underline text-sm font-semibold">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Approve/Reject Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 border-b border-outline-variant/10 flex justify-between items-center ${modal.type === 'approve' ? 'bg-primary' : 'bg-error'}`}>
              <div>
                <h3 className="text-2xl font-bold text-white">{modal.type === 'approve' ? 'Approve' : 'Reject'} Leave Request</h3>
                <p className="text-blue-100 text-sm">{modal.item.teacher_name}</p>
              </div>
              <button onClick={() => { setModal(null); setReason(''); }} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Period:</span>
                  <span className="font-medium">{modal.item.start_date} → {modal.item.end_date}</span>
                </div>
                {modal.item.reason && (
                  <div className="text-sm">
                    <span className="text-on-surface-variant">Reason:</span>
                    <p className="mt-1 italic">{modal.item.reason}</p>
                  </div>
                )}
              </div>
              {modal.type === 'reject' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Rejection Reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide a reason for rejection..."
                    rows={3}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-error/20 text-sm"
                  />
                </div>
              )}
              <div className="flex gap-4 pt-4">
                <button onClick={() => { setModal(null); setReason(''); }} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">Cancel</button>
                <button onClick={handleAction} disabled={saving} className={`flex-1 py-3 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${modal.type === 'approve' ? 'bg-primary' : 'bg-error'}`}>
                  {saving ? 'Processing...' : modal.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Evaluation Modal */}
      {evalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary">
              <div>
                <h3 className="text-2xl font-bold text-white">New Evaluation</h3>
                <p className="text-blue-100 text-sm">Create a performance evaluation for a faculty member</p>
              </div>
              <button onClick={() => setEvalModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Teacher *</label>
                <select
                  value={evalForm.teacherId}
                  onChange={(e) => setEvalForm({ ...evalForm, teacherId: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="">Select teacher...</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.full_name || `${t.user?.first_name} ${t.user?.last_name}`}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Score (0-100) *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={evalForm.score}
                  onChange={(e) => setEvalForm({ ...evalForm, score: e.target.value })}
                  placeholder="Performance score"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Comments</label>
                <textarea
                  value={evalForm.comments}
                  onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })}
                  rows={4}
                  placeholder="Evaluator comments..."
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setEvalModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">Cancel</button>
                <button onClick={handleCreateEvaluation} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Evaluation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
