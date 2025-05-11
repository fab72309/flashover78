import { cloneElement, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useFirestore';
import type { NewsPost } from '../types';
import { 
  Home, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Flame, 
  Book, 
  LayoutDashboard,
  X,
  Settings,
  HelpCircle,
  User as UserIcon,
  LogOut,
  LogIn
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: ReactNode;
  label: string;
  path: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  // Prevent scrolling when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && target.closest('.sidebar-content') === null) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, onClose]);
  
  const menuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Accueil', path: '/' },
    { icon: <BookOpen size={20} />, label: 'News', path: '/news' },
    { icon: <CalendarIcon size={20} />, label: 'Calendrier', path: '/calendar' },
    { icon: <Flame size={20} />, label: 'Brulage', path: '/brulage' },
    { icon: <Book size={20} />, label: 'Ressources', path: '/resources' },
    { icon: <LayoutDashboard size={20} />, label: 'Tableau de bord', path: '/dashboard' },
  ];

  const handleGoogleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('Tentative de connexion avec Google depuis le sidebar...');
      signInWithGoogleRedirect();
    } catch (err) {
      console.error('Google sign-in error from sidebar:', err);
      alert('Erreur lors de la connexion avec Google');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 h-full w-[280px] bg-white z-[101] transform transition-transform duration-300 ease-in-out shadow-xl sidebar-content ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center px-6 py-3 hover:bg-gray-100 transition-colors ${
                  location.pathname === item.path ? 'text-[#FF4500] bg-orange-50' : 'text-gray-600'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </Link>
            ))}
            
            <div className="border-t my-2"></div>
            
            <Link
              to="/settings"
              onClick={onClose}
              className="flex items-center px-6 py-3 hover:bg-gray-100 transition-colors text-gray-600"
            >
              <Settings size={20} />
              <span className="ml-3">Paramètres</span>
            </Link>
            
            <Link
              to="/help"
              onClick={onClose}
              className="flex items-center px-6 py-3 hover:bg-gray-100 transition-colors text-gray-600"
            >
              <HelpCircle size={20} />
              <span className="ml-3">Aide</span>
            </Link>
          </nav>
        </div>
        {/* User Menu */}
        <div className="border-t p-4 bg-gray-50">
          {user ? (
            <div className="flex items-center gap-3">
              <UserIcon size={28} className="text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{user.displayName || user.email}</div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
              <button
                onClick={async () => { await logout(); onClose(); }}
                className="ml-2 p-2 rounded-full hover:bg-gray-200 transition-colors"
                title="Se déconnecter"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onClose(); window.location.href = '/login'; }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#FF4500] text-white rounded-lg hover:bg-[#FF4500]/90 transition-colors"
            >
              <LogIn size={20} />
              Se connecter
            </button>
          )}
        </div>
      </div>
    </>
  );
}