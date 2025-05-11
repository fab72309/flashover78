import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Header from './Header';
import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

function Layout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <main className={`flex-1 mx-auto px-4 py-6 pb-28 transition-all w-full ${isMobile ? 'max-w-full' : 'max-w-6xl'}`}>
        <Outlet />
      </main>
      <Navigation />
    </div>
  );
}

export default Layout;