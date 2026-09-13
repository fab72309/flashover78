import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SupabaseConfigNotice from './components/SupabaseConfigNotice';
import LoadingSpinner from './components/LoadingSpinner';
import { APP_ROUTES } from './utils/constants';
import { isSupabaseConfigured } from './lib/supabase';
import { isDevAuthBypassEnabled } from './utils/devAuth';

const RootRedirect = lazy(() => import('./pages/RootRedirect'));
const Layout = lazy(() => import('./components/Layout'));
const AuthLayout = lazy(() => import('./components/AuthLayout'));
const Home = lazy(() => import('./pages/Home'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AddEvent = lazy(() => import('./pages/AddEvent'));
const Brulage = lazy(() => import('./pages/Brulage'));
const BrulageMlb = lazy(() => import('./pages/BrulageMlb'));
const BrulageMaf = lazy(() => import('./pages/BrulageMaf'));
const MedicalFollowUp = lazy(() => import('./pages/MedicalFollowUp'));
const MainCourante = lazy(() => import('./pages/MainCourante'));
const Resources = lazy(() => import('./pages/Resources'));
const AddResource = lazy(() => import('./pages/AddResource'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Account = lazy(() => import('./pages/Account'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Carpool = lazy(() => import('./pages/Carpool'));
const CarpoolPostDetail = lazy(() => import('./pages/CarpoolPostDetail'));
const TrainingSessionDetail = lazy(() => import('./pages/TrainingSessionDetail'));
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}

function App() {
  if (!isSupabaseConfigured && !isDevAuthBypassEnabled) {
    return (
      <ThemeProvider>
        <SupabaseConfigNotice />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route element={<AuthLayout />}>
                  <Route path={APP_ROUTES.LOGIN} element={<Login />} />
                  <Route path={APP_ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
                  <Route path={APP_ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
                </Route>

                <Route path="/accueil" element={<Navigate to={APP_ROUTES.HOME} replace />} />
                <Route path="/calendar" element={<Navigate to={APP_ROUTES.CALENDAR} replace />} />
                <Route path="/calendar/add" element={<Navigate to={APP_ROUTES.CALENDAR_ADD} replace />} />
                <Route path="/brulage" element={<Navigate to={APP_ROUTES.BRULAGE} replace />} />
                <Route path="/brulage/mlb" element={<Navigate to={APP_ROUTES.BRULAGE_MLB} replace />} />
                <Route path="/resources" element={<Navigate to={APP_ROUTES.RESOURCES} replace />} />
                <Route path="/dashboard" element={<Navigate to={APP_ROUTES.DASHBOARD} replace />} />
                <Route path="/settings" element={<Navigate to={APP_ROUTES.SETTINGS} replace />} />
                <Route path="/carpool" element={<Navigate to={APP_ROUTES.CARPOOL} replace />} />

                <Route
                  path={APP_ROUTES.HOME}
                  element={(
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  )}
                >
                  <Route index element={<Home />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="calendar/add" element={<AddEvent />} />
                  <Route path="calendar/session/:id" element={<TrainingSessionDetail />} />
                  <Route path="brulage" element={<Brulage />} />
                  <Route path="brulage/mlb" element={<BrulageMlb />} />
                  <Route path="brulage/maf" element={<BrulageMaf />} />
                  <Route path="brulage/suivi-medical" element={<MedicalFollowUp />} />
                  <Route path="brulage/suivi-medical/:trainerLevel" element={<MedicalFollowUp />} />
                  <Route path="brulage/main-courante" element={<MainCourante />} />
                  <Route path="resources" element={<Resources />} />
                  <Route path="resources/add" element={<AddResource />} />
                  <Route path="resources/document/:id" element={<DocumentDetail />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="settings" element={<Settings />} />
                  <Route
                    path="settings/users"
                    element={(
                      <ProtectedRoute requiredRole="admin">
                        <AdminUsers />
                      </ProtectedRoute>
                    )}
                  />
                  <Route path="account" element={<Account />} />
                  <Route path="carpool" element={<Carpool />} />
                  <Route path="carpool/:id" element={<CarpoolPostDetail />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
