import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { api } from './services/api';

// Public + auth pages stay eagerly loaded for instant first paint.
import Login from './pages/Login';
import GovLogin from './pages/auth/GovLogin';
import ParentLogin from './pages/auth/ParentLogin';
import TeacherLogin from './pages/auth/TeacherLogin';
import AdminLogin from './pages/auth/AdminLogin';
import BursarLogin from './pages/auth/BursarLogin';
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import TrustPage from './pages/public/TrustPage';
import ReceiptVerify from './pages/public/ReceiptVerify';
import SchoolTemplate from './pages/public/SchoolTemplate';
import SchoolsList from './pages/public/SchoolsList';
import SchoolProfile from './pages/public/SchoolProfile';
import TeacherMarketplace from './pages/public/TeacherMarketplace';
import ForcePasswordChange from './pages/ForcePasswordChange';
import { useAuthStore } from './stores/authStore';
import ToastContainer from './components/ui/ToastContainer';
import ThemeBridge from './components/ui/ThemeBridge';
import { useTenantTheme } from './hooks/useTenantTheme';

// Portal pages — code-split so each portal loads its own chunk on demand.
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const DashboardHome = lazy(() => import('./pages/admin/dashboard/DashboardHome'));
const AcademicManagement = lazy(() => import('./pages/admin/academic/AcademicManagement'));
const OperationsCenter = lazy(() => import('./pages/admin/operations/OperationsCenter'));
const FinanceTreasury = lazy(() => import('./pages/admin/finance/FinanceTreasury'));
const FinanceFeeSetup = lazy(() => import('./pages/admin/finance/FinanceFeeSetup'));
const InvoiceManagement = lazy(() => import('./pages/admin/finance/InvoiceManagement'));
const StudentLedger = lazy(() => import('./pages/admin/finance/StudentLedger'));
const ArrearsManagement = lazy(() => import('./pages/admin/finance/ArrearsManagement'));
const ExpensesPage = lazy(() => import('./pages/admin/finance/ExpensesPage'));
const CommunityEthos = lazy(() => import('./pages/admin/community/CommunityEthos'));
const ComplianceCenter = lazy(() => import('./pages/admin/compliance/ComplianceCenter'));
const SystemControl = lazy(() => import('./pages/admin/system/SystemControl'));
const AcademicSetup = lazy(() => import('./pages/admin/academic/AcademicSetup'));
const AuditLogs = lazy(() => import('./pages/admin/audit/AuditLogs'));
const Settings = lazy(() => import('./pages/admin/settings/Settings'));
const EmailSettings = lazy(() => import('./pages/admin/settings/EmailSettings'));
const Integrations = lazy(() => import('./pages/admin/settings/Integrations'));
const AddStudentPage = lazy(() => import('./pages/admin/academic/students/AddStudentPage'));
const EditStudentPage = lazy(() => import('./pages/admin/academic/students/EditStudentPage'));
const RecordTransactionPage = lazy(() => import('./pages/admin/finance/RecordTransactionPage'));
const AddFacultyPage = lazy(() => import('./pages/admin/operations/AddFacultyPage'));
const AddBursarPage = lazy(() => import('./pages/admin/operations/AddBursarPage'));
const AddParentPage = lazy(() => import('./pages/admin/operations/AddParentPage'));
const Timetables = lazy(() => import('./pages/admin/academic/Timetables'));
const Examinations = lazy(() => import('./pages/admin/academic/Examinations'));
const ExamWorkflow = lazy(() => import('./pages/admin/academic/ExamWorkflow'));
const MarkFillStatus = lazy(() => import('./pages/admin/academic/MarkFillStatus'));
const CurriculumCoverage = lazy(() => import('./pages/admin/academic/CurriculumCoverage'));
const DisciplineAndTransfers = lazy(() => import('./pages/admin/operations/DisciplineAndTransfers'));
const FacultyPerformance = lazy(() => import('./pages/admin/operations/FacultyPerformance'));
const Communications = lazy(() => import('./pages/admin/community/Communications'));
const PerformanceReports = lazy(() => import('./pages/admin/compliance/PerformanceReports'));
const AttendanceDashboard = lazy(() => import('./pages/admin/attendance/AttendanceDashboard'));
const StudentPromotion = lazy(() => import('./pages/admin/academic/StudentPromotion'));
const ReportCardManagement = lazy(() => import('./pages/admin/academic/ReportCardManagement'));
const IDCardGenerator = lazy(() => import('./pages/admin/academic/IDCardGenerator'));
const AcademicAnalytics = lazy(() => import('./pages/admin/academic/AcademicAnalytics'));
const TeacherDirectory = lazy(() => import('./pages/admin/operations/TeacherDirectory'));
const BulkImportStudents = lazy(() => import('./pages/admin/operations/BulkImportStudents'));
const BulkImportTeachers = lazy(() => import('./pages/admin/operations/BulkImportTeachers'));
const SchoolYearReview = lazy(() => import('./components/admin/SchoolYearReview'));

