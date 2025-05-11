import { cloneElement, type ReactElement, type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Calendar as CalendarIcon, Flame, Book, LayoutDashboard } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      // Hide nav on scroll down, show on scroll up
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY + 10) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY - 10 || currentScrollY < 50) {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className={`bg-white border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg px-1 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="safe-area-bottom container mx-auto">
        <div className="grid grid-cols-6 gap-0 py-1">
          <NavItem to="/" icon={<Home size={24} />} label="Accueil" isActive={isActive('/')} />
          <NavItem to="/news" icon={<BookOpen size={24} />} label="News" isActive={isActive('/news')} />
          <NavItem to="/calendar" icon={<CalendarIcon size={24} />} label="Calendrier" isActive={isActive('/calendar')} />
          <NavItem to="/brulage" icon={<Flame size={24} />} label="Brulage" isActive={isActive('/brulage')} />
          <NavItem to="/resources" icon={<Book size={24} />} label="Ressources" isActive={isActive('/resources')} />
          <NavItem to="/dashboard" icon={<LayoutDashboard size={24} />} label="TdB" isActive={isActive('/dashboard')} />
        </div>
      </div>
    </nav>
  );
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
}

function NavItem({ to, icon, label, isActive }: NavItemProps) {
  return (
    <Link 
      to={to}
      className={`flex flex-col items-center justify-center py-0.5 transition-all duration-200 ${
        isActive ? 'text-[#FF4500] translate-y-[-4px]' : 'text-gray-500'
      }`}
    >
      <div className="relative">
        <div className={`transition-transform duration-200 ${isActive ? 'scale-105' : ''}`}>
          <div className="w-5 h-5 sm:w-6 sm:h-6">
            {cloneElement(icon as ReactElement, {
              size: '100%',
              className: 'w-full h-full'
            })}
          </div>
        </div>
        {isActive && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#FF4500] rounded-full nav-dot" />
        )}
      </div>
      <span className={`text-[10px] sm:text-xs mt-0.5 font-medium ${isActive ? 'opacity-100' : 'opacity-70'
      }`}>
        {label}
      </span>
    </Link>
  );
}

export default Navigation;