import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { useTenantStore } from '../../../stores/tenantStore';

const navItems = [
  { icon: 'account_balance', label: 'Treasury', path: '/bursar' },
  { icon: 'receipt_long', label: 'Record Payment', path: '/bursar/transactions/new' },
  { icon: 'receipt', label: 'Invoices', path: '/bursar/invoices' },
  { icon: 'account_balance_wallet', label: 'Student Ledger', path: '/bursar/ledger' },
  { icon: 'trending_down', label: 'Arrears', path: '/bursar/arrears' },
  { icon: 'money_off', label: 'Expenses', path: '/bursar/expenses' },
  { icon: 'settings', label: 'Settings', path: '/bursar/settings' },
];

export default function BursarSidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const activeTenant = tenants?.find(t => t.id === activeTenantId);
  const schoolName = activeTenant?.school_name || 'School OS';

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'BU';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarClasses = `
    fixed left-0 top-0 h-screen w-64 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 
    flex flex-col gap-1 p-4 shadow-sm border-r border-slate-100 transition-transform duration-300
    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  `;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="mb-6 px-2 flex items-center justify-between">
          <Link to="/bursar" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-600/20">{schoolName.charAt(0)}</div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-blue-900 leading-none truncate">{schoolName}</h1>
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mt-1">Bursar Portal</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-emerald-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* User Card */}
        <div className="mb-4 px-3 py-3 bg-emerald-50 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name || 'Bursar'}</p>
            <p className="text-[10px] text-emerald-700 uppercase tracking-widest font-bold">Finance Access</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
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
                    ? 'bg-emerald-50 text-emerald-700 font-bold translate-x-1'
                    : 'text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-900'
                  }
                `}
              >
                <span className={`material-symbols-outlined transition-colors ${isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-emerald-600'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200 group"
          >
            <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 transition-colors">logout</span>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
