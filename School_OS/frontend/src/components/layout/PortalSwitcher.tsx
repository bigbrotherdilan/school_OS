import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LayoutGrid, GraduationCap, ArrowLeftRight } from 'lucide-react';

export default function PortalSwitcher() {
  const { roles } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Role detection logic
  const rolesList = roles.map(r => r.role);
  const isTeacher = rolesList.includes('teacher');
  const isAdmin = rolesList.includes('admin') || rolesList.includes('super_admin');

  // Only show if user has both roles
  if (!isTeacher || !isAdmin) return null;

  const isCurrentlyTeacher = location.pathname.startsWith('/teacher');
  
  const handleSwitch = () => {
    if (isCurrentlyTeacher) {
      navigate('/admin');
    } else {
      navigate('/teacher');
    }
  };

  return (
    <button
      onClick={handleSwitch}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest
        transition-all duration-300 active:scale-95 shadow-lg group relative overflow-hidden
        ${isCurrentlyTeacher 
          ? 'bg-gradient-to-r from-blue-900 to-indigo-900 text-white border border-white/10' 
          : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border border-white/10'}
      `}
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="relative flex items-center gap-2">
        {isCurrentlyTeacher ? (
          <>
            <LayoutGrid className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">To Admin Portal</span>
          </>
        ) : (
          <>
            <GraduationCap className="w-3.5 h-3.5 group-hover:-rotate-12 transition-transform" />
            <span className="hidden sm:inline">To Teacher Portal</span>
          </>
        )}
        <ArrowLeftRight className="w-3 h-3 opacity-40 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}
