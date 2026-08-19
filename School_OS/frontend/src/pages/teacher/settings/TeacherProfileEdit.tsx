import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Briefcase, Globe, Loader2, Camera } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';

export default function TeacherProfileEdit() {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    qualification: '',
    bio: '',
    department: '',
    teaching_philosophy: '',
    years_of_experience: '',
    availability: 'full_time',
    public_profile: false,
    hourly_rate: '',
    specializations: '',
    certifications: '',
    achievements: '',
    subjects_taught: '',
    languages_spoken: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/staff/teachers/');
        const teachers = res.data.results || res.data;
        if (teachers.length > 0) {
          const t = teachers[0];
          setTeacherId(t.id);
          setProfilePhoto(t.user_details?.profile_photo || '');
          setFormData({
            first_name: t.user_details?.first_name || '',
            middle_name: t.user_details?.middle_name || '',
            last_name: t.user_details?.last_name || '',
            email: t.user_details?.email || '',
            phone: t.phone || '',
            qualification: t.qualification || '',
            bio: t.bio || '',
            department: t.department || '',
            teaching_philosophy: t.teaching_philosophy || '',
            years_of_experience: t.years_of_experience?.toString() || '',
            availability: t.availability || 'full_time',
            public_profile: t.public_profile || false,
            hourly_rate: t.hourly_rate || '',
            specializations: (t.specializations || []).join(', '),
            certifications: (t.certifications || []).join(', '),
            achievements: (t.achievements || []).join(', '),
            subjects_taught: (t.subjects_taught || []).join(', '),
            languages_spoken: (t.languages_spoken || []).join(', '),
          });
        }
      } catch (err) {
        addToast('Failed to load profile.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Photo must be under 5MB.', 'error');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      addToast('Use JPG, PNG, WebP, or GIF.', 'error');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post('/auth/upload-photo/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfilePhoto(res.data.profile_photo || '');
      addToast('Profile photo updated.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to upload photo.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Update user info
      await api.patch('/auth/me/', {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        phone: formData.phone,
      });

      // Update teacher profile
      const parseList = (val: string) => val.split(',').map(s => s.trim()).filter(Boolean);
      await api.patch(`/staff/teachers/${teacherId}/`, {
        qualification: formData.qualification,
        bio: formData.bio,
        department: formData.department,
        phone: formData.phone,
        teaching_philosophy: formData.teaching_philosophy,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : null,
        availability: formData.availability,
        public_profile: formData.public_profile,
        hourly_rate: formData.hourly_rate || null,
        specializations: parseList(formData.specializations),
        certifications: parseList(formData.certifications),
        achievements: parseList(formData.achievements),
        subjects_taught: parseList(formData.subjects_taught),
        languages_spoken: parseList(formData.languages_spoken),
      });

      addToast('Profile updated successfully.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to update profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-12 max-w-[1000px] mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/teacher')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> {t('Dashboard')}
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-3">{t('Teacher Portal')}</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">{t('My Profile')}</h1>
        <p className="text-on-surface-variant mt-2 text-lg">{t('Manage your professional profile and marketplace visibility.')}</p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Profile Photo */}
        <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4 mb-6">
            <Camera className="text-primary w-6 h-6" /> Profile Photo
          </h3>
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-3xl overflow-hidden border-2 border-outline-variant/10 shrink-0">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{formData.first_name?.[0] || 'T'}</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isUploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
              </button>
              <p className="text-[10px] text-on-surface-variant">JPG, PNG, WebP, or GIF. Max 5MB.</p>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
            <User className="text-primary w-6 h-6" /> Personal Information
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First Name</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Middle Name</label>
              <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Last Name</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email</label>
              <input type="email" value={formData.email} disabled className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm font-bold opacity-60 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="+237..." />
            </div>
          </div>
        </div>

        {/* Professional */}
        <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
            <Briefcase className="text-primary w-6 h-6" /> Professional Details
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Qualification</label>
              <input type="text" name="qualification" value={formData.qualification} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="e.g. MSc Mathematics" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Department</label>
              <input type="text" name="department" value={formData.department} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="e.g. Science" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Years of Experience</label>
              <input type="number" name="years_of_experience" value={formData.years_of_experience} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="e.g. 5" min="0" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Availability</label>
              <select name="availability" value={formData.availability} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="available">Available for Hire</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Bio</label>
            <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all resize-none" placeholder="Tell schools about yourself..." />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Teaching Philosophy</label>
            <textarea name="teaching_philosophy" value={formData.teaching_philosophy} onChange={handleChange} rows={3} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all resize-none" placeholder="Describe your teaching approach..." />
          </div>
        </div>

        {/* Marketplace */}
        <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
            <Globe className="text-primary w-6 h-6" /> Marketplace Profile
          </h3>
          <p className="text-xs text-on-surface-variant">Make your profile visible on the national teacher marketplace so schools can discover you.</p>

          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <input type="checkbox" name="public_profile" checked={formData.public_profile} onChange={handleChange} className="w-5 h-5 rounded accent-primary" />
            <div>
              <p className="text-sm font-bold">Enable Public Profile</p>
              <p className="text-xs text-on-surface-variant">Show your profile in the national teacher directory</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subjects Taught (comma-separated)</label>
              <input type="text" name="subjects_taught" value={formData.subjects_taught} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="Mathematics, Physics" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Specializations (comma-separated)</label>
              <input type="text" name="specializations" value={formData.specializations} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="AP Calculus, Olympiad Prep" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Languages (comma-separated)</label>
              <input type="text" name="languages_spoken" value={formData.languages_spoken} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="English, French" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Hourly Rate (XAF)</label>
              <input type="number" name="hourly_rate" value={formData.hourly_rate} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="Optional" min="0" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Certifications (comma-separated)</label>
            <input type="text" name="certifications" value={formData.certifications} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="BSc Mathematics, TEFL Certificate" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Achievements (comma-separated)</label>
            <input type="text" name="achievements" value={formData.achievements} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="Best Teacher Award 2025" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
