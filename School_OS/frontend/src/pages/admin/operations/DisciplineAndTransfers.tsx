import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function DisciplineAndTransfers() {
  const { t } = useTranslation('adminStaffOps');
  const [discipline, setDiscipline] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const [transferModal, setTransferModal] = useState<{ type: 'approve' | 'review'; item: any } | null>(null);
  const [incidentModal, setIncidentModal] = useState(false);
  const [newTransferModal, setNewTransferModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ category: 'misconduct', description: '', actionTaken: '' });
  const [transferForm, setTransferForm] = useState({ toSchool: '', reason: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [discRes, transRes] = await Promise.all([
        api.get('/students/discipline/'),
        api.get('/students/transfers/')
      ]);
      setDiscipline(discRes.data.results || discRes.data);
      setTransfers(transRes.data.results || transRes.data);
    } catch {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferAction = async () => {
    if (!transferModal) return;
    setSaving(true);
    try {
      const status = transferModal.type === 'approve' ? 'approved' : 'rejected';
      await api.patch(`/students/transfers/${transferModal.item.id}/`, { status });
      addToast(t('Transfer {{status}} successfully.', { status }), 'success');
      setTransferModal(null);
      fetchData();
    } catch {
      addToast(t('Failed to update transfer.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogIncident = async () => {
    setSaving(true);
    try {
      await api.post('/students/discipline/', {
        category: incidentForm.category,
        description: incidentForm.description,
        action_taken: incidentForm.actionTaken,
      });
      addToast(t('Incident recorded. The welfare team has been notified.'), 'success');
      setIncidentModal(false);
      setIncidentForm({ category: 'misconduct', description: '', actionTaken: '' });
      fetchData();
    } catch {
      addToast(t('Failed to log incident.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransfer = async () => {
    setSaving(true);
    try {
      await api.post('/students/transfers/', {
        to_school: transferForm.toSchool,
        reason: transferForm.reason,
      });
      addToast(t('Transfer request created.'), 'success');
      setNewTransferModal(false);
      setTransferForm({ toSchool: '', reason: '' });
      fetchData();
    } catch {
      addToast(t('Failed to create transfer request.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-error font-bold tracking-widest text-xs uppercase mb-2 block">{t('Student Affairs')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Discipline & Transfers')}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{t('Manage student behavior records, disciplinary actions, and process out-of-school transfers.')}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setNewTransferModal(true)} className="bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:bg-surface-container-highest active:scale-95">
            <span className="material-symbols-outlined text-lg">move_up</span>
            {t('New Transfer Request')}
          </button>
          <button onClick={() => setIncidentModal(true)} className="bg-error text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-error/20 hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">gavel</span>
            {t('Log Incident')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Disciplinary Records */}
        <div className="col-span-12 xl:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">{t('Disciplinary Logbook')}</h3>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              <button className="px-4 py-1.5 text-sm font-bold bg-white text-on-surface rounded shadow-sm">{t('Recent')}</button>
              <button className="px-4 py-1.5 text-sm font-bold text-on-surface-variant hover:text-on-surface">{t('Severe')}</button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
              {t('Loading records...')}
            </div>
          ) : discipline.length === 0 ? (
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-outline">verified_user</span>
              </div>
              <h4 className="text-lg font-bold text-on-surface mb-2">{t('Clean Record')}</h4>
              <p className="text-sm text-on-surface-variant mb-6 max-w-sm">{t('No disciplinary incidents have been logged for the current academic session.')}</p>
            </div>
          ) : (
            <div className="p-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">{t('Student')}</th>
                    <th className="p-4">{t('Incident Details')}</th>
                    <th className="p-4">{t('Action Taken')}</th>
                    <th className="p-4 text-right pr-6">{t('Severity')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {discipline.map((d: any) => (
                    <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-4 pl-6 font-semibold text-on-surface">{d.student_name}</td>
                      <td className="p-4">
                        <div className="text-sm font-medium">{d.description}</div>
                        <div className="text-[10px] text-on-surface-variant mt-1">{t('Reported by: {{name}}', { name: d.reported_by_name || t('N/A') })}</div>
                      </td>
                      <td className="p-4 text-sm text-on-surface-variant">{d.action_taken}</td>
                      <td className="p-4 pr-6 text-right">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${d.category === 'severe' || d.category === 'violence' ? 'bg-error-container text-on-error-container' : d.category === 'absenteeism' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {d.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transfer Requests */}
        <div className="col-span-12 xl:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">{t('Transfer Processing')}</h3>
            <span className="material-symbols-outlined text-outline">sync_alt</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-4 flex items-center justify-center">swap_horiz</span>
              <h4 className="text-lg font-bold text-on-surface mb-2">{t('No Active Transfers')}</h4>
              <p className="text-sm text-on-surface-variant">{t('There are no pending student transfer requests.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {transfers.map((tr: any) => (
                <div key={tr.id} className="p-6 hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-bold text-on-surface">{tr.student_name}</div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${tr.status === 'pending' ? 'bg-secondary-container text-on-secondary-container' : tr.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      {tr.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant mb-2">
                    <span>{tr.from_school || t('Current School')}</span>
                    <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
                    <span className="font-medium text-on-surface">{tr.to_school || tr.destination_school}</span>
                  </div>
                  {tr.reason && <p className="text-xs text-on-surface-variant mb-4 italic">"{tr.reason}"</p>}
                  {tr.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => setTransferModal({ type: 'approve', item: tr })} className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">{t('Approve')}</button>
                      <button onClick={() => setTransferModal({ type: 'review', item: tr })} className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-highest">{t('Review')}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Approve/Review Modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 border-b border-outline-variant/10 flex justify-between items-center ${transferModal.type === 'approve' ? 'bg-primary' : 'bg-surface-variant'}`}>
              <div>
                <h3 className="text-2xl font-bold text-white">{t('{{action}} Transfer', { action: transferModal.type === 'approve' ? t('Approve') : t('Reject') })}</h3>
                <p className="text-blue-100 text-sm">{transferModal.item.student_name}</p>
              </div>
              <button onClick={() => setTransferModal(null)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span>{transferModal.item.from_school || t('Current School')}</span>
                  <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
                  <span className="font-medium">{transferModal.item.to_school}</span>
                </div>
                {transferModal.item.reason && <p className="text-sm italic text-on-surface-variant">"{transferModal.item.reason}"</p>}
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setTransferModal(null)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">{t('Cancel')}</button>
                <button onClick={handleTransferAction} disabled={saving} className={`flex-1 py-3 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${transferModal.type === 'approve' ? 'bg-primary' : 'bg-surface-variant'}`}>
                  {saving ? t('Processing...') : transferModal.type === 'approve' ? t('Confirm Approval') : t('Confirm Rejection')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Incident Modal */}
      {incidentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-error">
              <div>
                <h3 className="text-2xl font-bold text-white">{t('Log Incident')}</h3>
                <p className="text-red-100 text-sm">{t('Record a new disciplinary event')}</p>
              </div>
              <button onClick={() => setIncidentModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Category')}</label>
                <select
                  value={incidentForm.category}
                  onChange={(e) => setIncidentForm({ ...incidentForm, category: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-error/20 text-sm font-medium"
                >
                  <option value="misconduct">Misconduct</option>
                  <option value="absenteeism">Absenteeism</option>
                  <option value="violence">Violence</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Description')}</label>
                <textarea
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  rows={3}
                  placeholder={t('Describe the incident...')}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-error/20 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Action Taken')}</label>
                <textarea
                  value={incidentForm.actionTaken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, actionTaken: e.target.value })}
                  rows={2}
                  placeholder={t('What action was taken...')}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-error/20 text-sm"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIncidentModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">{t('Cancel')}</button>
                <button onClick={handleLogIncident} disabled={saving} className="flex-1 py-3 bg-error text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {saving ? t('Saving...') : t('Log Incident')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Transfer Request Modal */}
      {newTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-primary">
              <div>
                <h3 className="text-2xl font-bold text-white">{t('New Transfer Request')}</h3>
                <p className="text-blue-100 text-sm">{t('Submit a student transfer to another school')}</p>
              </div>
              <button onClick={() => setNewTransferModal(false)} className="text-white hover:rotate-90 transition-transform p-2">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Destination School *')}</label>
                <input
                  type="text"
                  value={transferForm.toSchool}
                  onChange={(e) => setTransferForm({ ...transferForm, toSchool: e.target.value })}
                  placeholder={t('Enter destination school name')}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Reason *')}</label>
                <textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  rows={3}
                  placeholder={t('Why is this transfer being requested...')}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setNewTransferModal(false)} className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-all active:scale-95">{t('Cancel')}</button>
                <button onClick={handleCreateTransfer} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {saving ? t('Submitting...') : t('Submit Request')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
