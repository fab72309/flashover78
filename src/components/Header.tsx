import { useState, useEffect } from 'react';
import { Menu, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';

function Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const titles: { [key: string]: string } = {
    '/': 'Accueil',
    '/news': 'News',
    '/calendar': 'Calendrier',
    '/brulage': 'Brulage',
    '/resources': 'Ressources',
    '/dashboard': 'Tableau de bord'
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <header className={`bg-[#FF4500] text-white p-4 flex items-center justify-between sticky top-0 z-40 ${isScrolled ? 'shadow-md' : ''} transition-shadow`}>
        <div className="flex items-center">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-semibold ml-3">{titles[location.pathname] || 'Flashover78'}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {!isMobile && location.pathname !== '/news' && (
            <button 
              onClick={() => navigate('/news')}
              className="p-2 hover:bg-[#ff4500]/90 rounded-lg transition-colors" 
              aria-label="Rechercher"
            >
              <Search size={20} />
            </button>
          )}
        </div>
      </header>
      
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </>
  );
}

export default Header;