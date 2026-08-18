import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import ProfileEditor from '../../../components/ui/ProfileEditor';
import PinSetupModal from '../../../components/ui/PinSetupModal';
import PinReauthModal from '../../../components/ui/PinReauthModal';
import { useToastStore } from '../../../stores/toastStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { useAuthStore } from '../../../stores/authStore';
import { DEFAULT_THEME, PRESET_TEMPLATES, FONT_OPTIONS, applyThemeVars, hexToRgb, shadeHex, contrastTextOn, type ThemeConfig } from '../../../utils/theme';
import type { SchoolInfo } from '../../../stores/tenantStore';
import { api } from '../../../services/api';

export default function Settings() {
  const navigate = useNavigate();
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const { addToast } = useToastStore();
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const { activeTenantId, schoolConfig, themeConfig, logoUrl, schoolInfo, fetchSchoolConfig, patchSchoolConfig, updateThemeConfig, uploadLogo, setDraftTheme, fetchSchoolInfo, updateSchoolInfo } = useTenantStore();
  const roles = useAuthStore(s => s.roles);
  const tenants = useAuthStore(s => s.tenants);
  const activeTenantName = tenants?.find(t => t.id === activeTenantId)?.school_name || 'School';
  const schoolInitials = activeTenantName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isAdminRole = roles.some(r => r.tenant_id === activeTenantId && (r.role === 'admin' || r.role === 'super_admin'));

  const [showChangePin, setShowChangePin] = useState(false);
  const [showRemovePinModal, setShowRemovePinModal] = useState(false);
  const [pinInfo, setPinInfo] = useState<{ pin_is_set: boolean; pin_set_at: string | null }>({ pin_is_set: false, pin_set_at: null });

  const [financeRecording, setFinanceRecording] = useState<'admin_and_bursar' | 'bursar_only'>(schoolConfig.finance_recording);
  const [savingFinance, setSavingFinance] = useState(false);

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_THEME.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_THEME.secondaryColor);
  const [accentColor, setAccentColor] = useState(DEFAULT_THEME.accentColor);
  const [fontFamily, setFontFamily] = useState(DEFAULT_THEME.fontFamily);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSchoolInfo, setSavingSchoolInfo] = useState(false);
  const [schoolInfoDraft, setSchoolInfoDraft] = useState<Partial<SchoolInfo>>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const savedThemeRef = useRef<ThemeConfig | null>(null);
  const brandInitializedRef = useRef(false);

  const hasBrandingChanges =
    !!themeConfig &&
    (primaryColor !== themeConfig.primaryColor ||
      secondaryColor !== themeConfig.secondaryColor ||
      accentColor !== themeConfig.accentColor ||
      fontFamily !== themeConfig.fontFamily);

  useEffect(() => {
    if (activeTenantId) fetchSchoolConfig(activeTenantId);
  }, [activeTenantId, fetchSchoolConfig]);

  useEffect(() => {
    if (activeTenantId) fetchSchoolInfo(activeTenantId);
  }, [activeTenantId, fetchSchoolInfo]);

  useEffect(() => {
    if (schoolInfo && Object.keys(schoolInfoDraft).length === 0) {
      setSchoolInfoDraft(schoolInfo);
    }
  }, [schoolInfo]);

  useEffect(() => {
    setFinanceRecording(schoolConfig.finance_recording);
  }, [schoolConfig.finance_recording]);

  useEffect(() => {
    if (themeConfig) {
      savedThemeRef.current = themeConfig;
      if (!brandInitializedRef.current) {
        brandInitializedRef.current = true;
        setPrimaryColor(themeConfig.primaryColor);
        setSecondaryColor(themeConfig.secondaryColor);
        setAccentColor(themeConfig.accentColor);
        setFontFamily(themeConfig.fontFamily);
      }
    }
  }, [themeConfig]);

  useEffect(() => {
    const draft = {
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
    };
    applyThemeVars(draft);
    setDraftTheme(draft);
  }, [primaryColor, secondaryColor, accentColor, fontFamily]);

  useEffect(() => {
    return () => {
      setDraftTheme(null);
      if (savedThemeRef.current) applyThemeVars(savedThemeRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTenantId) {
      api.get('/auth/pin/').then(res => setPinInfo(res.data)).catch(() => {});
    }
  }, [activeTenantId]);

  const handleSaveBranding = async () => {
    if (!hexToRgb(primaryColor) || !hexToRgb(secondaryColor)) {
      addToast('Enter valid hex colors (e.g. #00236f).', 'error');
      return;
    }
    setSavingBranding(true);
    try {
      await updateThemeConfig({ primaryColor, secondaryColor, accentColor, fontFamily });
      addToast('Brand colors and fonts confirmed and applied to everyone across the portal.', 'success');
    } catch {
      addToast('Failed to save brand colors.', 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetBranding = () => {
    setPrimaryColor(DEFAULT_THEME.primaryColor);
    setSecondaryColor(DEFAULT_THEME.secondaryColor);
    setAccentColor(DEFAULT_THEME.accentColor);
    setFontFamily(DEFAULT_THEME.fontFamily);
    addToast('Previewing the default theme — click Confirm to apply it to everyone.', 'info');
  };

  const handleDiscardBranding = () => {
    if (!themeConfig) return;
    setPrimaryColor(themeConfig.primaryColor);
    setSecondaryColor(themeConfig.secondaryColor);
    setAccentColor(themeConfig.accentColor);
    setFontFamily(themeConfig.fontFamily);
    addToast('Reverted to the saved theme.', 'info');
  };

  const handleApplyTemplate = (t: (typeof PRESET_TEMPLATES)[number]) => {
    setPrimaryColor(t.colors.primaryColor);
    setSecondaryColor(t.colors.secondaryColor);
    setAccentColor(t.colors.accentColor);
    addToast(`Previewing "${t.name}" — click Confirm to apply it to everyone.`, 'info');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activeTenantId) {
      addToast('No active school selected.', 'error');
      return;
    }
    setUploadingLogo(true);
    try {
      await uploadLogo(activeTenantId, file);
      addToast('Logo uploaded and saved. The URL is stored, not the file.', 'success');
    } catch {
      addToast('Failed to upload logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFinanceToggle = async (value: 'admin_and_bursar' | 'bursar_only') => {
    setSavingFinance(true);
    try {
      await patchSchoolConfig({ finance_recording: value });
      addToast(
        value === 'bursar_only'
          ? 'Finance recording restricted to bursars only.'
          : 'Admins can record finance again.',
        'success'
      );
    } catch {
      addToast('Failed to update finance settings.', 'error');
    } finally {
      setSavingFinance(false);
    }
  };

  const handlePurge = () => {
    addToast('System cache completely purged. Operations restored to zero state.', 'success');
  };

  const handleSaveSchoolInfo = async () => {
    if (!schoolInfoDraft.school_name?.trim()) {
      addToast('School name is required.', 'error');
      return;
    }
    setSavingSchoolInfo(true);
    try {
      await updateSchoolInfo(schoolInfoDraft);
      addToast('School information saved.', 'success');
    } catch {
      addToast('Failed to save school information.', 'error');
    } finally {
      setSavingSchoolInfo(false);
    }
  };

  const handleNavClick = (item: { route?: string; target?: string }) => {
    if (item.route) {
      navigate(item.route);
      return;
    }
    if (item.target) {
      document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    addToast('This section is not available yet.', 'info');
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
            { label: 'Profile & Authority', icon: 'person_outline', target: 'settings-profile' },
            { label: 'School Information', icon: 'school', target: 'settings-school-info' },
            { label: 'Institution Branding', icon: 'palette', target: 'settings-branding' },
            { label: 'Academic Structure', icon: 'account_tree', route: '/admin/academic/setup' },
            { label: 'Security & Privacy', icon: 'shield', target: 'settings-security' },
            { label: 'PIN Security', icon: 'pin', target: 'settings-pin' },
            { label: 'Billing & Subscriptions', icon: 'credit_card', target: 'settings-billing' },
            { label: 'Integrations', icon: 'extension', route: '/admin/settings/integrations' },
            { label: 'Email Configuration', icon: 'mail', route: '/admin/settings/email' }
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => handleNavClick(item)}
              className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </aside>

        <main className="col-span-12 lg:col-span-9 space-y-12">
          <div id="settings-profile" className="space-y-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Profile & Authority</h3>
            <ProfileEditor role="admin" />
          </div>

          <div id="settings-school-info" className="space-y-8 pt-12 border-t border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">School Information</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Details shown on report cards, ID cards, and public profile.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'school_name', label: 'School Name', required: true, colSpan: true },
                { key: 'motto', label: 'School Motto', colSpan: true },
                { key: 'phone', label: 'Phone Number', placeholder: '+237 6XX XXX XXX' },
                { key: 'email', label: 'Email Address', placeholder: 'info@yourschool.cm', type: 'email' },
                { key: 'address', label: 'Street Address', colSpan: true },
                { key: 'region', label: 'Region' },
                { key: 'division', label: 'Division' },
                { key: 'country', label: 'Country', placeholder: 'Cameroon' },
                { key: 'postal_code', label: 'Postal Code' },
              ].map((field) => (
                <div key={field.key} className={field.colSpan ? 'md:col-span-2' : ''}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    {field.label} {field.required && <span className="text-error">*</span>}
                  </label>
                  <input
                    type={field.type || 'text'}
                    value={(schoolInfoDraft as Record<string, string>)?.[field.key] || ''}
                    onChange={(e) => setSchoolInfoDraft({ ...schoolInfoDraft, [field.key]: e.target.value })}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Education System</label>
                <select
                  value={schoolInfoDraft.education_type || ''}
                  onChange={(e) => setSchoolInfoDraft({ ...schoolInfoDraft, education_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                >
                  <option value="anglophone">Anglophone</option>
                  <option value="francophone">Francophone</option>
                  <option value="bilingual">Bilingual</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">School Type</label>
                <select
                  value={schoolInfoDraft.school_type || ''}
                  onChange={(e) => setSchoolInfoDraft({ ...schoolInfoDraft, school_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                >
                  <option value="general">General</option>
                  <option value="technical">Technical</option>
                  <option value="vocational">Vocational</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Session Type</label>
                <select
                  value={schoolInfoDraft.session_type || ''}
                  onChange={(e) => setSchoolInfoDraft({ ...schoolInfoDraft, session_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSaveSchoolInfo}
              disabled={savingSchoolInfo}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingSchoolInfo ? <span className="material-symbols-outlined animate-spin text-base">sync</span> : <span className="material-symbols-outlined text-base">check_circle</span>}
              {savingSchoolInfo ? 'Saving...' : 'Save School Information'}
            </button>
          </div>

          <div id="settings-branding" className="space-y-8 pt-12 border-t border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Institution Branding</h3>
            <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center border border-slate-100 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="School logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-primary font-black text-2xl">{schoolInitials}</span>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Official Seal / Logo</h4>
                  <p className="text-xs font-medium text-slate-400 mt-1">
                    {logoUrl ? 'Logo uploaded — stored in object storage (URL only, not in the DB).' : 'No logo uploaded'}
                  </p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingLogo ? 'Uploading...' : logoUrl ? 'Replace' : 'Upload'}
              </button>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">visibility</span>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Live Preview — your admin dashboard</h4>
                </div>
                <span className="text-[9px] text-slate-400 font-semibold">Updates as you pick</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 flex h-56">
                <div className="w-32 shrink-0 p-3 flex flex-col gap-2" style={{ backgroundColor: primaryColor }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                      <span className="material-symbols-outlined text-[12px]" style={{ color: contrastTextOn(primaryColor) }}>school</span>
                    </span>
                    <span className="text-[9px] font-bold truncate" style={{ color: contrastTextOn(primaryColor) }}>School OS</span>
                  </div>
                  <div className="mt-1 space-y-1.5">
                    {['Dashboard', 'Finance', 'Settings'].map((label, i) => (
                      <div
                        key={label}
                        className="rounded-md px-2 py-1 text-[9px] font-semibold"
                        style={{
                          backgroundColor: i === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                          color: contrastTextOn(primaryColor),
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto text-[8px]" style={{ color: contrastTextOn(primaryColor), opacity: 0.5 }}>School Admin</div>
                </div>
                <div className="flex-1 bg-slate-50 flex flex-col min-w-0">
                  <div className="h-10 bg-white border-b border-slate-100 flex items-center justify-between px-3">
                    <span className="text-[10px] font-bold tracking-tighter truncate" style={{ color: primaryColor }}>School OS</span>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                      <span className="text-[8px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ backgroundColor: primaryColor, color: contrastTextOn(primaryColor) }}>Confirm</span>
                      <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[7px] font-bold shrink-0" style={{ color: primaryColor, borderColor: primaryColor, backgroundColor: 'rgba(0,0,0,0.04)' }}>AD</span>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="block h-1.5 w-8 rounded-full mb-2" style={{ backgroundColor: primaryColor }} />
                      <span className="block h-1 w-12 rounded-full bg-slate-200" />
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="block h-1.5 w-8 rounded-full mb-2" style={{ backgroundColor: accentColor }} />
                      <span className="block h-1 w-12 rounded-full bg-slate-200" />
                    </div>
                    <div className="col-span-2 rounded-lg px-2 py-1.5 text-[8px] font-bold flex items-center justify-between" style={{ backgroundColor: secondaryColor, color: '#ffffff' }}>
                      <span>Secondary accent strip</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Brand Color</label>
                <div className="flex items-center gap-4">
                  <label
                    className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-4 ring-white cursor-pointer shrink-0"
                    style={{ backgroundColor: hexToRgb(primaryColor) ? primaryColor : DEFAULT_THEME.primaryColor }}
                  >
                    <input
                      type="color"
                      value={hexToRgb(primaryColor) ? primaryColor : DEFAULT_THEME.primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      aria-label="Primary brand color"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#HEX"
                    className="flex-1 bg-slate-50 border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm font-bold font-mono"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secondary Accent</label>
                <div className="flex items-center gap-4">
                  <label
                    className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-4 ring-white cursor-pointer shrink-0"
                    style={{ backgroundColor: hexToRgb(secondaryColor) ? secondaryColor : DEFAULT_THEME.secondaryColor }}
                  >
                    <input
                      type="color"
                      value={hexToRgb(secondaryColor) ? secondaryColor : DEFAULT_THEME.secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      aria-label="Secondary accent color"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#HEX"
                    className="flex-1 bg-slate-50 border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Typography</h4>
                <span className="text-[9px] text-slate-400/60 font-medium">Choose the font used across your portal</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {FONT_OPTIONS.map(f => {
                  const isCurrent = fontFamily === f.value;
                  return (
                    <button
                      key={f.label}
                      onClick={() => setFontFamily(f.value)}
                      disabled={savingBranding}
                      className={`relative rounded-2xl p-4 border bg-white text-left transition-all hover:shadow-md active:scale-95 disabled:opacity-60 ${
                        isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="text-sm font-bold text-slate-800 truncate block"
                        style={{ fontFamily: f.value }}
                      >
                        Aa
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand Templates</h4>
                <span className="text-[9px] text-slate-400/60 font-medium">Tap a template to preview it instantly</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESET_TEMPLATES.map(t => {
                  const isCurrent = t.colors.primaryColor === primaryColor && t.colors.secondaryColor === secondaryColor;
                  return (
                    <button
                      key={t.name}
                      onClick={() => handleApplyTemplate(t)}
                      disabled={savingBranding}
                      className={`relative rounded-2xl p-3 border bg-white text-left transition-all hover:shadow-md active:scale-95 disabled:opacity-60 ${
                        isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {t.premium && (
                        <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow">
                          <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
                          Pro
                        </span>
                      )}
                      <div className="flex gap-1.5 mb-2">
                        <span className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: t.colors.primaryColor }} />
                        <span className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: shadeHex(t.colors.primaryColor, 0.78) }} />
                        <span className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: t.colors.secondaryColor }} />
                      </div>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-tight">{t.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {hasBrandingChanges && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Previewing — not yet saved
                </span>
              )}
              <button
                onClick={handleSaveBranding}
                disabled={savingBranding}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  hasBrandingChanges
                    ? 'bg-primary text-white shadow-primary/20 ring-2 ring-primary/30 animate-pulse'
                    : 'bg-primary text-white shadow-primary/20'
                }`}
              >
                {savingBranding ? <span className="material-symbols-outlined animate-spin text-base">sync</span> : <span className="material-symbols-outlined text-base">check_circle</span>}
                {savingBranding ? 'Saving...' : hasBrandingChanges ? 'Confirm Branding' : 'Save Branding'}
              </button>
              {hasBrandingChanges && (
                <button
                  onClick={handleDiscardBranding}
                  disabled={savingBranding}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">undo</span>
                  Discard Preview
                </button>
              )}
              <button
                onClick={handleResetBranding}
                disabled={savingBranding}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset to Default
              </button>
              <p className="text-xs text-slate-400 font-medium">
                {hasBrandingChanges
                  ? 'Only you see this preview. Confirm to apply it to everyone.'
                  : 'Pick colors or tap a template to preview instantly — confirm to apply to everyone.'}
              </p>
            </div>
          </div>

          <div id="settings-security" className="space-y-8 pt-12 border-t border-slate-100">
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

          <div id="settings-pin" className="space-y-8 pt-12 border-t border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Quick Unlock PIN</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Set a 6-digit PIN for quick re-entry after inactivity or for sensitive actions.
              </p>
            </div>

            {pinInfo.pin_is_set ? (
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary">lock</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">PIN is active</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Set {pinInfo.pin_set_at ? new Date(pinInfo.pin_set_at).toLocaleDateString() : 'previously'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowChangePin(true)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all"
                    >
                      Change PIN
                    </button>
                    <button
                      onClick={() => setShowRemovePinModal(true)}
                      className="px-4 py-2 bg-white border border-error/30 text-error rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-error hover:text-white transition-all"
                    >
                      Remove PIN
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">pin</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">No PIN set</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Add a PIN for quick re-entry after inactivity.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChangePin(true)}
                  className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
                >
                  Set Up PIN
                </button>
              </div>
            )}
          </div>

          <div id="settings-billing" className="space-y-8 pt-12 border-t border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Billing & Finance</h3>
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200/60">
              <div className="flex justify-between items-center gap-8">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Finance Recording Role</h4>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-md">
                    {financeRecording === 'bursar_only'
                      ? 'Only the bursar can record payments, expenses, and generate fees. Admins keep read-only access to the treasury.'
                      : 'Admins and the bursar can both record payments, expenses, and generate fees.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleFinanceToggle('admin_and_bursar')}
                    disabled={savingFinance}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${financeRecording === 'admin_and_bursar' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Admin + Bursar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinanceToggle('bursar_only')}
                    disabled={savingFinance}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${financeRecording === 'bursar_only' ? 'bg-error text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Bursar Only
                  </button>
                </div>
              </div>
              {isAdminRole && financeRecording === 'bursar_only' && (
                <p className="mt-4 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  You are an admin — when this mode is active you can view the treasury but cannot record transactions. Add a bursar under Administration → Add Bursar to record finance.
                </p>
              )}
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

      {showChangePin && (
        <PinSetupModal
          isOpen={showChangePin}
          onClose={() => setShowChangePin(false)}
          onSuccess={() => {
            setPinInfo({ pin_is_set: true, pin_set_at: new Date().toISOString() });
            useAuthStore.getState().setPinIsSet(true);
            setShowChangePin(false);
          }}
          currentPinIsSet={pinInfo.pin_is_set}
        />
      )}

      {showRemovePinModal && (
        <PinReauthModal
          isOpen={showRemovePinModal}
          onClose={() => setShowRemovePinModal(false)}
          onVerified={async () => {
            try {
              const password = prompt('Enter your password to remove PIN:');
              if (password) {
                await api.post('/auth/pin/remove/', { password });
                setPinInfo({ pin_is_set: false, pin_set_at: null });
                useAuthStore.getState().setPinIsSet(false);
                addToast('PIN removed.', 'success');
              }
            } catch {
              addToast('Failed to remove PIN.', 'error');
            }
            setShowRemovePinModal(false);
          }}
          title="Verify to Remove PIN"
          subtitle="Enter your PIN to confirm removal"
        />
      )}

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
