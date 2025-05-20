import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

function Layout() {
  // Simplifions notre gestion - un seul état pour le sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDarkMode } = useTheme();

  // Fonction pour ouvrir le menu
  const handleMenuClick = () => {
    console.log('[Layout] handleMenuClick appelé, état actuel sidebar:', sidebarOpen);
    setSidebarOpen(true);
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Un seul Sidebar qui s'ouvre/ferme pour toutes les tailles d'écran */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-h-screen relative">
        <Header onMenuClick={handleMenuClick} />
        <main className="flex-1 mx-auto px-4 py-6 pb-28 transition-all w-full max-w-6xl"> 
          <Outlet />
        </main>
        <Navigation />
      </div>
    </div>
  );
}

export default Layout;