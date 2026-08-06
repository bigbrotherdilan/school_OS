import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import ProfileEditor from '../../../components/ui/ProfileEditor';
import { useToastStore } from '../../../stores/toastStore';

export default function Settings() {
  const navigate = useNavigate();
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const { addToast } = useToastStore();
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  const handlePurge = () => {
    addToast('System cache completely purged. Operations restored to zero state.', 'success');
  };

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1200px] mx-auto bg-white min-h-screen">
      <section className="border-b border-slate-100 pb-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Institutional Settings</h1>
        <p className="text-slate-500 mt-2 font-medium">Configure the global operating parameters for your school instance.</p>
      </section>

      <div className="grid grid-cols-12 gap-12">
        <aside className="col-span-12 lg:col-span-3 space-y-2">
          {[
            { label: 'Profile & Authority', icon: 'person_outline' },
            { label: 'Institution Branding', icon: 'palette' },
            { label: 'Academic Structure', icon: 'account_tree' },
            { label: 'Security & Privacy', icon: 'shield' },
            { label: 'Billing & Subscriptions', icon: 'credit_card' },
            { label: 'Integrations', icon: 'extension' },
            { label: 'Email Configuration', icon: 'mail', route: '/admin/settings/email' }
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => item.route && navigate(item.route)}
              className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </aside>

        <main className="col-span-12 lg:col-span-9 space-y-12">
          <div className="space-y-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Profile & Authority</h3>
            <ProfileEditor role="admin" />
          </div>

          <div className="space-y-8 pt-12 border-t border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Institution Branding</h3>
            <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center text-primary font-black text-2xl border border-slate-100">SJ</div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Official Seal / Logo</h4>
                  <p className="text-xs font-medium text-slate-400 mt-1">No logo uploaded</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all">Upload</button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Brand Color</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 shadow-lg ring-4 ring-white"></div>
                  <input type="text" placeholder="#HEX" className="flex-1 bg-slate-50 border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm font-bold font-mono" />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secondary Accent</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 shadow-lg ring-4 ring-white"></div>
                  <input type="text" placeholder="#HEX" className="flex-1 bg-slate-50 border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm font-bold font-mono" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 pt-12 border-t border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Security & Privacy</h3>
            <div className="space-y-4">
              <div onClick={() => setTwoFactor(!twoFactor)} className="flex justify-between items-center p-6 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-colors cursor-pointer">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Two-Factor Authentication</h4>
                  <p className="text-xs font-medium text-slate-400">Mandatory for all administrative accounts.</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative p-1 shadow-inner transition-colors ${twoFactor ? 'bg-secondary' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${twoFactor ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div onClick={() => setSessionTimeout(!sessionTimeout)} className="flex justify-between items-center p-6 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-colors cursor-pointer">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Session Auto-Timeout</h4>
                  <p className="text-xs font-medium text-slate-400">Security purge after 30 minutes of inactivity.</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative p-1 shadow-inner transition-colors ${sessionTimeout ? 'bg-secondary' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${sessionTimeout ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 pt-12 border-t border-slate-100">
            <h3 className="text-xl font-black text-error uppercase tracking-widest">Danger Zone</h3>
            <div className="p-8 bg-error-container/10 border border-error/20 rounded-3xl flex justify-between items-center group">
              <div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">Purge System Cache</h4>
                <p className="text-xs text-slate-500 font-medium mt-1 pr-4 max-w-sm">
                  Forces an immediate resync of all interconnected service nodes. Will temporarily disrupt active sessions.
                </p>
              </div>
              <button
                onClick={() => setIsPurgeModalOpen(true)}
                className="px-6 py-3 bg-white border border-error/30 text-error rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-error hover:text-white hover:border-error transition-all active:scale-95"
              >
                Initiate Purge
              </button>
            </div>
          </div>
        </main>
      </div>

      <footer className="mt-24 pt-24 border-t border-slate-100 text-center flex flex-col items-center gap-12">
        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center grayscale opacity-10 shadow-inner">
          <span className="material-symbols-outlined text-white text-3xl">settings</span>
        </div>
        <p className="text-slate-400 italic font-serif text-xl max-w-2xl leading-relaxed opacity-40">
          "Stability is found in the meticulous calibration of our boundaries."
        </p>
        <div className="flex flex-col items-center gap-2 pb-20">
          <p className="text-[0.6rem] font-black uppercase tracking-[0.6em] text-primary/30">- Monolith Config Charter v2.0</p>
        </div>
      </footer>

      <ConfirmationModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        onConfirm={handlePurge}
        title="Override Operations Check"
        message="You are about to purge the global system cache. This action will enforce a hard reset on active peripheral sessions and cannot be interrupted once initiated. Do you confirm this directive?"
        confirmText="Acknowledge Purge"
        isDestructive={true}
      />
    </div>
  );
}
