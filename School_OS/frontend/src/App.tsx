import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { api } from './services/api';
import Login from './pages/Login';
import GovLogin from './pages/auth/GovLogin';
import ParentLogin from './pages/auth/ParentLogin';
import TeacherLogin from './pages/auth/TeacherLogin';
import AdminLogin from './pages/auth/AdminLogin';
import BursarLogin from './pages/auth/BursarLogin';
import LandingPage from './pages/public/LandingPage';
import TrustPage from './pages/public/TrustPage';
import SchoolTemplate from './pages/public/SchoolTemplate';
import SchoolsList from './pages/public/SchoolsList';
import SchoolProfile from './pages/public/SchoolProfile';
import AdminLayout from './components/layout/AdminLayout';
import DashboardHome from './pages/admin/dashboard/DashboardHome';
import AcademicManagement from './pages/admin/academic/AcademicManagement';
import OperationsCenter from './pages/admin/operations/OperationsCenter';
import FinanceTreasury from './pages/admin/finance/FinanceTreasury';
import FinanceFeeSetup from './pages/admin/finance/FinanceFeeSetup';
import InvoiceManagement from './pages/admin/finance/InvoiceManagement';
import StudentLedger from './pages/admin/finance/StudentLedger';
import ArrearsManagement from './pages/admin/finance/ArrearsManagement';
import ExpensesPage from './pages/admin/finance/ExpensesPage';
import CommunityEthos from './pages/admin/community/CommunityEthos';
import ComplianceCenter from './pages/admin/compliance/ComplianceCenter';
import SystemControl from './pages/admin/system/SystemControl';
import AcademicSetup from './pages/admin/academic/AcademicSetup';
import AuditLogs from './pages/admin/audit/AuditLogs';
import Settings from './pages/admin/settings/Settings';
import AddStudentPage from './pages/admin/academic/students/AddStudentPage';
import RecordTransactionPage from './pages/admin/finance/RecordTransactionPage';
import AddFacultyPage from './pages/admin/operations/AddFacultyPage';
import AddBursarPage from './pages/admin/operations/AddBursarPage';
import Timetables from './pages/admin/academic/Timetables';
import Examinations from './pages/admin/academic/Examinations';
import ExamWorkflow from './pages/admin/academic/ExamWorkflow';
import MarkFillStatus from './pages/admin/academic/MarkFillStatus';
import CurriculumCoverage from './pages/admin/academic/CurriculumCoverage';
import DisciplineAndTransfers from './pages/admin/operations/DisciplineAndTransfers';
import FacultyPerformance from './pages/admin/operations/FacultyPerformance';
import Communications from './pages/admin/community/Communications';
import PerformanceReports from './pages/admin/compliance/PerformanceReports';
import AttendanceDashboard from './pages/admin/attendance/AttendanceDashboard';
import StudentPromotion from './pages/admin/academic/StudentPromotion';
import ReportCardManagement from './pages/admin/academic/ReportCardManagement';
import IDCardGenerator from './pages/admin/academic/IDCardGenerator';
import AcademicAnalytics from './pages/admin/academic/AcademicAnalytics';
import TeacherDirectory from './pages/admin/operations/TeacherDirectory';
import BulkImportStudents from './pages/admin/operations/BulkImportStudents';
import BulkImportTeachers from './pages/admin/operations/BulkImportTeachers';
import SchoolYearReview from './components/admin/SchoolYearReview';
import TeacherMarketplace from './pages/public/TeacherMarketplace';
import { useAuthStore } from './stores/authStore';
import ToastContainer from './components/ui/ToastContainer';

// Teacher Portal
import TeacherLayout from './components/layout/teacher/TeacherLayout';
import TeacherDashboardHome from './pages/teacher/dashboard/TeacherDashboardHome';
import TeacherLogbookPage from './pages/teacher/logbook/TeacherLogbookPage';
import TeacherAssessmentsPage from './pages/teacher/assessments/TeacherAssessmentsPage';
import TeacherTimetablePage from './pages/teacher/timetable/TeacherTimetablePage';
import TeacherPlannerPage from './pages/teacher/planner/TeacherPlannerPage';
import TeacherCoveragePage from './pages/teacher/coverage/TeacherCoveragePage';
import TeacherSettingsPage from './pages/teacher/settings/TeacherSettingsPage';
import TeacherProfileEdit from './pages/teacher/settings/TeacherProfileEdit';

