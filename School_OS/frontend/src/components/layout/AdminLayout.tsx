import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BackButton from '../ui/BackButton';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';

export default function AdminLayout() {
  const { tenants } = useAuthStore();
  const { activeTenantId, setActiveTenantId } = useTenantStore();
  const location = useLocation();
  const [darkMode, _setDarkMode] = useState(() => {
    return localStorage.getItem('schoolos-dark-mode') === 'true';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isSubPage = location.pathname.split('/').filter(Boolean).length > 2;
  const parentPath = '/' + location.pathname.split('/').filter(Boolean).slice(0, 2).join('/');

  useEffect(() => {
    if (tenants && tenants.length > 0) {
      const isValid = tenants.some(t => t.id === activeTenantId);
      if (!isValid) {
        setActiveTenantId(tenants[0].id);
      }
    }
  }, [activeTenantId, tenants, setActiveTenantId]);

  useEffect(() => {
    localStorage.setItem('schoolos-dark-mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="bg-background text-on-surface flex min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="lg:ml-72 flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <div className="flex-1">
          {isSubPage && (
            <div className="px-4 lg:px-12 pt-4">
              <BackButton to={parentPath} />
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
