import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, LogOut } from 'lucide-react';
import ChangePasswordCard from '../components/ui/ChangePasswordCard';
import { useAuthStore } from '../stores/authStore';

export default function ForcePasswordChange() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const clearMustChangePassword = useAuthStore(state => state.clearMustChangePassword);

  const handleSuccess = () => {
    clearMustChangePassword();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">School_OS</h1>
          <p className="text-sm text-on-surface-variant mt-1">{t('Secure your account')}</p>
        </div>

        <div className="flex items-start gap-3 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">{t('Temporary password detected')}</p>
            <p className="text-xs text-amber-700 mt-1">
              {t('For your security, you must create a new password before you can access your portal.')}
            </p>
          </div>
        </div>

        <ChangePasswordCard onSuccess={handleSuccess} />

        <div className="text-center mt-4">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-error transition-colors"
          >
            <LogOut className="w-4 h-4" /> {t('Log out instead')}
          </button>
        </div>
      </div>
    </div>
  );
}
