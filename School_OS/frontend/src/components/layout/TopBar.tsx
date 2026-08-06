import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { useTenantStore } from '../../stores/tenantStore';
import { useSectionStore } from '../../stores/sectionStore';
import PortalSwitcher from './PortalSwitcher';
import NotificationsDropdown from './NotificationsDropdown';
import HelpPanel from './HelpPanel';

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const { sections, activeSectionId, setActiveSectionId } = useSectionStore();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const activeTenant = tenants?.find(t => t.id === activeTenantId);
  const schoolName = activeTenant?.school_name || 'School OS';
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  const activeSection = sections.find(s => s.id === activeSectionId);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showSectionSwitcher = sections.length > 1 && !!activeSection;

  return (
    <>
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-4 lg:px-12 h-16 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/15 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="text-xl font-bold tracking-tighter text-blue-900">School OS</span>
        <nav className="hidden md:flex items-center gap-6">
          <a className="text-blue-700 font-semibold border-b-2 border-blue-700 font-sans text-sm tracking-tight py-5" href="#">
            {academicYear} Academic Year
          </a>
          <span className="text-slate-600 transition-colors font-sans text-sm font-medium tracking-tight">
            {schoolName}
          </span>
        </nav>
      </div>
      
      <div className="flex items-center gap-2 lg:gap-4">
        {showSectionSwitcher && (
          <div className="relative hidden sm:block">
            <button
              onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-900/10 bg-white text-blue-900 hover:bg-blue-50 transition-all text-sm font-semibold"
              title="Switch section"
            >
              <span className="w-2 h-2 bg-secondary rounded-full shrink-0"></span>
              <span className="hidden lg:inline text-slate-500 font-medium">Section:</span>
              <span className="truncate max-w-[10rem]">{activeSection.name}</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>

            {sectionDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSectionDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  <div className="p-2 bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-500 text-center border-b border-slate-100">
                    Switch Section
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {sections.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveSectionId(s.id); setSectionDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                          activeSectionId === s.id ? 'bg-blue-50/50 border-l-2 border-l-primary' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-slate-800">{s.name}</span>
                        {s.language && (
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{s.language}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <PortalSwitcher />
        <div className="hidden sm:block">
          <NotificationsDropdown />
        </div>
        <div className="hidden sm:block">
          <HelpPanel />
        </div>
        <div className="hidden sm:block h-8 w-px bg-slate-200 mx-2"></div>
        
        <div className="flex items-center gap-2 lg:gap-3 cursor-pointer group">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-blue-900">{user?.full_name || 'Admin User'}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">School Admin</p>
          </div>
          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="ml-1 lg:ml-2 p-1 text-slate-400 hover:text-error transition-colors"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </header>

    {showLogoutConfirm && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-slate-600 text-2xl">logout</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-slate-500">You will be signed out and redirected to the login page.</p>
          </div>
          <div className="flex border-t border-slate-100">
            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleLogout} className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors border-l border-slate-100">Logout</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
