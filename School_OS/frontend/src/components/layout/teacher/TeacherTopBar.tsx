import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useTeacherStore } from '../../../stores/teacherStore';
import PortalSwitcher from '../PortalSwitcher';
import NotificationsDropdown from '../NotificationsDropdown';
import LanguageSwitcher from '../../ui/LanguageSwitcher';

interface TeacherTopBarProps {
  onMenuClick: () => void;
  title?: string;
  activeClass?: string;
}

export default function TeacherTopBar({ onMenuClick, title = "Dashboard" }: TeacherTopBarProps) {
  const { t } = useTranslation('layout');
  const { user, logout } = useAuthStore();
  const { assignments, activeAssignment, setActiveAssignment, loading } = useTeacherStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md flex justify-between items-center w-full px-3 sm:px-4 lg:px-8 h-14 sm:h-16 shadow-sm border-b border-slate-50 transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tighter text-blue-900 shrink-0">{t(title)}</h2>
        <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1 sm:mx-2 shrink-0"></div>
        {!loading && assignments.length > 0 ? (
          <div className="relative hidden sm:block">
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 text-blue-900 font-medium bg-blue-50 px-3 py-1.5 rounded-full text-xs lg:text-sm animate-in fade-in transition-all hover:bg-blue-100 cursor-pointer max-w-[200px] lg:max-w-none">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse shrink-0"></span>
              <span className="hidden sm:inline">{t('Active Context:')}</span>
              <span className="truncate">{activeAssignment?.subject_name} &bull; {activeAssignment?.class_name}</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">{t('Switch Context')}</div>
                  <div className="max-h-60 overflow-y-auto">
                    {assignments.map(a => (
                      <button 
                        key={a.id} 
                        onClick={() => { setActiveAssignment(a); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors flex flex-col gap-1 border-b border-slate-50 ${activeAssignment?.id === a.id ? 'bg-blue-50/50 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                      >
                        <span className="font-bold text-slate-800">{a.subject_name}</span>
                        <span className="text-xs text-slate-500 font-medium">{a.class_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full text-sm italic">
            {t('No assignments loaded')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-6 shrink-0">
        <LanguageSwitcher />
        <PortalSwitcher />
        <NotificationsDropdown />
        <button 
            onClick={handleLogout}
            className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title={t('Logout')}
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        
        <div className="flex items-center gap-2 sm:gap-3 lg:pl-4 lg:border-l border-slate-100">
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Teacher')}</p>
            <p className="text-sm font-bold text-blue-900">{user?.full_name || t('Teacher')}</p>
          </div>
          <div className="relative group cursor-pointer">
            <img 
              alt={t('Teacher Profile')} 
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-100 transition-transform group-hover:scale-105"
              src={user?.profile_photo || "https://lh3.googleusercontent.com/aida-public/AB6AXuBDVOARZ5zm99lDik1UPx3YgBKmhr5kJ0hyEwUC3rBqZ_q_z1f0bDUsVZ9dAMrjpk8cs0VXXlI9SXmJSjRLMqbaINXhFMRhAEy7pRXr0To3rO_FgZmaL5t8yGb-gl-J3F3rbQxp-3a1TPpBU3CtLLYPVcLBXErfKBtN8vl6_Fv9p_KSm8zDjC4sdlpoiUkzwkhV94uJkuApCAC-BrheC2I7XoKeskKyaTCA8s5muMOG_lI5DHRcUiAONaCMjW3ILJvh12U5oozzgQ"} 
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-white rounded-full shadow-sm"></div>
          </div>
        </div>
      </div>
    </header>
  );
}
