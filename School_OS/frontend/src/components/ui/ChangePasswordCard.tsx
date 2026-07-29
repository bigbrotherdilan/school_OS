import { useState } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { api } from '../../services/api';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ChangePasswordCard() {
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      addToast('New passwords do not match.', 'error');
      return;
    }

    if (formData.new_password.length < 8) {
      addToast('New password must be at least 8 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/change-password/', {
        old_password: formData.old_password,
        new_password: formData.new_password,
      });
      setSuccess(true);
      setFormData({ old_password: '', new_password: '', confirm_password: '' });
      addToast('Password changed successfully.', 'success');
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Failed to change password.';
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-outline-variant/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">Change Password</h3>
            <p className="text-xs text-on-surface-variant">Update your account password</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Current Password</label>
          <div className="relative">
            <input
              required
              type={showOld ? 'text' : 'password'}
              name="old_password"
              value={formData.old_password}
              onChange={handleChange}
              className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 pr-12 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40"
              placeholder="Enter current password"
            />
            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
              {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">New Password</label>
          <div className="relative">
            <input
              required
              type={showNew ? 'text' : 'password'}
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 pr-12 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40"
              placeholder="Minimum 8 characters"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Confirm New Password</label>
          <input
            required
            type="password"
            name="confirm_password"
            value={formData.confirm_password}
            onChange={handleChange}
            className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40"
            placeholder="Re-enter new password"
          />
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 bg-secondary/10 text-secondary rounded-xl text-sm font-bold">
            <CheckCircle className="w-4 h-4" /> Password changed successfully.
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !formData.old_password || !formData.new_password || !formData.confirm_password}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <KeyRound className="w-4 h-4" />}
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
