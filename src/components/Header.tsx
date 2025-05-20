import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, Settings, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

function Header({ onMenuClick }: HeaderProps) {
  // Log pour débogage
  console.log('[Header] onMenuClick est défini:', !!onMenuClick);

  // Nous gardons uniquement le state pour l'effet de scroll
  const [isScrolled, setIsScrolled] = useState(false);
  const { } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const titles: { [key: string]: string } = {
    '/app': 'Accueil',
    '/app/news': 'News',
    '/app/calendar': 'Calendrier',
    '/app/brulage': 'Brulage',
    '/app/resources': 'Ressources',
    '/app/dashboard': 'Tableau de bord',
    '/app/settings': 'Paramètres',
    '/app/account': 'Mon Compte'
  };

  useEffect(() => {
    // Nous n'avons plus besoin de détecter la taille de l'écran car tous les boutons sont visibles

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    // Nous n'avons plus besoin de l'événement resize
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      // Nettoyage simplifié
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <header className={`bg-[#FF4500] text-white p-4 flex items-center justify-between sticky top-0 z-40 ${isScrolled ? 'shadow-md' : ''} transition-shadow`}>
        <div className="flex items-center">
          <button 
            onClick={() => {
              console.log('[Header] Bouton hamburger cliqué');
              if (onMenuClick) onMenuClick();
            }}
            className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors bg-white text-[#FF4500]"
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-semibold ml-3">{titles[location.pathname] || 'Flashover78'}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate('/app/news')}
            className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors" 
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={20} />
          </button>
          
          <button 
            onClick={() => navigate('/app/search')}
            className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors" 
            aria-label="Rechercher"
            title="Rechercher"
          >
            <Search size={20} />
          </button>
          
          <button 
            onClick={() => navigate('/app/settings')}
            className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors" 
            aria-label="Paramètres"
            title="Paramètres"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
    </>
  );
}

export default Header;