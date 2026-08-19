import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { useCurrentClass } from '../../../hooks/useCurrentClass';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', path: '/teacher' },
  { icon: 'calendar_today', label: 'My Timetable', path: '/teacher/timetable' },
  { icon: 'menu_book', label: 'Digital Logbook', path: '/teacher/logbook' },
  { icon: 'analytics', label: 'Program Coverage', path: '/teacher/coverage' },
  { icon: 'edit_note', label: 'Lesson Planner', path: '/teacher/planner' },
  { icon: 'grade', label: 'Assessments & Marks', path: '/teacher/assessments' },
  { icon: 'settings', label: 'Settings', path: '/teacher/settings' },
];

export default function TeacherSidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const { t } = useTranslation('layout');
  const location = useLocation();
  const navigate = useNavigate();
  const { tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const activeTenant = tenants?.find(t => t.id === activeTenantId);
  const schoolName = activeTenant?.school_name || 'School OS';
  const { currentClass } = useCurrentClass();

  const sidebarClasses = `
    fixed left-0 top-0 h-screen w-64 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 
    flex flex-col gap-1 p-4 shadow-sm border-r border-slate-100 transition-transform duration-300
    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  `;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="mb-8 px-2 flex items-center justify-between">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20">{schoolName.charAt(0)}</div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-blue-900 leading-none truncate">{schoolName}</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">{t('Digital Campus')}</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 transition-all duration-200 rounded-lg group
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-bold translate-x-1' 
                    : 'text-slate-600 hover:bg-blue-50/50 hover:text-blue-900'
                  }
                `}
              >
                <span className={`material-symbols-outlined transition-colors ${isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-blue-600'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}>
                  {item.icon}
                </span>
                <span className="text-sm">{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          {currentClass ? (
            <button
              onClick={() => navigate('/teacher/logbook')}
              className="w-full py-3 px-4 bg-gradient-premium text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:rotate-12" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
              <span className="truncate">{t('Start: {{subject}}', { subject: currentClass.subject })}</span>
            </button>
          ) : (
            <div className="w-full py-3 px-4 bg-slate-200/60 text-slate-400 rounded-full font-bold flex items-center justify-center gap-2 cursor-not-allowed">
              <span className="material-symbols-outlined text-sm">pause_circle</span>
              <span>{t('No Class Now')}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
