import { useAuthLogin } from '../../hooks/useAuthLogin';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PasswordInput from '../../components/ui/PasswordInput';

export default function AdminLogin() {
    const { t } = useTranslation('auth');
    const { email, setEmail, password, setPassword, error, isLoading, handleLogin, activeSessions, confirmKillSessions, cancelLogin } = useAuthLogin({ 
        allowedRoles: ['admin', 'super_admin'],
        targetPath: '/admin' 
    });

    if (activeSessions) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200">
                        <div className="text-center mb-6">
                            <span className="material-symbols-outlined text-5xl text-amber-500">devices</span>
                            <h3 className="text-xl font-bold text-slate-900 mt-3">{t('Too Many Active Sessions')}</h3>
                            <p className="text-sm text-slate-600 mt-2">{t('You are already logged in on {{count}} device(s). Maximum allowed is 2. Confirm to disconnect existing devices and continue.', { count: activeSessions.length })}</p>
                        </div>
                        <div className="space-y-3 mb-6">
                            {activeSessions.map((s) => (
                                <div key={s.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-500 mt-0.5">devices_other</span>
                                    <div className="text-sm">
                                        <p className="font-semibold text-slate-800">{s.device_name}</p>
                                        <p className="text-slate-500 text-xs mt-0.5">{t('IP: {{ip}}', { ip: s.ip_address })}</p>
                                        <p className="text-slate-500 text-xs">{t('Last active: {{time}}', { time: new Date(s.last_active).toLocaleString() })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={cancelLogin} disabled={isLoading} className="flex-1 py-3 px-4 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">{t('Cancel')}</button>
                            <button onClick={confirmKillSessions} disabled={isLoading} className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50">
                                {isLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : t('Disconnect & Login')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-slate-300/30 rounded-bl-full blur-3xl -z-10"></div>
            
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-800/20">
                    <span className="material-symbols-outlined text-white text-3xl">admin_panel_settings</span>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('Administration')}</h2>
                <p className="mt-2 text-sm text-slate-500 font-medium tracking-widest uppercase">{t('Operations Control')}</p>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800"></div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Admin Email')}</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-colors sm:text-sm"
                                    placeholder="admin@school.edu"
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
                                    className="border border-slate-300 focus:ring-slate-800"
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
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 disabled:opacity-50 transition-all"
                        >
                            {isLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : t('Login')}
                        </button>
                    </form>
                </div>
                <div className="mt-6 text-center space-y-3">
                    <Link to="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors block">
                        {t('Forgot your password?')}
                    </Link>
                    <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span> {t('Change Portal')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
