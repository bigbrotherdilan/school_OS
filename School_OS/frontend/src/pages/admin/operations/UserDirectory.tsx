import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import {
  Search, MoreVertical, Mail, ShieldCheck, ShieldX, Loader2, KeyRound,
  UserPen, Trash2, AlertCircle, Users, GraduationCap, Banknote, UserCircle,
  Copy, Check, MessageCircle, Link2, Filter, UserPlus, Send
} from 'lucide-react';
import CredentialsCard from '../../../components/ui/CredentialsCard';

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  super_admin: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  admin: { label: 'Administrator', icon: ShieldCheck, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  bursar: { label: 'Bursar', icon: Banknote, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  teacher: { label: 'Teacher', icon: GraduationCap, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  parent: { label: 'Parent', icon: Users, color: 'bg-red-100 text-red-700 border-red-200' },
  student: { label: 'Student', icon: UserCircle, color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export default function UserDirectory() {
  const navigate = useNavigate();
  const { t } = useTranslation('adminStaffOps');
  const { addToast } = useToastStore();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<any | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'teacher', first_name: '', last_name: '' });
  const [isInviting, setIsInviting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users/');
      setUsers(response.data.results || response.data);
    } catch {
      addToast(t('Failed to fetch user directory.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResetPassword = async (userId: string, userName: string) => {
    try {
      const res = await api.post(`/users/${userId}/reset-password/`);
      setResetResult(res.data);
      addToast(t('Password reset for {{name}}.', { name: userName }), 'success');
    } catch (error: any) {
      addToast(error.response?.data?.detail || t('Failed to reset password.'), 'error');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean, userName: string) => {
    try {
      await api.patch(`/users/${userId}/`, { is_active: !isActive });
      addToast(t('{{name}} {{status}}.', { name: userName, status: isActive ? t('deactivated') : t('activated') }), 'success');
      fetchUsers();
    } catch {
      addToast(t('Failed to update user status.'), 'error');
    }
  };

  const copyCredentials = async (user: any) => {
    const role = user.roles?.[0]?.role || 'admin';
    const loginUrl = `${window.location.origin}/login/${role === 'super_admin' || role === 'admin' ? 'admin' : role}`;
    const text = t('School OS Login Credentials\n\nName: {{name}}\nEmail: {{email}}\nLogin: {{login}}\n\nContact the school admin for your password.', { name: user.full_name, email: user.email, login: loginUrl });
    try {
      await navigator.clipboard.writeText(text);
      addToast(t('Credentials copied to clipboard.'), 'success');
    } catch {
      addToast(t('Failed to copy.'), 'error');
    }
  };

  const shareViaWhatsApp = (user: any) => {
    const role = user.roles?.[0]?.role || 'admin';
    const loginUrl = `${window.location.origin}/login/${role === 'super_admin' || role === 'admin' ? 'admin' : role}`;
    const text = encodeURIComponent(t('School OS Login\n\nName: {{name}}\nEmail: {{email}}\nLogin: {{login}}\n\nContact the school admin for your password.', { name: user.full_name, email: user.email, login: loginUrl }));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const res = await api.post('/auth/invite/', inviteForm);
      setInviteResult(res.data);
      addToast(t('Invitation sent to {{email}}.', { email: inviteForm.email }), 'success');
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'teacher', first_name: '', last_name: '' });
    } catch (error: any) {
      addToast(error.response?.data?.detail || t('Failed to create invitation.'), 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.roles?.some((r: any) => r.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.roles?.some((r: any) => r.role === 'admin' || r.role === 'super_admin')).length,
    teachers: users.filter(u => u.roles?.some((r: any) => r.role === 'teacher')).length,
    parents: users.filter(u => u.roles?.some((r: any) => r.role === 'parent')).length,
  };

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-2">{t('User Management')}</span>
          <h1 className="text-4xl font-black text-on-surface tracking-tight">{t('User Directory')}</h1>
          <p className="text-on-surface-variant mt-2 text-lg font-medium max-w-2xl leading-relaxed">
            {t('All user accounts across your school — administrators, teachers, bursars, and parents.')}
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-black rounded-2xl hover:shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest bg-gradient-to-br from-primary to-blue-700 shadow-lg shadow-primary/20"
        >
          <Send className="w-4 h-4" /> {t('Invite User')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: <Users className="w-4 h-4" /> },
          { label: 'Admins', value: stats.admins, icon: <ShieldCheck className="w-4 h-4" /> },
          { label: 'Teachers', value: stats.teachers, icon: <GraduationCap className="w-4 h-4" /> },
          { label: 'Parents', value: stats.parents, icon: <Users className="w-4 h-4" /> },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">{stat.icon}</div>
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t(stat.label)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder={t('Search by name or email...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-4 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all w-96 shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'admin', 'teacher', 'bursar', 'parent'] as const).map(tab => (
            <button key={tab} onClick={() => setRoleFilter(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${roleFilter === tab ? 'bg-primary text-white shadow-lg' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
              {tab === 'all' ? t('All Roles') : t(ROLE_LABELS[tab]?.label || tab)}
            </button>
          ))}
        </div>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">{t('Loading Users...')}</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-40 flex flex-col items-center justify-center text-center space-y-6 grayscale opacity-40">
          <Users className="w-20 h-20" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold">{t('No users found')}</h3>
            <p className="text-sm font-medium">{t('Try adjusting your search or filters.')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-surface-container-low border-b border-outline-variant/10 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <div className="col-span-4">{t('User')}</div>
            <div className="col-span-2">{t('Role')}</div>
            <div className="col-span-2">{t('Email')}</div>
            <div className="col-span-1">{t('Status')}</div>
            <div className="col-span-3 text-right">{t('Actions')}</div>
          </div>

          {/* Table Rows */}
          {filteredUsers.map((user) => {
            const primaryRole = user.roles?.[0]?.role || 'admin';
            const roleInfo = ROLE_LABELS[primaryRole] || ROLE_LABELS.admin;
            const RoleIcon = roleInfo.icon;

            return (
              <div key={user.id} className="grid grid-cols-12 gap-4 px-8 py-5 border-b border-outline-variant/5 hover:bg-surface-container-low/50 transition-colors items-center">
                <div className="col-span-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-sm shrink-0">
                    {user.full_name?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-on-surface truncate">{user.full_name}</p>
                    <p className="text-[10px] font-semibold text-on-surface-variant truncate">{user.email}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${roleInfo.color}`}>
                    <RoleIcon className="w-3 h-3" /> {t(roleInfo.label)}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium text-on-surface-variant truncate">{user.email}</p>
                </div>
                <div className="col-span-1">
                  {user.is_active !== false ? (
                    <span className="px-2 py-1 bg-secondary/10 text-secondary text-[9px] font-black rounded-full uppercase tracking-widest">{t('Active')}</span>
                  ) : (
                    <span className="px-2 py-1 bg-error/10 text-error text-[9px] font-black rounded-full uppercase tracking-widest">{t('Inactive')}</span>
                  )}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => copyCredentials(user)}
                    className="p-2.5 bg-surface-container-high hover:bg-primary/10 hover:text-primary rounded-xl transition-all active:scale-95"
                    title={t('Copy Credentials')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => shareViaWhatsApp(user)}
                    className="p-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl transition-all active:scale-95"
                    title={t('Share via WhatsApp')}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <div className="relative" ref={openMenuId === user.id ? menuRef : undefined}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                      className="p-2.5 hover:bg-surface-container-high rounded-xl transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                    </button>
                    {openMenuId === user.id && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/15 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <button onClick={() => { setOpenMenuId(null); handleResetPassword(user.id, user.full_name); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left">
                          <KeyRound className="w-4 h-4 text-amber-600" /> {t('Reset Password')}
                        </button>
                        <div className="border-t border-outline-variant/10 my-1" />
                        <button onClick={() => { setOpenMenuId(null); handleToggleActive(user.id, user.is_active !== false, user.full_name); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left ${user.is_active !== false ? 'text-error' : 'text-secondary'}`}>
                          {user.is_active !== false ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          {user.is_active !== false ? t('Deactivate') : t('Activate')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setResetResult(null)}>
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-on-surface mb-1">{t('Password Reset')}</h3>
                <p className="text-sm text-on-surface-variant">{t('New temporary password for {{name}}', { name: resetResult.user.full_name })}</p>
              </div>
              {resetResult.temporary_password && (
                <div className="text-left">
                  <CredentialsCard
                    email={resetResult.user.email}
                    password={resetResult.temporary_password}
                    label={t('New Temporary Password')}
                  />
                </div>
              )}
              <button onClick={() => setResetResult(null)} className="w-full py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">
                {t('Done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-black text-on-surface mb-1">{t('Invite User')}</h3>
              <p className="text-sm text-on-surface-variant">{t('Send a shareable link for the user to set their own password.')}</p>
            </div>
            <form onSubmit={handleInvite} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('First Name')}</label>
                  <input type="text" value={inviteForm.first_name} onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder={t('Optional')} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Last Name')}</label>
                  <input type="text" value={inviteForm.last_name} onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder={t('Optional')} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Email Address')}</label>
                <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" placeholder="user@email.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Role')}</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all">
                  <option value="teacher">{t('Teacher')}</option>
                  <option value="bursar">{t('Bursar')}</option>
                  <option value="parent">{t('Parent')}</option>
                  <option value="admin">{t('Administrator')}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-3 px-4 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">
                  {t('Cancel')}
                </button>
                <button type="submit" disabled={isInviting || !inviteForm.email} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all disabled:opacity-50">
                  {isInviting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <Send className="w-4 h-4" />}
                  {isInviting ? t('Sending...') : t('Send Invite')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Result Modal */}
      {inviteResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setInviteResult(null)}>
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-on-surface mb-1">{t('Invitation Created')}</h3>
                <p className="text-sm text-on-surface-variant">{t('Share this link with the user to set their password.')}</p>
              </div>
              {inviteResult.invitation?.invite_link && (
                <div className="bg-white border border-outline-variant/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <code className="text-xs font-mono text-on-surface break-all">{inviteResult.invitation.invite_link}</code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteResult.invitation.invite_link);
                      addToast(t('Invite link copied!'), 'success');
                    }}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" /> {t('Copy')}
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const link = inviteResult.invitation?.invite_link || '';
                    const text = encodeURIComponent(t("You're invited to join School OS!\n\nClick the link to set your password:\n{{link}}", { link }));
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#25D366] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#128C7E] active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> {t('Share via WhatsApp')}
                </button>
                <button onClick={() => setInviteResult(null)} className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">
                  {t('Done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-12 border-t border-outline-variant/10 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.5em] mb-4">{t('User Management by School OS')}</p>
        <div className="w-12 h-1 bg-primary/20 rounded-full mx-auto"></div>
      </footer>
    </div>
  );
}