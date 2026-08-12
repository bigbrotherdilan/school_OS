import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { useTenantStore } from '../../../stores/tenantStore';
import { useParentStore } from '../../../stores/parentStore';
import NotificationsDropdown from '../NotificationsDropdown';

const ParentLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isChildDrawerOpen, setIsChildDrawerOpen] = useState(false);
    const logout = useAuthStore(state => state.logout);
    const { activeTenantId, fetchSchoolConfig } = useTenantStore();
    const { dashboardData, selectedWardId, setSelectedWardId } = useParentStore();

    useEffect(() => {
        if (activeTenantId) fetchSchoolConfig(activeTenantId);
    }, [activeTenantId]);

    useEffect(() => {
        if (params.childId) {
            setSelectedWardId(params.childId);
        }
    }, [params.childId]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinks = [
        { name: 'Home', path: '/parent', icon: 'home' },
        { name: 'Fees', path: '/parent/fees', icon: 'payments' },
        { name: 'Receipts', path: '/parent/receipts', icon: 'receipt_long' },
        { name: 'Reports', path: '/parent/reports', icon: 'description' },
        { name: 'Grades', path: '/parent/analytics', icon: 'analytics' },
        { name: 'Settings', path: '/parent/settings', icon: 'settings' },
    ];

    const wards = dashboardData?.wards || [];
    const activeWard = wards.find(w => w.id === (params.childId || selectedWardId));
    const hasMultipleChildren = wards.length > 1;

    return (
        <div className="min-h-screen bg-surface font-sans">
            {/* Top Navigation Bar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="flex justify-between items-center px-4 lg:px-12 py-3 max-w-[1600px] mx-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined">{isMobileNavOpen ? 'close' : 'menu'}</span>
                        </button>
                        <Link to="/parent" className="text-xl font-bold text-blue-900 tracking-tight">
                            Parent Portal
                        </Link>

                        {/* Persistent Child Switcher */}
                        {hasMultipleChildren && activeWard && (
                            <button
                                onClick={() => setIsChildDrawerOpen(!isChildDrawerOpen)}
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
                            >
                                {activeWard.photo_url && activeWard.photo_url.startsWith('http') && !activeWard.photo_url.includes('aida-public') ? (
                                    <img src={activeWard.photo_url} alt={activeWard.first_name} className="w-6 h-6 rounded-full object-cover" />
                                ) : (
                                    <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center text-[10px] font-bold">
                                        {activeWard.first_name[0]}{activeWard.last_name[0]}
                                    </span>
                                )}
                                <span className="truncate max-w-[100px]">{activeWard.first_name}</span>
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                            </button>
                        )}

                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const isActive = location.pathname === link.path || (link.path !== '/parent' && location.pathname.startsWith(link.path));
                                return (
                                    <Link
                                        key={link.name}
                                        to={link.path}
                                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                    >
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <NotificationsDropdown />
                        <button
                            onClick={handleLogout}
                            className="p-2.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                            title="Logout"
                        >
                            <span className="material-symbols-outlined text-xl">logout</span>
                        </button>
                    </div>
                </div>

                {/* Child Switcher Dropdown */}
                {isChildDrawerOpen && hasMultipleChildren && (
                    <div className="border-t border-slate-100 bg-white px-4 lg:px-12 py-3">
                        <div className="flex gap-2 overflow-x-auto pb-1 max-w-[1600px] mx-auto">
                            {wards.map(ward => {
                                const isActive = ward.id === (params.childId || selectedWardId);
                                const initials = `${ward.first_name[0]}${ward.last_name[0]}`.toUpperCase();
                                return (
                                    <button
                                        key={ward.id}
                                        onClick={() => {
                                            setSelectedWardId(ward.id);
                                            setIsChildDrawerOpen(false);
                                            navigate(`/parent/child/${ward.id}`);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                            isActive
                                                ? 'bg-blue-900 text-white shadow-sm'
                                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {ward.photo_url && ward.photo_url.startsWith('http') && !ward.photo_url.includes('aida-public') ? (
                                            <img src={ward.photo_url} alt={ward.first_name} className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                                                {initials}
                                            </span>
                                        )}
                                        {ward.first_name} · {ward.grade}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </nav>

            {/* Mobile Navigation Drawer */}
            {isMobileNavOpen && (
                <>
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileNavOpen(false)} />
                    <div className="fixed left-0 top-[57px] w-72 bg-white shadow-xl z-50 md:hidden border-r border-slate-200">
                        <div className="p-3 space-y-1">
                            {navLinks.map((link) => {
                                const isActive = location.pathname === link.path || (link.path !== '/parent' && location.pathname.startsWith(link.path));
                                return (
                                    <Link
                                        key={link.name}
                                        to={link.path}
                                        onClick={() => setIsMobileNavOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-xl">{link.icon}</span>
                                        {link.name}
                                    </Link>
                                );
                            })}

                            {/* Mobile child list */}
                            {hasMultipleChildren && (
                                <>
                                    <div className="border-t border-slate-100 my-2 pt-2">
                                        <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Switch Child</p>
                                    </div>
                                    {wards.map(ward => {
                                        const isActive = ward.id === (params.childId || selectedWardId);
                                        const initials = `${ward.first_name[0]}${ward.last_name[0]}`.toUpperCase();
                                        return (
                                            <Link
                                                key={ward.id}
                                                to={`/parent/child/${ward.id}`}
                                                onClick={() => {
                                                    setIsMobileNavOpen(false);
                                                    setSelectedWardId(ward.id);
                                                }}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                                                    isActive
                                                        ? 'bg-blue-50 text-blue-900'
                                                        : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'}`}>
                                                    {initials}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate">{ward.first_name} {ward.last_name}</p>
                                                    <p className="text-[11px] text-slate-400">{ward.grade}</p>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Main Content */}
            <main className="max-w-[960px] mx-auto p-4 lg:p-8">
                <Outlet />
            </main>
        </div>
    );
};

export default ParentLayout;
