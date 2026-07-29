import { useState, useEffect, useRef } from 'react';
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

type NotificationItem =
  | { type: 'announcement'; data: Announcement; id: string; timestamp: string }
  | { type: 'message'; data: DirectMessage; id: string; timestamp: string };

export default function NotificationsDropdown() {
  const navigate = useNavigate();
  const { user, roles } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load read announcements from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(`read_announcements_${user.id}`);
        if (stored) {
          setReadAnnouncementIds(JSON.parse(stored));
        }
      } catch {
        /* silent */
      }
    }
  }, [user?.id]);

  const unreadMessages = items.filter((n) => n.type === 'message' && !n.data.is_read).length;
  const unreadAnnouncements = items.filter((n) => n.type === 'announcement' && !readAnnouncementIds.includes(n.data.id)).length;
  const badgeCount = unreadMessages + unreadAnnouncements;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchItems = () => {
    return Promise.all([
      api.get('/notifications/announcements/?published=true&ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
      api.get('/notifications/messages/?ordering=-created_at&limit=10').catch(() => ({ data: { results: [] } })),
    ]).then(([annRes, msgRes]) => {
      const anns: NotificationItem[] = (annRes.data.results || annRes.data || []).map((a: Announcement) => ({
        type: 'announcement' as const,
        data: a,
        id: a.id,
        timestamp: a.created_at,
      }));
      const msgs: NotificationItem[] = (msgRes.data.results || msgRes.data || []).map((m: DirectMessage) => ({
        type: 'message' as const,
        data: m,
        id: m.id,
        timestamp: m.created_at,
      }));
      const sorted = [...anns, ...msgs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(sorted);
      return sorted;
    });
  };

  // Fetch badge count on mount
  useEffect(() => {
    fetchItems();
  }, []);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [open]);

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

  const handleItemClick = (item: NotificationItem) => {
    setSelectedItem(item);
    setOpen(false);

    if (item.type === 'message') {
      if (!item.data.is_read) {
        markMessageRead(item.data.id);
      }
    } else {
      if (!readAnnouncementIds.includes(item.data.id)) {
        const nextIds = [...readAnnouncementIds, item.data.id];
        setReadAnnouncementIds(nextIds);
        if (user?.id) {
          localStorage.setItem(`read_announcements_${user.id}`, JSON.stringify(nextIds));
        }
      }
    }
  };

  const handleViewAll = async () => {
    setOpen(false);

    // 1. Mark all current announcements as read
    const announcementIds = items
      .filter((n) => n.type === 'announcement')
      .map((n) => n.id);

    if (announcementIds.length > 0) {
      const nextIds = Array.from(new Set([...readAnnouncementIds, ...announcementIds]));
      setReadAnnouncementIds(nextIds);
      if (user?.id) {
        localStorage.setItem(`read_announcements_${user.id}`, JSON.stringify(nextIds));
      }
    }

    // 2. Mark all messages as read via backend endpoint
    try {
      await api.post('/notifications/messages/mark-all-read/');
      // Update local message read status so badge count drops instantly
      setItems((prev) =>
        prev.map((n) =>
          n.type === 'message' ? { ...n, data: { ...n.data, is_read: true } } : n
        )
      );
    } catch {
      /* silent */
    }

    // 3. Navigate based on role
    const hasAdminRole = roles?.some((r) => r.role === 'admin' || r.role === 'super_admin');
    const hasTeacherRole = roles?.some((r) => r.role === 'teacher');
    const hasParentRole = roles?.some((r) => r.role === 'parent');

    if (hasAdminRole) {
      navigate('/admin/community/communications');
    } else if (hasTeacherRole) {
      navigate('/teacher');
    } else if (hasParentRole) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
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
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            {badgeCount > 0 && (
              <span className="text-xs bg-error/10 text-error font-semibold px-2 py-0.5 rounded-full">
                {badgeCount} unread
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
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            )}

            {!loading &&
              items.map((item) => {
                const isUnread = item.type === 'message' ? !item.data.is_read : !readAnnouncementIds.includes(item.data.id);
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
                          isUrgent
                            ? 'bg-error/10 text-error'
                            : item.type === 'announcement'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {isUrgent ? 'priority_high' : item.type === 'announcement' ? 'campaign' : 'mail'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <p className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {item.type === 'announcement' ? item.data.title : item.data.subject || 'Direct Message'}
                          </p>
                          {isUnread && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {item.type === 'announcement'
                            ? `By ${item.data.created_by_name} • ${item.data.audience_display}`
                            : `From ${item.data.sender_name}`}
                        </p>
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
              selectedItem.type === 'announcement' && selectedItem.data.is_urgent
                ? 'from-error to-error/80'
                : selectedItem.type === 'announcement'
                ? 'from-blue-600 to-blue-500'
                : 'from-emerald-600 to-emerald-500'
            }`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">
                    {selectedItem.type === 'announcement' && selectedItem.data.is_urgent
                      ? 'priority_high'
                      : selectedItem.type === 'announcement'
                      ? 'campaign'
                      : 'mail'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-md">
                    {selectedItem.type === 'announcement'
                      ? selectedItem.data.is_urgent
                        ? 'Urgent Announcement'
                        : 'Announcement'
                      : 'Direct Message'}
                  </span>
                  <h2 className="text-xl font-bold tracking-tight mt-1 leading-snug">
                    {selectedItem.type === 'announcement' ? selectedItem.data.title : selectedItem.data.subject || 'No Subject'}
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
                      : `From: ${selectedItem.data.sender_name}`}
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
                {selectedItem.type === 'announcement' ? selectedItem.data.body : selectedItem.data.body}
              </div>

              {/* Close Action */}
              <div className="mt-6 flex justify-end">
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
