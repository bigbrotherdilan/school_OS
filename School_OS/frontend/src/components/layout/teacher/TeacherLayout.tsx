import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import TeacherSidebar from './TeacherSidebar';
import TeacherTopBar from './TeacherTopBar';
import { useTeacherStore } from '../../../stores/teacherStore';


export default function TeacherLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { assignments, activeAssignment, fetchAssignments, loading } = useTeacherStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // guard redirect
  useEffect(() => {
    if (!loading && assignments.length === 0 && location.pathname !== '/teacher') {
      navigate('/teacher');
    }
  }, [loading, assignments.length, location.pathname, navigate]);

  const activeClass = activeAssignment ? `${activeAssignment.class_name} Active` : undefined;
  return (
    <div className="min-h-screen bg-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Sidebar */}
      <TeacherSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main Content */}
      <div className="lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
        <TeacherTopBar 
          onMenuClick={() => setIsSidebarOpen(true)} 
          activeClass={activeClass}
        />
        
        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button (Mobile only) */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <button onClick={() => navigate('/teacher/planner')} className="w-14 h-14 bg-gradient-premium text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all glass-panel border border-white/20">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        </button>
      </div>
    </div>
  );
}
