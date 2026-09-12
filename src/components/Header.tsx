import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { APP_ROUTES, LOGO_PATHS } from '../utils/constants';

interface HeaderProps {
  onMenuClick: () => void;
}

function Header({ onMenuClick }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  const titles: { [key: string]: string } = {
    '/app': 'Accueil',
    '/app/calendar': 'Calendrier',
    '/app/brulage': 'Brulage',
    '/app/resources': 'Ressources',
    '/app/dashboard': 'Tableau de bord',
    '/app/carpool': 'Co-voiturage',
    '/app/settings': 'Paramètres',
    '/app/account': 'Mon Compte',
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHome = location.pathname === '/app';
  const currentTitle = Object.entries(titles).find(([path]) =>
    path === APP_ROUTES.HOME
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`)
  )?.[1] || 'Flashover78';

  return (
    <header className={`sticky top-0 z-40 flex items-center justify-between px-4 py-3 transition-all duration-300 sm:px-6 lg:px-8 lg:py-5 ${
      isHome ? 'lg:hidden' : ''
    } ${
      isScrolled
        ? 'glass shadow-glass'
        : 'bg-surface lg:bg-transparent'
    }`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-squircle-sm bg-surface-container-high hover:bg-surface-container-highest transition-colors lg:hidden"
          aria-label="Menu"
        >
          <Menu size={20} className="text-on-surface" />
        </button>

        {isHome && (
          <div className="flex items-center gap-2.5 lg:hidden">
            <img
              src={LOGO_PATHS.default}
              alt="Logo"
              className="w-8 h-8 rounded-full object-contain"
            />
            <span className="text-headline-md text-primary font-bold tracking-tight">
              FLASHOVER 78
            </span>
          </div>
        )}

        {!isHome && (
          <h1 className="text-headline-md text-on-surface lg:hidden">
            {currentTitle}
          </h1>
        )}

        <div className="hidden lg:block">
          <p className="text-label-sm uppercase tracking-[0.18em] text-primary">
            Flashover 78
          </p>
          <h1 className="mt-1 text-display-sm text-on-surface">
            {currentTitle}
          </h1>
        </div>
      </div>

    </header>
  );
}

export default Header;
