import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
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
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="news">
                <Route index element={<News />} />
                <Route path="add" element={<AddNews />} />
                <Route path=":id" element={<NewsDetail />} />
              </Route>
              <Route path="calendar" element={<Calendar />} />
              <Route path="calendar/add" element={<AddEvent />} />
              <Route path="brulage" element={<Brulage />} />
              <Route path="brulage/mlb" element={<BrulageMlb />} />
              <Route path="resources" element={<Resources />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;