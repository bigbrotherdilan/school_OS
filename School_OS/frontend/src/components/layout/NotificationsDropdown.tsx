import { useState, useEffect, useRef, useCallback } from 'react';
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
  is_read?: boolean;
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
  const navigate = useNavigate();
  const { roles } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  const unreadMessages = items.filter((n) => n.type === 'message' && !n.data.is_read).length;
  const unreadNotifications = items.filter((n) => n.type === 'notification' && !n.data.is_read).length;
  const unreadAnnouncements = items.filter((n) => n.type === 'announcement' && !n.data.is_read).length;
  const badgeCount = unreadMessages + unreadNotifications + unreadAnnouncements;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchItems = useCallback(() => {
    return Promise.all([
      api.get('/notifications/notifications/?limit=10').catch(() => ({ data: { results: [] } })),
      api.get('/notifications/announcements/?published=true&ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
      api.get('/notifications/messages/?ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
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

  // Fetch on mount + poll so the badge reappears only for genuinely new items
  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchItems]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [open, fetchItems]);

  // Mark all notifications, messages and announcements as read for this user.
  // Announcement read state is tracked server-side so it persists across
  // log-ins, log-outs and page reloads for the current user.
  const markAllAsRead = useCallback(() => {
    try {
      api.post('/notifications/announcements/mark-all-read/');
      api.post('/notifications/notifications/mark-all-read/');
      api.post('/notifications/messages/mark-all-read/');
    } catch {
      /* silent */
    }
    setItems((prev) =>
      prev.map((n) => {
        if (n.type === 'announcement') return { ...n, data: { ...n.data, is_read: true } };
        if (n.type === 'notification') return { ...n, data: { ...n.data, is_read: true } };
        if (n.type === 'message') return { ...n, data: { ...n.data, is_read: true } };
        return n;
      })
    );
  }, []);

  // Opening the bell only toggles the dropdown. Read state is handled by
  // individual item clicks or the "Mark all as read" button in the header.
  const handleBellClick = () => {
    setOpen((prev) => !prev);
  };

  const markMessageRead = async (msgId: string) => {
    try {
      await api.patch(`/notifications/messages/${msgId}/`, { is_read: true });
      setItems((prev) =>
        prev.map((n) =>
          n.type === 'message' && n.data.id === msgId ? { ...n, data: { ...n.data, is_read: true } } : n
        )
      );
    } catch { /* silent */ }
  };

  const markNotificationRead = async (notifId: string) => {
    try {
      await api.patch(`/notifications/notifications/${notifId}/`, { is_read: true });
      setItems((prev) =>
        prev.map((n) =>
          n.type === 'notification' && n.data.id === notifId ? { ...n, data: { ...n.data, is_read: true } } : n
        )
      );
    } catch { /* silent */ }
  };

  const markAnnouncementRead = async (annId: string) => {
    try {
      await api.post(`/notifications/announcements/${annId}/read/`);
      setItems((prev) =>
        prev.map((n) =>
          n.type === 'announcement' && n.data.id === annId ? { ...n, data: { ...n.data, is_read: true } } : n
        )
      );
    } catch { /* silent */ }
  };

  const handleItemClick = (item: NotificationItem) => {
    setOpen(false);

    if (item.type === 'notification') {
      if (!item.data.is_read) markNotificationRead(item.data.id);
      // Navigate when the notification carries a destination link
      if (item.data.link) {
        navigate(item.data.link);
        return;
      }
    } else if (item.type === 'message') {
      if (!item.data.is_read) markMessageRead(item.data.id);
    } else if (item.type === 'announcement') {
      if (!item.data.is_read) markAnnouncementRead(item.data.id);
    }
    setSelectedItem(item);
  };

  const handleViewAll = () => {
    setOpen(false);
    markAllAsRead();

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
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
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
    if (item.type === 'announcement') return `By ${item.data.created_by_name} • ${item.data.audience_display}`;
    return `From ${item.data.sender_name}`;
  };

  const itemTitle = (item: NotificationItem) => {
    if (item.type === 'announcement') return item.data.title;
    if (item.type === 'message') return item.data.subject || 'Direct Message';
    return item.data.title;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        title="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {badgeCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Notifications</h3>
              {badgeCount > 0 && (
                <span className="text-xs bg-error/10 text-error font-semibold px-2 py-0.5 rounded-full">
                  {badgeCount} unread
                </span>
              )}
            </div>
            {badgeCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-sm leading-none">done_all</span>
                Mark all as read
              </button>
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
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            )}

            {!loading &&
              items.map((item) => {
                const isUnread =
                  item.type === 'message' ? !item.data.is_read :
                  item.type === 'notification' ? !item.data.is_read :
                  item.type === 'announcement' ? !item.data.is_read :
                  false;
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
                View all notifications
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
                        ? 'Urgent Announcement'
                        : 'Announcement'
                      : 'Direct Message'}
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
                      ? `Author: ${selectedItem.data.created_by_name}`
                      : selectedItem.type === 'message'
                      ? `From: ${selectedItem.data.sender_name}`
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
                    View details
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
