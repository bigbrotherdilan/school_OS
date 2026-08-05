import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { 
  Search, MoreVertical, Mail, BadgeCheck, UserPlus, Upload,
  GraduationCap, ChevronRight, ShieldCheck, ShieldX, Loader2, Settings2,
  Star, Globe, Briefcase, Languages, BookOpen, MapPin, KeyRound
} from 'lucide-react';
import TeachingAssignmentModal from '../../../components/admin/staff/TeachingAssignmentModal';

export default function TeacherDirectory() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [profileTeacher, setProfileTeacher] = useState<any | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'public'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchTeachers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/staff/teachers/');
      setTeachers(response.data.results || response.data);
    } catch (error) {
      addToast('Failed to fetch teacher directory.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleStatus = async (teacherId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/staff/teachers/${teacherId}/`, { is_active: !currentStatus });
      addToast(`Teacher status updated to ${!currentStatus ? 'Active' : 'Inactive'}.`, 'success');
      fetchTeachers();
    } catch (error) {
      addToast('Failed to update teacher status.', 'error');
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    try {
      const res = await api.post(`/users/${userId}/reset-password/`);
      setResetResult(res.data);
      addToast(`Password reset for ${userName}.`, 'success');
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Failed to reset password.';
      addToast(detail, 'error');
    }
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.user_details?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterTab === 'active') return matchesSearch && t.is_active;
    if (filterTab === 'public') return matchesSearch && t.public_profile;
    return matchesSearch;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.is_active).length,
    public: teachers.filter(t => t.public_profile).length,
    avgRating: teachers.length > 0 ? (teachers.reduce((sum, t) => sum + (t.average_rating || 0), 0) / teachers.length).toFixed(1) : '0',
  };

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-2">Staff Records</span>
          <h1 className="text-4xl font-black text-on-surface tracking-tight">Staff Directory</h1>
          <p className="text-on-surface-variant mt-2 text-lg font-medium max-w-2xl leading-relaxed">
            Manage teacher credentials, assignments, marketplace profiles, and performance.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/operations/faculty/import')} className="flex items-center gap-2 px-6 py-4 bg-surface-container-high text-on-surface font-black rounded-2xl hover:bg-surface-container-highest transition-all active:scale-95 text-xs uppercase tracking-widest">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={() => navigate('/admin/operations/faculty/new')} className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-black rounded-2xl hover:shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest bg-gradient-to-br from-primary to-blue-700 shadow-lg shadow-primary/20">
            <UserPlus className="w-4 h-4" /> Onboard Teacher
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: stats.total, icon: <span className="material-symbols-outlined text-lg">group</span> },
          { label: 'Active', value: stats.active, icon: <ShieldCheck className="w-4 h-4" /> },
          { label: 'Public Profiles', value: stats.public, icon: <Globe className="w-4 h-4" /> },
          { label: 'Avg Rating', value: stats.avgRating, icon: <Star className="w-4 h-4 text-amber-500" /> },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">{stat.icon}</div>
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name, ID, or department..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-4 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all w-96 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'public'] as const).map(tab => (
            <button key={tab} onClick={() => setFilterTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterTab === tab ? 'bg-primary text-white shadow-lg' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
              {tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Marketplace'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Listing */}
      {isLoading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">Synchronizing Global Directory...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="py-40 flex flex-col items-center justify-center text-center space-y-6 grayscale opacity-40">
           <span className="material-symbols-outlined text-[80px]">person_search</span>
           <div className="space-y-2">
             <h3 className="text-xl font-bold">No teachers found</h3>
             <p className="text-sm font-medium">Build your faculty. Add your first teacher to get started.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-sm overflow-hidden group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col cursor-pointer" onClick={() => setProfileTeacher(teacher)}>
              
              {/* Profile Card Header */}
              <div className="p-8 pb-6 flex justify-between items-start">
                <div className="flex gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    {teacher.user_details?.full_name?.[0] || 'T'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-on-surface group-hover:text-primary transition-colors duration-300 truncate">{teacher.user_details?.full_name}</h3>
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mt-1"># {teacher.employee_id}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {teacher.is_active ? (
                        <span className="px-3 py-1 bg-secondary/10 text-secondary text-[9px] font-black rounded-full uppercase tracking-widest border border-secondary/20 flex items-center gap-1.5 shadow-sm">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-error/10 text-error text-[9px] font-black rounded-full uppercase tracking-widest border border-error/20 flex items-center gap-1.5 shadow-sm">
                          <ShieldX className="w-3 h-3" /> Deactivated
                        </span>
                      )}
                      {teacher.public_profile && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black rounded-full uppercase tracking-widest border border-primary/20 flex items-center gap-1.5 shadow-sm">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative" ref={openMenuId === teacher.id ? menuRef : undefined} onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === teacher.id ? null : teacher.id)}
                    className="p-2 hover:bg-surface-container-high rounded-xl transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-on-surface-variant" />
                  </button>
                  {openMenuId === teacher.id && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/15 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <button onClick={() => { setOpenMenuId(null); setProfileTeacher(teacher); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left">
                        <span className="material-symbols-outlined text-lg text-primary">person</span> View Profile
                      </button>
                      <button onClick={() => { setOpenMenuId(null); setSelectedTeacher(teacher); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left">
                        <Settings2 className="w-4 h-4 text-primary" /> Manage Assignment
                      </button>
                      <button onClick={() => { setOpenMenuId(null); addToast(`Opening mail composer for ${teacher.user_details?.email}...`, 'info'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left">
                        <Mail className="w-4 h-4 text-primary" /> Send Email
                      </button>
                      <button onClick={() => { setOpenMenuId(null); handleResetPassword(teacher.user_details?.id, teacher.user_details?.full_name); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left">
                        <KeyRound className="w-4 h-4 text-amber-600" /> Reset Password
                      </button>
                      <div className="border-t border-outline-variant/10 my-1" />
                      <button onClick={() => { setOpenMenuId(null); handleToggleStatus(teacher.id, teacher.is_active); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-container-low transition-colors text-left ${teacher.is_active ? 'text-error' : 'text-secondary'}`}>
                        {teacher.is_active ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        {teacher.is_active ? 'Deactivate' : 'Restore'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra Info */}
              <div className="px-8 space-y-3">
                {teacher.department && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Briefcase className="w-3 h-3" />
                    <span className="font-medium">{teacher.department}</span>
                  </div>
                )}
                {teacher.qualification && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <BadgeCheck className="w-3 h-3" />
                    <span className="font-medium">{teacher.qualification}</span>
                  </div>
                )}
                {teacher.average_rating > 0 && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="font-bold">{teacher.average_rating.toFixed(1)}</span>
                    <span className="text-on-surface-variant/60">({teacher.total_reviews} reviews)</span>
                  </div>
                )}
                {teacher.subjects_taught && teacher.subjects_taught.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Languages className="w-3 h-3" />
                    <span className="font-medium truncate">{teacher.subjects_taught.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Assignment Overview */}
              <div className="px-8 mt-4 flex-1">
                <div className="bg-surface-container-low/50 rounded-2xl p-5 border border-outline-variant/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] block">Strategic Assignment</span>
                    <button 
                      onClick={() => setSelectedTeacher(teacher)}
                      className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                    >
                      <Settings2 className="w-3 h-3" /> Manage
                    </button>
                  </div>
                  {teacher.assignments && teacher.assignments.length > 0 ? (
                    <div className="space-y-4">
                      {teacher.assignments.map((assignment: any) => (
                        <div key={assignment.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <GraduationCap className="w-3 h-3 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-on-surface">{assignment.subject_name}</span>
                          </div>
                          <span className="text-[10px] font-black text-primary px-3 py-1 bg-primary/5 rounded-lg border border-primary/10">Class: {assignment.class_name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-[10px] font-black text-on-surface-variant opacity-40 uppercase tracking-widest italic">No active assignments</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-8 pt-6 mt-4 border-t border-outline-variant/5 flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    onClick={() => addToast(`Opening mail composer for ${teacher.user_details?.email}...`, 'info')}
                    className="p-3 bg-surface-container-high hover:bg-primary/10 hover:text-primary rounded-xl transition-all active:scale-95 group/icon"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => addToast(`Viewing full credentials for ${teacher.user_details?.full_name}...`, 'info')}
                    className="p-3 bg-surface-container-high hover:bg-primary/10 hover:text-primary rounded-xl transition-all active:scale-95"
                  >
                    <BadgeCheck className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => handleToggleStatus(teacher.id, teacher.is_active)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                    teacher.is_active 
                    ? 'bg-error text-white hover:shadow-lg hover:shadow-error/20' 
                    : 'bg-secondary text-white hover:shadow-lg hover:shadow-secondary/20'
                  }`}
                >
                  {teacher.is_active ? 'Deactivate' : 'Restore'}
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTeacher && (
        <TeachingAssignmentModal 
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
          onUpdate={fetchTeachers}
        />
      )}

      {profileTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setProfileTeacher(null)}>
          <div className="bg-surface-container-lowest rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-8 pb-6 flex justify-between items-start border-b border-outline-variant/10">
              <div className="flex gap-5">
                <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-3xl shadow-inner">
                  {profileTeacher.user_details?.full_name?.[0] || 'T'}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-on-surface">{profileTeacher.user_details?.full_name}</h2>
                  <p className="text-xs font-black text-on-surface-variant/50 uppercase tracking-widest mt-1">ID: {profileTeacher.employee_id}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {profileTeacher.is_active ? (
                      <span className="px-3 py-1 bg-secondary/10 text-secondary text-[9px] font-black rounded-full uppercase tracking-widest border border-secondary/20 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Active</span>
                    ) : (
                      <span className="px-3 py-1 bg-error/10 text-error text-[9px] font-black rounded-full uppercase tracking-widest border border-error/20 flex items-center gap-1.5"><ShieldX className="w-3 h-3" /> Deactivated</span>
                    )}
                    {profileTeacher.public_profile && (
                      <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black rounded-full uppercase tracking-widest border border-primary/20 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Public</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setProfileTeacher(null)} className="p-2 hover:bg-surface-container-high rounded-xl transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-8">
              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Email</p>
                    <p className="text-sm font-bold text-on-surface">{profileTeacher.user_details?.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Employment</p>
                    <p className="text-sm font-bold text-on-surface">{profileTeacher.employment_type_display || profileTeacher.employment_type}</p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {profileTeacher.bio && (
                <div>
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-2">Bio</p>
                  <p className="text-sm text-on-surface/80 leading-relaxed">{profileTeacher.bio}</p>
                </div>
              )}

              {/* Languages */}
              {profileTeacher.languages_spoken?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-2">Languages</p>
                  <div className="flex gap-2 flex-wrap">
                    {profileTeacher.languages_spoken.map((lang: string) => (
                      <span key={lang} className="px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/20 flex items-center gap-1.5">
                        <Languages className="w-3 h-3" /> {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Subjects */}
              {profileTeacher.subject_names?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-3">Subjects Taught</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profileTeacher.subject_names.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl hover:bg-primary/5 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-sm">{typeof s === 'string' ? s : s.name}</p>
                          {typeof s === 'object' && s.code && <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">{s.code}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classes */}
              {profileTeacher.class_names?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-3">Assigned Classes</p>
                  <div className="flex gap-2 flex-wrap">
                    {profileTeacher.class_names.map((c: any, i: number) => (
                      <span key={i} className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-bold rounded-full border border-secondary/20 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {typeof c === 'string' ? c : c.name || `${c.section_display || ''} ${c.level || ''}`.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container-low rounded-2xl">
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Max Weekly Hours</p>
                  <p className="text-lg font-black text-on-surface">{profileTeacher.max_weekly_hours || '—'}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-2xl">
                  <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${star <= Math.round(profileTeacher.avg_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-on-surface-variant/20'}`} />
                    ))}
                    <span className="text-xs font-bold text-on-surface-variant/50 ml-1">({profileTeacher.total_ratings || 0})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-8 pt-0 flex flex-wrap gap-3">
              <button onClick={() => { setProfileTeacher(null); setSelectedTeacher(profileTeacher); }} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                <Settings2 className="w-4 h-4" /> Manage Assignment
              </button>
              <button onClick={() => { setProfileTeacher(null); handleResetPassword(profileTeacher.user_details?.id, profileTeacher.user_details?.full_name); }} className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all active:scale-95 border border-amber-200">
                <KeyRound className="w-4 h-4" /> Reset Password
              </button>
              <button onClick={() => { setProfileTeacher(null); addToast(`Opening mail for ${profileTeacher.user_details?.email}...`, 'info'); }} className="flex items-center gap-2 px-6 py-3 bg-surface-container-high hover:bg-surface-container-highest rounded-xl font-bold text-sm transition-all active:scale-95">
                <Mail className="w-4 h-4" /> Send Email
              </button>
              <button onClick={() => { setProfileTeacher(null); handleToggleStatus(profileTeacher.id, profileTeacher.is_active); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${profileTeacher.is_active ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}>
                {profileTeacher.is_active ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {profileTeacher.is_active ? 'Deactivate' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setResetResult(null)}>
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-on-surface mb-1">Password Reset</h3>
                <p className="text-sm text-on-surface-variant">New temporary password for <span className="font-bold">{resetResult.user.full_name}</span></p>
              </div>
              <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/15">
                <p className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-2">Status</p>
                <p className="text-sm font-bold text-success">Password sent to {resetResult.user.email}</p>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                A temporary password has been sent to the teacher's email. They should change it after logging in.
              </p>
              <button onClick={() => setResetResult(null)} className="w-full py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-12 border-t border-outline-variant/10 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.5em] mb-4">Institutional Integrity Managed by School OS v2.4</p>
        <div className="w-12 h-1 bg-primary/20 rounded-full mx-auto"></div>
      </footer>
    </div>
  );
}
