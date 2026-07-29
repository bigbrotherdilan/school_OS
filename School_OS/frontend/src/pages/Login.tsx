import { Link } from 'react-router-dom';

export default function LoginGateway() {
    return (
        <div className="min-h-screen bg-surface flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
            
            <div className="text-center mb-12 relative z-10">
                <h2 className="text-4xl font-extrabold text-primary tracking-tight">School OS</h2>
                <p className="mt-3 text-on-surface-variant max-w-lg mx-auto">Select your portal to securely access your personalized dashboard and academic tools.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full relative z-10">
                {/* Parent Portal */}
                <Link to="/login/parent" className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-[#fef2f2] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-[#ef4444]">family_restroom</span>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Parent Portal</h3>
                    <p className="text-sm text-on-surface-variant">Track academic progress, pay fees, and view report cards.</p>
                </Link>

                {/* Teacher's Portal */}
                <Link to="/login/teacher" className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-primary">local_library</span>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Teacher's Portal</h3>
                    <p className="text-sm text-on-surface-variant">Manage classes, fill logbooks, and submit assessments.</p>
                </Link>

                {/* Bursar Portal */}
                <Link to="/login/bursar" className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-emerald-600">account_balance</span>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Bursar Portal</h3>
                    <p className="text-sm text-on-surface-variant">Fees, payments, invoices, and financial records.</p>
                </Link>

                {/* Admin Portal */}
                <Link to="/login/admin" className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/20 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-slate-700">admin_panel_settings</span>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">School Administration</h3>
                    <p className="text-sm text-on-surface-variant">Manage academics, finance, staff, and school records.</p>
                </Link>
            </div>
            
            <div className="mt-16 text-center relative z-10">
                <Link to="/" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1 justify-center">
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span> Return to Main Site
                </Link>
            </div>
        </div>
    );
}
