import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', path: '/admin' },
  { icon: 'school', label: 'Studies Office', path: '/admin/academic' },
  { icon: 'calendar_month', label: 'Timetables', path: '/admin/academic/timetables' },
  { icon: 'badge', label: 'ID Cards', path: '/admin/academic/id-cards' },
  { icon: 'account_balance_wallet', label: 'Finance', path: '/admin/finance' },
  { icon: 'how_to_reg', label: 'Daily Register', path: '/admin/attendance' },
  { icon: 'settings_input_component', label: 'Administration', path: '/admin/operations' },
  { icon: 'campaign', label: 'Announcements', path: '/admin/community/communications' },
  { icon: 'group', label: 'PTA & Community', path: '/admin/community' },
  { icon: 'fact_check', label: 'Inspections', path: '/admin/compliance' },
  { icon: 'settings', label: 'System', path: '/admin/system' },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const { tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const activeTenant = tenants?.find(t => t.id === activeTenantId);
  const schoolName = activeTenant?.school_name || 'School OS';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen flex flex-col py-6 bg-slate-900 w-72 shadow-2xl z-50 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="px-6 mb-6 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight leading-tight line-clamp-2">{schoolName}</h1>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-6 mb-6">School Administration</p>
        
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                } rounded-xl my-0.5 px-4 py-3 flex items-center gap-3 font-sans text-sm font-medium tracking-wide transition-all duration-200 group`}
              >
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <Link to="/admin/audit" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 mx-2 my-1 px-4 py-3 flex items-center gap-3 font-sans text-sm font-regular tracking-wide">
            <span className="material-symbols-outlined">history</span>
            <span>Activity Log</span>
          </Link>
          <Link to="/admin/settings" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 mx-2 my-1 px-4 py-3 flex items-center gap-3 font-sans text-sm font-regular tracking-wide">
            <span className="material-symbols-outlined">manage_accounts</span>
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
