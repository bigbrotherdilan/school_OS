import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  audience_display: string;
  is_urgent: boolean;
  published: boolean;
  created_by_name: string;
  created_at: string;
  is_read: boolean;
}

interface DirectMessage {
  id: string;
  sender_name: string;
  recipient_name: string;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface UserNotification {
  id: string;
  category: string;
  category_display: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

type NotificationItem =
  | { type: 'announcement'; data: Announcement; id: string; timestamp: string }
  | { type: 'message'; data: DirectMessage; id: string; timestamp: string }
  | { type: 'notification'; data: UserNotification; id: string; timestamp: string };

const POLL_INTERVAL_MS = 45000;

export default function NotificationsDropdown() {
  const { t } = useTranslation('layout');
  const navigate = useNavigate();
  const { roles } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  // Current role set for the active tenant (client-side safety net on top of
  // the backend audience filter, so teachers never see parent-only items).
  const rolesRef = useRef(roles || []);
  rolesRef.current = roles || [];

  const isAnnouncementVisible = useCallback((a: Announcement): boolean => {
    const activeRoles = new Set(rolesRef.current.map((r) => r.role));
    const isAdmin = activeRoles.has('admin') || activeRoles.has('super_admin');
    if (isAdmin) return true;
    if (a.audience === 'all') return true;
    if (a.audience === 'parents' && activeRoles.has('parent')) return true;
    if (a.audience === 'teachers' && activeRoles.has('teacher')) return true;
    if (a.audience === 'students' && activeRoles.has('student')) return true;
    if (a.audience === 'staff' && (activeRoles.has('admin') || activeRoles.has('bursar') || activeRoles.has('teacher'))) return true;
    return false;
  }, []);

  // Fetch only UNREAD items — read ones never come back into the bell list.
  const fetchItems = useCallback(() => {
    return Promise.all([
      api.get('/notifications/notifications/?unread=true&limit=10').catch(() => ({ data: { results: [] } })),
      api.get('/notifications/announcements/?published=true&unread=true&ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
      api.get('/notifications/messages/?unread=true&ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
    ]).then(([notifRes, annRes, msgRes]) => {
      const notifs: NotificationItem[] = (notifRes.data.results || notifRes.data || []).map((n: UserNotification) => ({
        type: 'notification' as const,
        data: n,
        id: `n_${n.id}`,
        timestamp: n.created_at,
      }));
      const anns: NotificationItem[] = (annRes.data.results || annRes.data || [])
        .filter((a: Announcement) => isAnnouncementVisible(a))
        .map((a: Announcement) => ({
          type: 'announcement' as const,
          data: a,
          id: `a_${a.id}`,
          timestamp: a.created_at,
        }));
      const msgs: NotificationItem[] = (msgRes.data.results || msgRes.data || []).map((m: DirectMessage) => ({
        type: 'message' as const,
        data: m,
        id: `m_${m.id}`,
        timestamp: m.created_at,
      }));
      const sorted = [...notifs, ...anns, ...msgs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(sorted);
      return sorted;
    });
  }, [isAnnouncementVisible]);

  // Lightweight fetch — only retrieves the unread count for the badge, no full list payload.
  const fetchUnreadCounts = useCallback(async () => {
    const [notifRes, annRes, msgRes] = await Promise.allSettled([
      api.get('/notifications/notifications/unread-count/'),
      api.get('/notifications/announcements/unread-count/'),
      api.get('/notifications/messages/unread-count/'),
    ]);
    const n = notifRes.status === 'fulfilled' ? (notifRes.value.data.count ?? 0) : 0;
    const a = annRes.status === 'fulfilled' ? (annRes.value.data.count ?? 0) : 0;
    const m = msgRes.status === 'fulfilled' ? (msgRes.value.data.count ?? 0) : 0;
    setUnreadCount(n + a + m);
  }, []);

  // Mark all items as read on the server (persists across logins/devices).
  const markAllRead = useCallback(async () => {
    const results = await Promise.allSettled([
      api.post('/notifications/notifications/mark-all-read/'),
      api.post('/notifications/messages/mark-all-read/'),
      api.post('/notifications/announcements/mark-all-read/'),
    ]);
    return results.every((r) => r.status === 'fulfilled');
  }, []);

  // Fetch lightweight unread counts on mount + poll so the badge stays accurate
  // without transferring full notification payloads on every tick.
  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(() => {
      if (!openRef.current) fetchUnreadCounts();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // Clicking the bell opens the dropdown; everything shown there gets marked
  // read (server-persisted) and the badge clears. Closing re-fetches only
  // unread items, so read ones disappear from the list for good.
  const handleBellClick = async () => {
    const next = !open;
    openRef.current = next;
    setOpen(next);
    if (next) {
      setLoading(true);
      const fresh = await fetchItems();
      await markAllRead();
      setItems(
        fresh.map((n): NotificationItem => {
          if (n.type === 'announcement') return { ...n, data: { ...n.data, is_read: true } };
          if (n.type === 'message') return { ...n, data: { ...n.data, is_read: true } };
          return { ...n, data: { ...n.data, is_read: true } };
        }),
      );
      setLoading(false);
      setUnreadCount(0);
    } else {
      fetchUnreadCounts();
    }
  };

  // Close on outside click (keeps bell/dropdown refs in sync)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && openRef.current) {
        openRef.current = false;
        setOpen(false);
        fetchUnreadCounts();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fetchUnreadCounts]);

  const markNotificationRead = async (notifId: string) => {
    try {
      await api.patch(`/notifications/notifications/${notifId}/`, { is_read: true });
      setItems((prev) => prev.filter((n) => !(n.type === 'notification' && n.data.id === notifId)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const markMessageRead = async (msgId: string) => {
    try {
      await api.patch(`/notifications/messages/${msgId}/`, { is_read: true });
      setItems((prev) => prev.filter((n) => !(n.type === 'message' && n.data.id === msgId)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const markAnnouncementRead = async (annId: string) => {
    try {
      await api.post('/notifications/announcements/mark-all-read/');
      setItems((prev) => prev.filter((n) => !(n.type === 'announcement' && n.data.id === annId)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleItemClick = (item: NotificationItem) => {
    openRef.current = false;
    setOpen(false);

    if (item.type === 'notification') {
      if (!item.data.is_read) markNotificationRead(item.data.id);
      if (item.data.link) {
        navigate(item.data.link);
        return;
      }
    } else if (item.type === 'message') {
      if (!item.data.is_read) markMessageRead(item.data.id);
    } else {
      if (!item.data.is_read) markAnnouncementRead(item.data.id);
    }
    setSelectedItem(item);
  };

  const handleViewAll = async () => {
    openRef.current = false;
    setOpen(false);
    await markAllRead();
    setItems([]);
    setUnreadCount(0);
    const activeRoles = new Set(rolesRef.current.map((r) => r.role));
    if (activeRoles.has('admin') || activeRoles.has('super_admin')) {
      navigate('/admin/community/communications');
    } else if (activeRoles.has('teacher')) {
      navigate('/teacher');
    } else if (activeRoles.has('parent')) {
      navigate('/parent');
    } else {
      navigate('/');
    }
  };

  const timeAgo = (ts: string) => {
    try {
      const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (seconds < 60) return t('just now');
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return t('{{minutes}}m ago', { minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('{{hours}}h ago', { hours });
      const days = Math.floor(hours / 24);
      if (days < 7) return t('{{days}}d ago', { days });
      return new Date(ts).toLocaleDateString();
    } catch {
      return '';
    }
  };

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'fee_invoice':
        return 'receipt_long';
      case 'payment':
        return 'payments';
      case 'fee_reminder':
        return 'notification_important';
      case 'marks':
        return 'fact_check';
      case 'announcement':
        return 'campaign';
      default:
        return 'info';
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'payment':
        return 'bg-emerald-50 text-emerald-600';
      case 'fee_reminder':
        return 'bg-error/10 text-error';
      case 'fee_invoice':
        return 'bg-amber-50 text-amber-600';
      case 'marks':
        return 'bg-violet-50 text-violet-600';
      default:
        return 'bg-blue-50 text-blue-600';
    }
  };

  const itemMeta = (item: NotificationItem) => {
    if (item.type === 'notification') return item.data.category_display;
    if (item.type === 'announcement') return t('By {{name}} • {{audience}}', { name: item.data.created_by_name, audience: item.data.audience_display });
    return t('From {{name}}', { name: item.data.sender_name });
  };

  const itemTitle = (item: NotificationItem) => {
    if (item.type === 'announcement') return item.data.title;
    if (item.type === 'message') return item.data.subject || t('Direct Message');
    return item.data.title;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        title={t('Notifications')}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{t('Notifications')}</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-error/10 text-error font-semibold px-2 py-0.5 rounded-full">
                {t('{{count}} unread', { count: unreadCount })}
              </span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined animate-spin text-slate-300 text-3xl">sync</span>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-slate-300 text-4xl mb-2">notifications_off</span>
                <p className="text-sm text-slate-400">{t('No notifications yet')}</p>
              </div>
            )}

            {!loading &&
              items.map((item) => {
                const isUnread = !item.data.is_read;
                const isUrgent = item.type === 'announcement' && item.data.is_urgent;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors ${
                      isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          item.type === 'notification'
                            ? categoryColor(item.data.category)
                            : isUrgent
                            ? 'bg-error/10 text-error'
                            : item.type === 'announcement'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {item.type === 'notification'
                            ? categoryIcon(item.data.category)
                            : isUrgent
                            ? 'priority_high'
                            : item.type === 'announcement'
                            ? 'campaign'
                            : 'mail'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <p className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {itemTitle(item)}
                          </p>
                          {isUnread && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{itemMeta(item)}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{timeAgo(item.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <button
                onClick={handleViewAll}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t('View all notifications')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header banner */}
            <div className={`p-6 text-white bg-gradient-to-br ${
              selectedItem.type === 'notification' && selectedItem.data.category === 'fee_reminder'
                ? 'from-error to-error/80'
                : selectedItem.type === 'announcement' && selectedItem.data.is_urgent
                ? 'from-error to-error/80'
                : selectedItem.type === 'notification'
                ? 'from-blue-600 to-blue-500'
                : selectedItem.type === 'announcement'
                ? 'from-blue-600 to-blue-500'
                : 'from-emerald-600 to-emerald-500'
            }`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">
                    {selectedItem.type === 'notification'
                      ? categoryIcon(selectedItem.data.category)
                      : selectedItem.type === 'announcement' && selectedItem.data.is_urgent
                      ? 'priority_high'
                      : selectedItem.type === 'announcement'
                      ? 'campaign'
                      : 'mail'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-md">
                    {selectedItem.type === 'notification'
                      ? selectedItem.data.category_display
                      : selectedItem.type === 'announcement'
                      ? selectedItem.data.is_urgent
                        ? t('Urgent Announcement')
                        : t('Announcement')
                      : t('Direct Message')}
                  </span>
                  <h2 className="text-xl font-bold tracking-tight mt-1 leading-snug">
                    {itemTitle(selectedItem)}
                  </h2>
                </div>
              </div>
            </div>

            {/* Metadata & Body */}
            <div className="p-6">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="font-semibold text-slate-700">
                    {selectedItem.type === 'announcement'
                      ? t('Author: {{name}}', { name: selectedItem.data.created_by_name })
                      : selectedItem.type === 'message'
                      ? t('From: {{name}}', { name: selectedItem.data.sender_name })
                      : 'School OS'}
                  </span>
                  {selectedItem.type === 'announcement' && (
                    <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                      {selectedItem.data.audience_display}
                    </span>
                  )}
                </div>
                <span>{new Date(selectedItem.timestamp).toLocaleString()}</span>
              </div>

              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm text-slate-600 leading-relaxed font-sans bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {selectedItem.data.body || (selectedItem.type === 'message' ? selectedItem.data.body : '')}
              </div>

              {/* Close Action */}
              <div className="mt-6 flex justify-end gap-2">
                {selectedItem.type === 'notification' && selectedItem.data.link && (
                  <button
                    onClick={() => {
                      const link = selectedItem.data.link;
                      setSelectedItem(null);
                      navigate(link);
                    }}
                    className="px-5 py-2.5 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all text-sm"
                  >
                    {t('View details')}
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all text-sm"
                >
                  {t('Dismiss')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