// Teacher Portal
const TeacherLayout = lazy(() => import('./components/layout/teacher/TeacherLayout'));
const TeacherDashboardHome = lazy(() => import('./pages/teacher/dashboard/TeacherDashboardHome'));
const TeacherLogbookPage = lazy(() => import('./pages/teacher/logbook/TeacherLogbookPage'));
const TeacherAssessmentsPage = lazy(() => import('./pages/teacher/assessments/TeacherAssessmentsPage'));
const TeacherTimetablePage = lazy(() => import('./pages/teacher/timetable/TeacherTimetablePage'));
const TeacherPlannerPage = lazy(() => import('./pages/teacher/planner/TeacherPlannerPage'));
const TeacherCoveragePage = lazy(() => import('./pages/teacher/coverage/TeacherCoveragePage'));
const TeacherSettingsPage = lazy(() => import('./pages/teacher/settings/TeacherSettingsPage'));
const TeacherProfileEdit = lazy(() => import('./pages/teacher/settings/TeacherProfileEdit'));

const ParentLayout = lazy(() => import('./components/layout/parent/ParentLayout'));
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard'));
const ParentFees = lazy(() => import('./pages/parent/ParentFees'));
const ParentReceipts = lazy(() => import('./pages/parent/ParentReceipts'));
const ParentReports = lazy(() => import('./pages/parent/ParentReports'));
const ParentAnalytics = lazy(() => import('./pages/parent/ParentAnalytics'));
const ParentSettings = lazy(() => import('./pages/parent/ParentSettings'));
const ParentChildDetail = lazy(() => import('./pages/parent/ParentChildDetail'));

const GovLayout = lazy(() => import('./components/layout/gov/GovLayout'));
const GovDashboard = lazy(() => import('./pages/gov/GovDashboard'));
const GovRegions = lazy(() => import('./pages/gov/GovRegions'));
const GovMonitoring = lazy(() => import('./pages/gov/GovMonitoring'));
const GovCompliance = lazy(() => import('./pages/gov/GovCompliance'));
const GovAlerts = lazy(() => import('./pages/gov/GovAlerts'));
const GovInspections = lazy(() => import('./pages/gov/GovInspections'));
const GovPolicy = lazy(() => import('./pages/gov/GovPolicy'));
const GovSupport = lazy(() => import('./pages/gov/GovSupport'));

// Bursar Portal
const BursarLayout = lazy(() => import('./components/layout/bursar/BursarLayout'));
const BursarDashboard = lazy(() => import('./pages/bursar/BursarDashboard'));
const BursarSettings = lazy(() => import('./pages/bursar/BursarSettings'));

// Temporary placeholder components for other portals
const PageLoader = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center text-primary">
    <span className="text-sm font-medium">Loading…</span>
  </div>
);

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
  const location = useLocation();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Force password change before accessing any portal
  if (user?.must_change_password && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />;
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
  
  if (user?.must_change_password) return <Navigate to="/force-password-change" replace />;
  if (user?.is_platform_admin) return <Navigate to="/admin/system" replace />;
  
  const rolesList = roles.map(r => r.role);
  if (rolesList.includes('teacher')) return <Navigate to="/teacher" replace />;
  if (rolesList.includes('bursar')) return <Navigate to="/bursar" replace />;
  if (rolesList.includes('admin') || rolesList.includes('super_admin')) return <Navigate to="/admin" replace />;
  if (rolesList.includes('parent')) return <Navigate to="/parent" replace />;
  if (rolesList.includes('government')) return <Navigate to="/gov" replace />;
  
  return <Navigate to="/unauthorized" replace />;
};

// Scroll Manager - scrolls to top on route change, or to a #hash section if present
const ScrollManager = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return null;
};

export default function App() {
  const token = useAuthStore(state => state.token);
  const setAuth = useAuthStore(state => state.setAuth);
  const logout = useAuthStore(state => state.logout);
  const tenants = useAuthStore(state => state.tenants);

  useTenantTheme();

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me/').then(({ data }) => {
      const { roles } = data;
      const user = { ...data, roles: undefined };
      setAuth(token, useAuthStore.getState().refreshToken || '', user, tenants.length > 0 ? tenants : data.tenants || [], roles);
    }).catch(() => {
      logout();
    });
  }, []);

  return (
    <BrowserRouter>
      <ThemeBridge />
      <ToastContainer />
      <ScrollManager />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/verify-receipt" element={<ReceiptVerify />} />
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
        <Route path="/force-password-change" element={<ProtectedRoute><ForcePasswordChange /></ProtectedRoute>} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="academic" element={<AcademicManagement />} />
          <Route path="academic/students/new" element={<AddStudentPage />} />
          <Route path="academic/students/:id/edit" element={<EditStudentPage />} />
          <Route path="academic/students/import" element={<BulkImportStudents />} />
          <Route path="operations" element={<OperationsCenter />} />
          <Route path="operations/faculty" element={<TeacherDirectory />} />
          <Route path="operations/faculty/new" element={<AddFacultyPage />} />
          <Route path="operations/bursars/new" element={<AddBursarPage />} />
          <Route path="operations/parents/new" element={<AddParentPage />} />
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
          <Route path="settings/email" element={<EmailSettings />} />
          <Route path="settings/integrations" element={<Integrations />} />
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
          <Route path="receipts" element={<ParentReceipts />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
