import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import BursarSidebar from './BursarSidebar';
import { useAuthStore } from '../../../stores/authStore';
import { useTenantStore } from '../../../stores/tenantStore';

export default function BursarLayout() {
  const { t } = useTranslation('layout');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const { user, logout, tenants } = useAuthStore();
  const { activeTenantId, setActiveTenantId } = useTenantStore();

  useEffect(() => {
    if (tenants && tenants.length > 0) {
      const isValid = tenants.some(t => t.id === activeTenantId);
      if (!isValid) {
        setActiveTenantId(tenants[0].id);
      }
    }
  }, [activeTenantId, tenants, setActiveTenantId]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'BU';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface selection:bg-emerald-600/20 selection:text-emerald-900">
      <BursarSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-container-high rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-on-surface">{user?.full_name || t('Bursar')}</p>
                <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold">{t('Finance Access')}</p>
              </div>
              <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-black">
                {initials}
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="ml-1 lg:ml-2 p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                title={t('Logout')}
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
          {activeTenantId ? <Outlet /> : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-on-surface-variant font-medium">{t('Loading...')}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-error-container/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-error text-2xl">logout</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">{t('Confirm Logout')}</h3>
              <p className="text-sm text-on-surface-variant">{t('You will be signed out and redirected to the login page.')}</p>
            </div>
            <div className="flex border-t border-outline-variant/10">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 text-sm font-semibold text-error hover:bg-error-container/20 transition-colors border-l border-outline-variant/10"
              >
                {t('Logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
