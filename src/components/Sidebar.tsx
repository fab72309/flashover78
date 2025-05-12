import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  
  // S'assurer que l'état d'authentification est stable avant d'afficher
  useEffect(() => {
    if (!loading) {
      setAuthChecked(true);
    }
  }, [loading]);
  
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
    const handleOutsideClick = (e: Event) => {
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
  

  // Affiche l'utilisateur dans la console pour le débogage
  console.log('[Sidebar] user:', user);
  console.log('[Sidebar] isOpen:', isOpen);
  
  const menuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Accueil', path: '/app' },
    { icon: <BookOpen size={20} />, label: 'News', path: '/app/news' },
    { icon: <CalendarIcon size={20} />, label: 'Calendrier', path: '/app/calendar' },
    { icon: <Flame size={20} />, label: 'Brulage', path: '/app/brulage' },
    { icon: <Book size={20} />, label: 'Ressources', path: '/app/resources' },
    { icon: <LayoutDashboard size={20} />, label: 'Tableau de bord', path: '/app/dashboard' },
  ];

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
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
              {/* Indicateur de statut utilisateur pour débogage */}
              <div className="text-xs mt-1">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${user ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>{user ? 'Connecté' : 'Non connecté'}</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Affichage des informations utilisateur en haut */}
          {!loading && authChecked && user && (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500]">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{user.displayName || 'Utilisateur'}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div className="px-4 py-3 border-b text-center">
              <div className="animate-pulse bg-gray-200 h-10 w-10 rounded-full mx-auto mb-2"></div>
              <div className="animate-pulse bg-gray-200 h-4 w-24 mx-auto"></div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-2">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                onClick={() => {
                  // Fermer explicitement le sidebar
                  onClose();
                }}
                className={`flex items-center px-6 py-3 hover:bg-gray-100 transition-colors ${location.pathname === item.path ? 'bg-[#FF4500]/10 text-[#FF4500] font-medium' : 'text-gray-600'}`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </Link>
            ))}
            
            <div className="mt-4 border-t pt-4">
              <Link
                to="/app/settings"
                onClick={() => {
                  // Fermer explicitement le sidebar
                  onClose();
                }}
                className="flex items-center px-6 py-3 hover:bg-gray-100 transition-colors text-gray-600"
              >
                <Settings size={20} />
                <span className="ml-3">Paramètres</span>
              </Link>
              
              <Link
                to="/app/help"
                onClick={() => {
                  // Fermer explicitement le sidebar
                  onClose();
                }}
                className="flex items-center px-6 py-3 hover:bg-gray-100 transition-colors text-gray-600"
              >
                <HelpCircle size={20} />
                <span className="ml-3">Aide</span>
              </Link>
            </div>
          </nav>
          {/* Espace pour séparer la navigation du footer */}
          <div className="flex-grow"></div>
          {/* User Menu toujours en bas */}
          <div className="border-t p-4 bg-gray-50">
            {!loading && authChecked && user ? (
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500 font-medium">Connecté en tant que</div>
                  <button
                    onClick={async () => { await logout(); onClose(); }}
                    className="flex items-center gap-1 text-sm text-[#FF4500] hover:underline"
                    title="Se déconnecter"
                  >
                    <LogOut size={16} />
                    <span>Déconnexion</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500]">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{user.displayName || 'Utilisateur'}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center py-2">
                <div className="animate-pulse bg-gray-200 h-10 w-10 rounded-full mb-2"></div>
                <div className="animate-pulse bg-gray-200 h-4 w-32 mb-2"></div>
                <div className="animate-pulse bg-gray-200 h-3 w-24"></div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-gray-400 py-2">
                <UserIcon size={36} className="mb-2" />
                <div className="text-sm mb-3">Utilisateur non identifié</div>
                <button
                  onClick={() => { onClose(); window.location.href = '/login'; }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#FF4500] text-white rounded-lg hover:bg-[#FF4500]/90 transition-colors"
                >
                  <LogIn size={18} />
                  Se connecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}