import ParentLayout from './components/layout/parent/ParentLayout';
import ParentDashboard from './pages/parent/ParentDashboard';
import ParentFees from './pages/parent/ParentFees';
import ParentReports from './pages/parent/ParentReports';
import ParentAnalytics from './pages/parent/ParentAnalytics';
import ParentSettings from './pages/parent/ParentSettings';
import ParentChildDetail from './pages/parent/ParentChildDetail';

import GovLayout from './components/layout/gov/GovLayout';
import GovDashboard from './pages/gov/GovDashboard';
import GovRegions from './pages/gov/GovRegions';
import GovMonitoring from './pages/gov/GovMonitoring';
import GovCompliance from './pages/gov/GovCompliance';
import GovAlerts from './pages/gov/GovAlerts';
import GovInspections from './pages/gov/GovInspections';
import GovPolicy from './pages/gov/GovPolicy';
import GovSupport from './pages/gov/GovSupport';

// Bursar Portal
import BursarLayout from './components/layout/bursar/BursarLayout';
import BursarDashboard from './pages/bursar/BursarDashboard';
import BursarSettings from './pages/bursar/BursarSettings';

// Temporary placeholder components for other portals
const PlaceholderDashboard = ({ title }: { title: string }) => {
  const logout = useAuthStore(state => state.logout);
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-primary mb-4">{title}</h1>
      <button 
        onClick={logout}
        className="px-4 py-2 bg-error text-white rounded-lg font-medium shadow-sm hover:opacity-90"
      >
        Logout
      </button>
    </div>
  );
};

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles = [] }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { token, roles, user } = useAuthStore();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles required, check them
  if (allowedRoles.length > 0 && !user?.is_platform_admin) {
    const hasRole = roles.some(r => allowedRoles.includes(r.role) || allowedRoles.includes('any'));
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

// Portal Redirector - Decides where to send a user based on their primary role
const PortalRedirect = () => {
  const { roles, user } = useAuthStore();
  
  if (user?.is_platform_admin) return <Navigate to="/admin/system" replace />;
  
  const rolesList = roles.map(r => r.role);
  if (rolesList.includes('teacher')) return <Navigate to="/teacher" replace />;
  if (rolesList.includes('bursar')) return <Navigate to="/bursar" replace />;
  if (rolesList.includes('admin') || rolesList.includes('super_admin')) return <Navigate to="/admin" replace />;
  if (rolesList.includes('parent')) return <Navigate to="/parent" replace />;
  if (rolesList.includes('government')) return <Navigate to="/gov" replace />;
  
  return <Navigate to="/unauthorized" replace />;
};

export default function App() {
  const token = useAuthStore(state => state.token);
  const setAuth = useAuthStore(state => state.setAuth);
  const logout = useAuthStore(state => state.logout);
  const tenants = useAuthStore(state => state.tenants);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me/').then(({ data }) => {
      setAuth(token, useAuthStore.getState().refreshToken || '', data.user, tenants.length > 0 ? tenants : data.tenants, data.roles);
    }).catch(() => {
      logout();
    });
  }, []);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/templates/school" element={<SchoolTemplate />} />
        <Route path="/schools" element={<SchoolsList />} />
        <Route path="/schools/:schoolId" element={<SchoolProfile />} />
        <Route path="/find-teachers" element={<TeacherMarketplace />} />
        
        <Route path="/login" element={token ? <PortalRedirect /> : <Login />} />
        <Route path="/gov/login" element={token ? <PortalRedirect /> : <GovLogin />} />
        <Route path="/login/parent" element={token ? <PortalRedirect /> : <ParentLogin />} />
        <Route path="/login/teacher" element={token ? <PortalRedirect /> : <TeacherLogin />} />
        <Route path="/login/admin" element={token ? <PortalRedirect /> : <AdminLogin />} />        
        <Route path="/login/bursar" element={token ? <PortalRedirect /> : <BursarLogin />} />
        {/* Generic Dashboard Redirect */}
        <Route path="/dashboard" element={<PortalRedirect />} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="academic" element={<AcademicManagement />} />
          <Route path="academic/students/new" element={<AddStudentPage />} />
          <Route path="academic/students/import" element={<BulkImportStudents />} />
          <Route path="operations" element={<OperationsCenter />} />
          <Route path="operations/faculty" element={<TeacherDirectory />} />
          <Route path="operations/faculty/new" element={<AddFacultyPage />} />
          <Route path="operations/bursars/new" element={<AddBursarPage />} />
          <Route path="operations/faculty/import" element={<BulkImportTeachers />} />
          <Route path="finance" element={<FinanceTreasury />} />
          <Route path="finance/fee-setup" element={<FinanceFeeSetup />} />
          <Route path="finance/invoices" element={<InvoiceManagement />} />
          <Route path="finance/ledger" element={<StudentLedger />} />
          <Route path="finance/arrears" element={<ArrearsManagement />} />
          <Route path="finance/expenses" element={<ExpensesPage />} />
          <Route path="finance/transactions/new" element={<RecordTransactionPage />} />
          <Route path="community" element={<CommunityEthos />} />
          <Route path="compliance" element={<ComplianceCenter />} />
          <Route path="system" element={<SystemControl />} />
          <Route path="academic/setup" element={<AcademicSetup />} />
          <Route path="academic/grading" element={<Navigate to="/admin/academic/exam-workflow" replace />} />
          <Route path="academic/timetables" element={<Timetables />} />
          <Route path="academic/exams" element={<Examinations />} />
          <Route path="academic/exam-workflow" element={<ExamWorkflow />} />
          <Route path="academic/mark-status" element={<MarkFillStatus />} />
          <Route path="academic/curriculum" element={<CurriculumCoverage />} />
          <Route path="operations/discipline" element={<DisciplineAndTransfers />} />
          <Route path="operations/faculty-performance" element={<FacultyPerformance />} />
          <Route path="community/communications" element={<Communications />} />
          <Route path="compliance/reports" element={<PerformanceReports />} />
          <Route path="attendance" element={<AttendanceDashboard />} />
          <Route path="academic/promotions" element={<StudentPromotion />} />
          <Route path="academic/report-cards" element={<ReportCardManagement />} />
          <Route path="academic/id-cards" element={<IDCardGenerator />} />
          <Route path="academic/analytics" element={<AcademicAnalytics />} />
          <Route path="year-review" element={<SchoolYearReview />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherLayout />
          </ProtectedRoute>
        }>
          <Route index element={<TeacherDashboardHome />} />
          <Route path="timetable" element={<TeacherTimetablePage />} />
          <Route path="logbook" element={<TeacherLogbookPage />} />
          <Route path="coverage" element={<TeacherCoveragePage />} />
          <Route path="planner" element={<TeacherPlannerPage />} />
          <Route path="assessments" element={<TeacherAssessmentsPage />} />
          <Route path="settings" element={<TeacherSettingsPage />} />
          <Route path="profile" element={<TeacherProfileEdit />} />
        </Route>
        
        <Route path="/parent" element={
          <ProtectedRoute allowedRoles={['parent']}>
            <ParentLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ParentDashboard />} />
          <Route path="fees" element={<ParentFees />} />
          <Route path="reports" element={<ParentReports />} />
          <Route path="analytics" element={<ParentAnalytics />} />
          <Route path="settings" element={<ParentSettings />} />
          <Route path="child/:childId" element={<ParentChildDetail />} />
        </Route>
        
        <Route path="/bursar" element={
          <ProtectedRoute allowedRoles={['bursar', 'super_admin']}>
            <BursarLayout />
          </ProtectedRoute>
        }>
          <Route index element={<BursarDashboard />} />
          <Route path="transactions/new" element={<RecordTransactionPage />} />
          <Route path="invoices" element={<InvoiceManagement />} />
          <Route path="ledger" element={<StudentLedger />} />
          <Route path="arrears" element={<ArrearsManagement />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="settings" element={<BursarSettings />} />
        </Route>
        
        <Route path="/gov" element={
          <ProtectedRoute allowedRoles={['government']}>
            <GovLayout />
          </ProtectedRoute>
        }>
          <Route index element={<GovDashboard />} />
          <Route path="regions" element={<GovRegions />} />
          <Route path="monitoring" element={<GovMonitoring />} />
          <Route path="compliance" element={<GovCompliance />} />
          <Route path="alerts" element={<GovAlerts />} />
          <Route path="inspections" element={<GovInspections />} />
          <Route path="policy" element={<GovPolicy />} />
          <Route path="support" element={<GovSupport />} />
        </Route>

        <Route path="/unauthorized" element={
          <PlaceholderDashboard title="Unauthorized. You do not have access to this portal." />
        } />
      </Routes>
    </BrowserRouter>
  );
}
