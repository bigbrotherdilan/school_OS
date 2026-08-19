import { useAuthLogin } from '../../hooks/useAuthLogin';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DeviceLimitDialog from '../../components/ui/DeviceLimitDialog';
import PasswordInput from '../../components/ui/PasswordInput';

export default function GovLogin() {
    const { t } = useTranslation('auth');
    const { email, setEmail, password, setPassword, error, isLoading, handleLogin, activeSessions, confirmKillSessions, cancelLogin } = useAuthLogin({ 
        allowedRole: 'government', 
        targetPath: '/gov' 
    });

    if (activeSessions) {
        return <DeviceLimitDialog activeSessions={activeSessions} isLoading={isLoading} onConfirm={confirmKillSessions} onCancel={cancelLogin} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
                <span className="material-symbols-outlined text-primary text-5xl mb-4">account_balance</span>
                <h2 className="text-3xl font-extrabold text-primary tracking-tight">MINESEC</h2>
                <p className="mt-2 text-sm text-slate-500 font-medium tracking-widest uppercase">{t('Inspection Portal')}</p>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Official ID / Email')}</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">shield_person</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors sm:text-sm"
                                    placeholder={t('Enter your government email')}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Passcode')}</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <PasswordInput
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border border-slate-200 bg-white text-slate-900 focus:ring-primary"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-error-container/20 border-l-4 border-error rounded-md flex gap-3">
                                <span className="material-symbols-outlined text-error">error</span>
                                <p className="text-sm text-error font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            ) : (
                                t('Authenticate')
                            )}
                        </button>
                    </form>
                </div>
                <div className="mt-6 text-center space-y-3">
                    <Link to="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors block">
                        {t('Forgot your password?')}
                    </Link>
                    <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span> {t('Change Portal')}
                    </Link>
                </div>
                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500">{t('Restricted Access. Unauthorized entry is prohibited by law.')}</p>
                </div>
            </div>
        </div>
    );
}
