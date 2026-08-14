import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../../stores/toastStore';
import { ArrowLeft, UserCircle, BadgeCheck, CheckCircle, Banknote } from 'lucide-react';
import { api } from '../../../services/api';
import CredentialsCard from '../../../components/ui/CredentialsCard';

export default function AddBursarPage() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    employee_id: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.post('/staff/bursars/onboard/', formData);
      setResult(res.data);
      addToast(`Bursar ${formData.first_name} onboarded successfully.`, 'success');
    } catch (error: any) {
      const data = error.response?.data;
      let detail = 'Failed to onboard bursar.';
      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = data.detail;
      } else if (data?.message) {
        detail = data.message;
      } else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          detail = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
      }
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
        <button onClick={() => navigate('/admin/operations')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Operations
        </button>

        <div className="bg-surface-container-lowest p-12 rounded-3xl border border-outline-variant/10 shadow-sm max-w-lg mx-auto text-center space-y-8">
          <div className="w-20 h-20 rounded-3xl bg-secondary-container/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-on-surface mb-2">Bursar Onboarded</h2>
            <p className="text-on-surface-variant">{result.user.full_name} has been added to the system.</p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Email</span>
              <span className="font-bold text-on-surface">{result.user.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Staff ID</span>
              <span className="font-bold text-on-surface">{result.user.employee_id}</span>
            </div>
          </div>

          {result.temp_password && (
            <CredentialsCard email={result.user.email} password={result.temp_password} label="Bursar Temporary Password" />
          )}

          <button onClick={() => navigate('/admin/operations')} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
            Return to Operations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/admin/operations')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Administration
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 block mb-3">Finance Staff</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Add Bursar</h1>
        <p className="text-on-surface-variant mt-2 text-lg leading-relaxed max-w-2xl">
          Register a new bursar with access to the financial treasury portal.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8">
            
            <div className="space-y-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                <UserCircle className="text-primary w-6 h-6" /> Personal Details
              </h3>
              
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First Name</label>
                  <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Middle Name</label>
                  <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Last Name</label>
                  <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Official Email Address</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. bursar@school.edu" />
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                <BadgeCheck className="text-primary w-6 h-6" /> Employment Details
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Staff ID Number</label>
                  <input type="text" name="employee_id" value={formData.employee_id} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="Auto-generated if blank" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Phone (optional)</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="+237 6XX XXX XXX" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8">
              <button disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email} type="submit" className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {isSubmitting ? 'Provisioning Bursar...' : 'Complete Onboarding'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-200/50 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
              <Banknote className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="text-sm font-bold tracking-tight text-on-surface mb-3">Bursar Access</h4>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              The bursar will have access to the Finance Treasury portal including invoices, payments, student ledger, and expense tracking. They cannot access academic or administration modules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
