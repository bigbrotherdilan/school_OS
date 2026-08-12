import { useState } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { X, Loader2, CheckCircle2, Briefcase } from 'lucide-react';

interface EditTeacherModalProps {
  teacher: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditTeacherModal({ teacher, onClose, onUpdate }: EditTeacherModalProps) {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: teacher.user_details?.first_name || '',
    last_name: teacher.user_details?.last_name || '',
    email: teacher.user_details?.email || '',
    department: teacher.department || '',
    qualification: teacher.qualification || '',
    phone: teacher.phone || '',
    bio: teacher.bio || '',
    availability: teacher.availability || 'full_time',
    public_profile: teacher.public_profile || false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.patch(`/staff/teachers/${teacher.id}/`, formData);
      addToast('Teacher profile updated.', 'success');
      setFormData(response.data);
      onUpdate();
      onClose();
    } catch (error: any) {
      const data = error.response?.data;
      const msg = typeof data === 'string' ? data
        : data?.detail || data?.first_name?.[0] || data?.last_name?.[0] || data?.email?.[0] || data?.department?.[0] || JSON.stringify(data) || 'Failed to update teacher.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-[40px] shadow-2xl border border-outline-variant/10 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-1">Staff Records</span>
            <h2 className="text-2xl font-black text-on-surface tracking-tight">Edit Teacher Profile</h2>
            <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-widest">ID: <span className="text-primary">{teacher.employee_id}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-surface-container-high rounded-2xl transition-colors text-on-surface-variant"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name & Email */}
            <section className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">badge</span> Identity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">First Name</label>
                  <input
                    required
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Last Name</label>
                  <input
                    required
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Professional Details */}
            <section className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Professional Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    placeholder="e.g. Science, Arts, Languages"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Qualification</label>
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    placeholder="e.g. M.Ed Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    placeholder="+237 6XX XXX XXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Availability</label>
                  <select
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="available">Available for Hire</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Bio */}
            <section className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none"
                placeholder="Short professional biography..."
              />
            </section>

            {/* Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">settings</span> Visibility & Settings
              </h3>
              <div className="flex items-center gap-4 p-4 bg-surface-container-low/50 rounded-2xl border border-outline-variant/5">
                <input
                  type="checkbox"
                  id="public_profile"
                  name="public_profile"
                  checked={formData.public_profile}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-outline-variant/20 rounded focus:ring-4 focus:ring-primary/5"
                />
                <label htmlFor="public_profile" className="flex items-center gap-2 text-sm font-medium text-on-surface cursor-pointer">
                  Public Profile
                  <span className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">(Marketplace)</span>
                </label>
              </div>
            </section>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}