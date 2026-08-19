import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function Communications() {
  const { t } = useTranslation('adminGov');
  const { addToast } = useToastStore();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', is_urgent: false });

  // Quick message state
  const [msgRecipient, setMsgRecipient] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await api.get('/notifications/announcements/');
        setAnnouncements(res.data.results || res.data);
      } catch (err) {
        console.error('Failed to fetch announcements', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const audienceOptions = [
    { value: 'all', label: 'Everyone', icon: 'groups' },
    { value: 'teachers', label: 'Teachers Only', icon: 'school' },
    { value: 'parents', label: 'Parents Only', icon: 'family_restroom' },
    { value: 'students', label: 'Students Only', icon: 'face' },
    { value: 'staff', label: 'All Staff', icon: 'badge' },
  ];

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">{t('Internal Communications')}</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">{t('Announcements & Messaging')}</h2>
          <p className="text-on-surface-variant text-lg mt-2">{t('Broadcast school-wide announcements and communicate directly with parents, teachers, and staff.')}</p>
        </div>
        <button
          onClick={() => setComposing(!composing)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            {composing ? 'close' : 'campaign'}
          </span>
          {composing ? t('Cancel') : t('New Announcement')}
        </button>
      </div>

      {/* Composer */}
      {composing && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-lg p-8 animate-in slide-in-from-top duration-300">
          <h3 className="text-xl font-bold text-on-surface mb-6">{t('Compose Announcement')}</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">{t('Title')}</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-primary focus:border-primary bg-surface-bright placeholder-outline focus:outline-none"
                placeholder={t('Enter announcement title...')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">{t('Message')}</label>
              <textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                rows={4}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-primary focus:border-primary bg-surface-bright placeholder-outline focus:outline-none resize-none"
                placeholder={t('Write the body of the announcement...')}
              />
            </div>
            <div className="flex gap-6 items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-on-surface mb-2">{t('Target Audience')}</label>
                <div className="flex gap-2 flex-wrap">
                  {audienceOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, audience: opt.value })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all
                        ${form.audience === opt.value
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:border-primary/50'
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={form.is_urgent}
                  onChange={e => setForm({ ...form, is_urgent: e.target.checked })}
                  className="h-4 w-4 text-error focus:ring-error border-outline-variant rounded"
                />
                <label htmlFor="urgent" className="text-sm font-semibold text-error cursor-pointer">{t('Mark as Urgent')}</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/15">
              <button onClick={() => setComposing(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors">
                {t('Discard')}
              </button>
              <button
                onClick={async () => {
                  if (!form.title.trim() || !form.body.trim()) {
                    addToast(t('Title and message are required.'), 'error');
                    return;
                  }
                  setPublishing(true);
                  try {
                    await api.post('/notifications/announcements/', {
                      title: form.title,
                      body: form.body,
                      audience: form.audience,
                      is_urgent: form.is_urgent,
                      published: true,
                    });
                    addToast(t('Announcement published successfully!'), 'success');
                    setForm({ title: '', body: '', audience: 'all', is_urgent: false });
                    setComposing(false);
                    // Refresh list
                    const res = await api.get('/notifications/announcements/');
                    setAnnouncements(res.data.results || res.data);
                  } catch (err: any) {
                    addToast(err.response?.data?.detail || t('Failed to publish.'), 'error');
                  } finally {
                    setPublishing(false);
                  }
                }}
                disabled={publishing}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">{publishing ? 'sync' : 'send'}</span>
                {publishing ? t('Publishing...') : t('Publish Announcement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements Feed */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-on-surface">{t('Recent Announcements')}</h3>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              <button className="px-4 py-1.5 text-sm font-bold bg-white text-on-surface rounded shadow-sm">{t('All')}</button>
              <button className="px-4 py-1.5 text-sm font-bold text-on-surface-variant hover:text-on-surface">{t('Urgent')}</button>
              <button className="px-4 py-1.5 text-sm font-bold text-on-surface-variant hover:text-on-surface">{t('Drafts')}</button>
            </div>
          </div>

          {loading ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mb-4">sync</span>
              <p>{t('Loading announcements...')}</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/30 p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-4 block">forum</span>
              <h4 className="text-lg font-bold text-on-surface mb-2">{t('No Announcements Yet')}</h4>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">{t('Create the first school-wide announcement to communicate with parents, teachers, and students.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((a, i) => (
                <div key={i} className={`bg-surface-container-lowest rounded-2xl border shadow-sm p-6 hover:shadow-md transition-shadow ${a.is_urgent ? 'border-error/30' : 'border-outline-variant/15'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      {a.is_urgent && (
                        <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                      )}
                      <h4 className="text-lg font-bold text-on-surface">{a.title}</h4>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${a.published ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                      {a.published ? t('Published') : t('Draft')}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed mb-4 line-clamp-2">{a.body}</p>
                  <div className="flex justify-between items-center pt-3 border-t border-outline-variant/10">
                    <div className="flex items-center gap-4 text-xs text-outline">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">group</span>
                        {a.audience_display}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">person</span>
                        {a.created_by_name || t('Admin')}
                      </span>
                    </div>
                    <button className="text-primary text-sm font-semibold hover:underline">{t('Edit')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Message Sidebar */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-surface-container-low p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary">chat</span>
              <h3 className="font-bold text-on-surface">{t('Quick Message')}</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">{t('Send a direct message to a specific parent or teacher.')}</p>
            <div className="space-y-4">
              <input
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-surface-bright placeholder-outline focus:ring-primary focus:border-primary focus:outline-none"
                placeholder={t('Search recipient by name or email...')}
                value={msgRecipient}
                onChange={async (e) => {
                  const val = e.target.value;
                  setMsgRecipient(val);
                  if (val.length >= 2) {
                    try {
                      const res = await api.get(`/users/?search=${encodeURIComponent(val)}`);
                      setRecipientSearch(res.data.results || res.data || []);
                    } catch { setRecipientSearch([]); }
                  } else {
                    setRecipientSearch([]);
                  }
                }}
              />
              {recipientSearch.length > 0 && (
                <div className="border border-outline-variant rounded-xl max-h-40 overflow-y-auto">
                  {recipientSearch.map((u: any) => (
                    <button
                      key={u.id}
                      onClick={() => { setMsgRecipient(u.id); setRecipientSearch([]); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container-high border-b border-outline-variant/10 last:border-0"
                    >
                      <span className="font-semibold">{u.first_name} {u.last_name}</span>
                      <span className="text-on-surface-variant ml-2">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-surface-bright placeholder-outline focus:ring-primary focus:border-primary focus:outline-none"
                placeholder={t('Subject...')}
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />
              <textarea
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm bg-surface-bright placeholder-outline focus:ring-primary focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder={t('Write a message...')}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
              />
              <button
                onClick={async () => {
                  if (!msgRecipient || !msgBody.trim()) {
                    addToast(t('Recipient and message are required.'), 'error');
                    return;
                  }
                  setSendingMsg(true);
                  try {
                    await api.post('/notifications/messages/', {
                      recipient: msgRecipient,
                      subject: msgSubject,
                      body: msgBody,
                    });
                    addToast(t('Message sent!'), 'success');
                    setMsgRecipient('');
                    setMsgSubject('');
                    setMsgBody('');
                  } catch (err: any) {
                    addToast(err.response?.data?.detail || t('Failed to send message.'), 'error');
                  } finally {
                    setSendingMsg(false);
                  }
                }}
                disabled={sendingMsg}
                className="w-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">{sendingMsg ? 'sync' : 'send'}</span>
                {sendingMsg ? t('Sending...') : t('Send Message')}
              </button>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-outline">analytics</span>
              <h3 className="font-bold text-on-surface">{t('Delivery Stats')}</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Total Sent', value: announcements.length.toString(), color: 'text-primary' },
                { label: 'Pending Drafts', value: announcements.filter(a => !a.published).length.toString(), color: 'text-on-surface-variant' },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-surface-container-low/50 rounded-lg">
                  <span className="text-sm text-on-surface-variant">{t(stat.label)}</span>
                  <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
