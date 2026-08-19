import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { Save, Send, Server, Key, ShieldCheck, Loader2 } from 'lucide-react';

export default function EmailSettings() {
  const { t } = useTranslation('adminGov');
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    use_tls: true,
    username: '',
    password: '',
    from_email: '',
  });
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/email-settings/');
      const d = res.data;
      setSettings({
        host: d.host || 'smtp.gmail.com',
        port: d.port || 587,
        use_tls: d.use_tls ?? true,
        username: d.username || '',
        password: d.password || '',
        from_email: d.from_email || '',
      });
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/notifications/email-settings/', settings);
      addToast(t('Email settings saved.'), 'success');
    } catch {
      addToast(t('Failed to save email settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      addToast(t('Enter a test recipient email.'), 'error');
      return;
    }
    setTesting(true);
    try {
      await api.post('/notifications/email-settings/test/', { to_email: testEmail });
      addToast(t('Test email sent successfully! Check your inbox.'), 'success');
      fetchSettings();
    } catch (err: any) {
      const msg = err.response?.data?.detail || t('Test email failed. Check SMTP settings.');
      addToast(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-on-surface tracking-tight">{t('Email Settings')}</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {t('Configure SMTP to send password resets, notifications, and alerts.')}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-outline-variant/10">
          <Server className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('SMTP Server')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('Host')}</label>
            <input
              type="text"
              value={settings.host}
              onChange={e => setSettings({ ...settings, host: e.target.value })}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none"
              placeholder="smtp.gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('Port')}</label>
            <input
              type="number"
              value={settings.port}
              onChange={e => setSettings({ ...settings, port: parseInt(e.target.value) || 587 })}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="use_tls"
            checked={settings.use_tls}
            onChange={e => setSettings({ ...settings, use_tls: e.target.checked })}
            className="rounded border-outline-variant/20"
          />
          <label htmlFor="use_tls" className="text-xs font-bold text-on-surface-variant cursor-pointer">{t('Use TLS')}</label>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-outline-variant/10">
          <Key className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('Credentials')}</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('Username (email)')}</label>
          <input
            type="email"
            value={settings.username}
            onChange={e => setSettings({ ...settings, username: e.target.value })}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none"
            placeholder="your-email@gmail.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('Password / App Password')}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.password}
              onChange={e => setSettings({ ...settings, password: e.target.value })}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none pr-10"
              placeholder={t('Gmail app password or SMTP password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant"
            >
              {showPassword ? t('Hide') : t('Show')}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('From Email')}</label>
          <input
            type="email"
            value={settings.from_email}
            onChange={e => setSettings({ ...settings, from_email: e.target.value })}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none"
            placeholder="noreply@schoolos.sos"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('Save Settings')}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 space-y-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-outline-variant/10">
          <Send className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('Test Email')}</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('Send test to')}</label>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-primary/5 outline-none"
              placeholder="admin@school.com"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testEmail}
              className="bg-secondary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:shadow-lg hover:shadow-secondary/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {t('Send')}
            </button>
          </div>
          <p className="text-[9px] text-on-surface-variant/50 mt-1 ml-1">
            {t('Uses the saved SMTP settings above. For Gmail, enable 2FA and use an App Password.')}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-low/50 rounded-3xl p-6 border border-outline-variant/5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{t('Need a free SMTP?')}</span>
        </div>
        <ul className="text-[10px] text-on-surface-variant space-y-1 ml-1">
          <li><strong>Gmail</strong> {t('— Free. Enable 2FA, generate App Password in Google Account > Security.')}</li>
          <li><strong>SendGrid</strong> {t('— Free tier: 100 emails/day. Sign up at sendgrid.com.')}</li>
          <li><strong>Brevo</strong> {t('— Free tier: 300 emails/day. Sign up at brevo.com.')}</li>
        </ul>
      </div>
    </div>
  );
}