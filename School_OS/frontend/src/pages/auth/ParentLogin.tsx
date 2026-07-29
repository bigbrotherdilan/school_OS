import { useAuthLogin } from '../../hooks/useAuthLogin';
import { Link } from 'react-router-dom';
import DeviceLimitDialog from '../../components/ui/DeviceLimitDialog';

export default function ParentLogin() {
    const { email, setEmail, password, setPassword, error, isLoading, handleLogin, activeSessions, confirmKillSessions, cancelLogin } = useAuthLogin({ 
        allowedRole: 'parent', 
        targetPath: '/parent' 
    });

    if (activeSessions) {
        return <DeviceLimitDialog activeSessions={activeSessions} isLoading={isLoading} onConfirm={confirmKillSessions} onCancel={cancelLogin} />;
    }

    return (
        <div className="min-h-screen bg-[#fef2f2] flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#fca5a5]/20 rounded-full blur-3xl"></div>
            
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
                <div className="w-16 h-16 bg-[#ef4444] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="material-symbols-outlined text-white text-3xl">family_restroom</span>
                </div>
                <h2 className="text-3xl font-extrabold text-[#7f1d1d] tracking-tight">Parent Portal</h2>
                <p className="mt-2 text-sm text-[#991b1b] font-medium">Access your ward's academic records.</p>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-red-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#ef4444]"></div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef4444] focus:border-transparent transition-colors sm:text-sm"
                                    placeholder="parent@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">lock</span>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef4444] focus:border-transparent transition-colors sm:text-sm"
                                    placeholder="••••••••"
                                    required
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
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#ef4444] hover:bg-[#dc2626] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ef4444] disabled:opacity-50 transition-all"
                        >
                            {isLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Login"}
                        </button>
                    </form>
                </div>
                <div className="mt-6 text-center">
                    <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-[#ef4444] transition-colors flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span> Change Portal
                    </Link>
                </div>
            </div>
        </div>
    );
}
