import { useAuthLogin } from '../../hooks/useAuthLogin';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PasswordInput from '../../components/ui/PasswordInput';
import DeviceLimitDialog from '../../components/ui/DeviceLimitDialog';

export default function BursarLogin() {
    const { t } = useTranslation('auth');
    const { email, setEmail, password, setPassword, error, isLoading, handleLogin, activeSessions, confirmKillSessions, cancelLogin } = useAuthLogin({ 
        allowedRole: 'bursar', 
        targetPath: '/bursar' 
    });

    if (activeSessions) {
        return <DeviceLimitDialog activeSessions={activeSessions} isLoading={isLoading} onConfirm={confirmKillSessions} onCancel={cancelLogin} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
            
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/20">
                    <span className="material-symbols-outlined text-white text-3xl">account_balance</span>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('Bursar Portal')}</h2>
                <p className="mt-2 text-sm text-slate-500 font-medium">{t('Fees, payments, and financial records.')}</p>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600"></div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Bursar Email')}</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-colors sm:text-sm"
                                    placeholder="bursar@school.edu"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Password')}</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <PasswordInput
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border border-slate-200 focus:ring-emerald-600"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex gap-3">
                                <span className="material-symbols-outlined text-red-500">error</span>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 transition-all"
                        >
                            {isLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : t('Login')}
                        </button>
                    </form>
                </div>
                <div className="mt-6 text-center space-y-3">
                    <Link to="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors block">
                        {t('Forgot your password?')}
                    </Link>
                    <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span> {t('Change Portal')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
