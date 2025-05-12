import { Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Layout spécifique pour les pages d'authentification (login, inscription)
 * Sans sidebar ni navigation
 */
export default function AuthLayout() {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 flex items-center justify-center">
          <Outlet />
        </main>
        <footer className="py-4 text-center text-gray-500 text-sm">
          <p>© 2025 Flashover78. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  );
}
