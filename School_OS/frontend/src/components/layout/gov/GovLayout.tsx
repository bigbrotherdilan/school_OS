import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

const GovLayout: React.FC = () => {
    const { t } = useTranslation('layout');
    const logout = useAuthStore(state => state.logout);
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="bg-background text-on-background antialiased min-h-screen flex flex-col font-['Inter']">
            {/* TopNavBar */}
            <header className="bg-white shadow-sm full-width top-0 border-b z-50 sticky">
                <div className="flex justify-between items-center w-full px-4 lg:px-6 py-3 max-w-[1920px] mx-auto font-['Public_Sans'] antialiased tracking-tight">
                    <div className="flex items-center gap-4 lg:gap-8">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <span className="text-xl font-black tracking-tighter text-primary">School OS | MINESEC</span>
                        <nav className="hidden md:flex items-center gap-6">
                            <NavLink to="/gov" end className={({isActive}) => isActive ? "text-primary font-bold border-b-2 border-primary pb-2" : "text-slate-600 font-medium hover:text-primary transition-colors duration-200"}>{t('Overview')}</NavLink>
                            <NavLink to="/gov/regions" className={({isActive}) => isActive ? "text-primary font-bold border-b-2 border-primary pb-2" : "text-slate-600 font-medium hover:text-primary transition-colors duration-200"}>{t('Regions')}</NavLink>
                            <NavLink to="/gov/monitoring" className={({isActive}) => isActive ? "text-primary font-bold border-b-2 border-primary pb-2" : "text-slate-600 font-medium hover:text-primary transition-colors duration-200"}>{t('Monitoring')}</NavLink>
                            <NavLink to="/gov/compliance" className={({isActive}) => isActive ? "text-primary font-bold border-b-2 border-primary pb-2" : "text-slate-600 font-medium hover:text-primary transition-colors duration-200"}>{t('Inspections')}</NavLink>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden lg:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                            <input className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-md text-sm w-64 focus:ring-2 focus:ring-primary" placeholder={t('Search national records...')} type="text" />
                        </div>
                        <button className="p-2 hover:bg-slate-50 transition-colors rounded-full text-slate-600">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="p-2 hover:bg-slate-50 transition-colors rounded-full text-slate-600">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="w-8 h-8 rounded-full bg-error-container hover:bg-error/20 flex items-center justify-center overflow-hidden transition-colors"
                            title={t('Logout')}
                        >
                            <span className="material-symbols-outlined text-error text-sm">logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Mobile Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* SideNavBar */}
                <aside className={`fixed left-0 top-16 h-[calc(100vh-64px)] z-50 flex-col pt-8 bg-slate-50 w-64 border-r border-transparent transition-transform duration-300 ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                } lg:flex`}>
                    <div className="px-6 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-sm">
                                <span className="material-symbols-outlined text-white">account_balance</span>
                            </div>
                            <div>
                                <h2 className="font-bold text-primary text-sm uppercase tracking-wider">{t('Control Panel')}</h2>
                                <p className="text-[10px] text-slate-500 font-medium">{t('National Education')}</p>
                            </div>
                        </div>
                    </div>
                    <nav className="flex-1 px-4 space-y-1">
                        <NavLink onClick={() => setIsSidebarOpen(false)} to="/gov/alerts" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:translate-x-1 transition-all duration-150 rounded-md">
                            <span className="material-symbols-outlined">warning</span>
                            <span className="font-['Public_Sans'] text-sm tracking-wide">{t('Alerts')}</span>
                        </NavLink>
                        <NavLink onClick={() => setIsSidebarOpen(false)} to="/gov/inspections" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:translate-x-1 transition-all duration-150 rounded-md">
                            <span className="material-symbols-outlined">verified_user</span>
                            <span className="font-['Public_Sans'] text-sm tracking-wide">{t('Inspections')}</span>
                        </NavLink>
                        <NavLink onClick={() => setIsSidebarOpen(false)} to="/gov/policy" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:translate-x-1 transition-all duration-150 rounded-md">
                            <span className="material-symbols-outlined">gavel</span>
                            <span className="font-['Public_Sans'] text-sm tracking-wide">{t('Policy')}</span>
                        </NavLink>
                        <NavLink onClick={() => setIsSidebarOpen(false)} to="/gov/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:translate-x-1 transition-all duration-150 rounded-md">
                            <span className="material-symbols-outlined">help_center</span>
                            <span className="font-['Public_Sans'] text-sm tracking-wide">{t('Support')}</span>
                        </NavLink>
                    </nav>
                    <div className="p-6 mt-auto">
                        <div className="bg-primary-container p-4 rounded-lg">
                            <p className="text-on-primary-container text-xs font-bold mb-1">{t('System Health')}</p>
                            <div className="w-full bg-primary/30 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-on-primary-container w-[92%] h-full"></div>
                            </div>
                            <p className="text-[10px] text-on-primary-container/80 mt-2">{t('All nodes operational')}</p>
                        </div>
                    </div>
                </aside>

                {/* Main Content Canvas */}
                <main className="flex-1 lg:ml-64 p-4 lg:p-12 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default GovLayout;
