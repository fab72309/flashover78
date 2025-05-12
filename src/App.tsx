import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RootRedirect from './pages/RootRedirect';
import Layout from './components/Layout';
import AuthLayout from './components/AuthLayout';
import Home from './pages/Home';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import AddNews from './pages/AddNews';
import Calendar from './pages/Calendar';
import AddEvent from './pages/AddEvent';
import Brulage from './pages/Brulage';
import BrulageMlb from './pages/BrulageMlb';
import Resources from './pages/Resources';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Account from './pages/Account';
import Login from './pages/Login';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Routes d'authentification - sans sidebar ni navigation */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<AuthLayout />}>
              <Route index element={<Login />} />
            </Route>
            {/* Redirections des anciennes routes vers les nouvelles */}
            <Route path="/accueil" element={<Navigate to="/app" replace />} />
            <Route path="/news" element={<Navigate to="/app/news" replace />} />
            <Route path="/calendar" element={<Navigate to="/app/calendar" replace />} />
            <Route path="/brulage" element={<Navigate to="/app/brulage" replace />} />
            <Route path="/resources" element={<Navigate to="/app/resources" replace />} />
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
            
            {/* Routes protégées avec layout principal */}
            <Route path="/app" element={<Layout />}>
              
              {/* Route par défaut - affiche la page d'accueil */}
              <Route index element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              
              <Route path="news">
                <Route index element={
                  <ProtectedRoute>
                    <News />
                  </ProtectedRoute>
                } />
                <Route path="add" element={
                  <ProtectedRoute>
                    <AddNews />
                  </ProtectedRoute>
                } />
                <Route path=":id" element={
                  <ProtectedRoute>
                    <NewsDetail />
                  </ProtectedRoute>
                } />
              </Route>
              
              <Route path="calendar" element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } />
              
              <Route path="calendar/add" element={
                <ProtectedRoute>
                  <AddEvent />
                </ProtectedRoute>
              } />
              
              <Route path="brulage" element={
                <ProtectedRoute>
                  <Brulage />
                </ProtectedRoute>
              } />
              
              <Route path="brulage/mlb" element={
                <ProtectedRoute>
                  <BrulageMlb />
                </ProtectedRoute>
              } />
              
              <Route path="resources" element={
                <ProtectedRoute>
                  <Resources />
                </ProtectedRoute>
              } />
              
              <Route path="dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              
              <Route path="account" element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
