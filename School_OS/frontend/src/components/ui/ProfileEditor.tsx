import React, { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import { useTranslation } from 'react-i18next';

interface ProfileEditorProps {
  role: 'admin' | 'teacher' | 'parent';
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ role }) => {
  const { t } = useTranslation('ui');
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [middleName, setMiddleName] = useState(user?.middle_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [language, setLanguage] = useState(user?.default_language || 'en');
  const [emailAlerts, setEmailAlerts] = useState(user?.email_alerts ?? true);
  const [smsAlerts, setSmsAlerts] = useState(user?.sms_alerts ?? false);
  const [profilePhoto, setProfilePhoto] = useState(user?.profile_photo || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const colorMap = { admin: 'bg-slate-900', teacher: 'bg-primary', parent: 'bg-blue-900' };
  const accentColor = colorMap[role];

  const getInitials = () => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const getPhotoUrl = () => {
    if (!profilePhoto) return null;
    if (profilePhoto.startsWith('http')) return profilePhoto;
    if (profilePhoto.startsWith('media/')) {
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1$/, '');
      return `${apiBase}/${profilePhoto}`;
    }
    return profilePhoto;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast(t('File too large. Maximum size is 5MB.'), 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      addToast(t('Unsupported file type. Use JPG, PNG, WebP, or GIF.'), 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const response = await api.post('/auth/upload-photo/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfilePhoto(response.data.profile_photo || '');
      useAuthStore.getState().setAuth(
        useAuthStore.getState().token!,
        useAuthStore.getState().refreshToken!,
        { ...user!, ...response.data },
        useAuthStore.getState().tenants,
        useAuthStore.getState().roles,
      );
      addToast(t('Profile photo updated.'), 'success');
    } catch {
      addToast(t('Failed to upload photo.'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        phone: phone || undefined,
        email: email || undefined,
        default_language: language,
        email_alerts: emailAlerts,
        sms_alerts: smsAlerts,
      };

      const response = await api.patch('/auth/me/', payload);
      useAuthStore.getState().setAuth(
        useAuthStore.getState().token!,
        useAuthStore.getState().refreshToken!,
        { ...user!, ...response.data },
        useAuthStore.getState().tenants,
        useAuthStore.getState().roles,
      );
      addToast(t('Profile saved successfully.'), 'success');
    } catch {
      addToast(t('Failed to save profile.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = getPhotoUrl();

  return (
    <div className="space-y-6">
      {/* Photo + Name Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Photo */}
          <div className="relative group">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-primary transition-colors"
            >
              {photoUrl ? (
                <img src={photoUrl} alt={t('Profile')} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full ${accentColor} text-white flex items-center justify-center font-black text-2xl`}>
                  {getInitials()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">camera_alt</span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            {uploadingPhoto && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined animate-spin text-primary text-sm">sync</span>
              </div>
            )}
          </div>

          {/* Name Fields */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">{t('First Name')}</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">{t('Middle Name')}</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">{t('Last Name')}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact & Preferences */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Contact & Preferences</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 xxx xxx xxx"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        {/* Notification Toggles */}
        <div className="space-y-3 pt-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notifications</h4>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-500 text-xl">email</span>
              <span className="text-sm font-semibold text-slate-700">Email Alerts</span>
            </div>
            <div
              onClick={() => setEmailAlerts(!emailAlerts)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${emailAlerts ? accentColor : 'bg-slate-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${emailAlerts ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-500 text-xl">sms</span>
              <span className="text-sm font-semibold text-slate-700">SMS Alerts</span>
            </div>
            <div
              onClick={() => setSmsAlerts(!smsAlerts)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${smsAlerts ? accentColor : 'bg-slate-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${smsAlerts ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-4 ${accentColor} text-white rounded-2xl font-bold text-sm shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2`}
      >
        {saving ? (
          <span className="material-symbols-outlined animate-spin text-lg">sync</span>
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">check</span>
            Save Changes
          </>
        )}
      </button>
    </div>
  );
};

export default ProfileEditor;
