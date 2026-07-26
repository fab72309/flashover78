import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar as CalendarIcon,
  Flame,
  Book,
  LayoutDashboard,
  CarFront,
  X,
  Settings,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APP_ROUTES, LOGO_PATHS } from '../utils/constants';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  desktopWidth: number;
  isDesktopCollapsed: boolean;
  onDesktopWidthChange: (width: number) => void;
  onDesktopCollapsedChange: (collapsed: boolean) => void;
}

interface MenuItem {
  icon: ReactNode;
  label: string;
  path: string;
}

const MIN_DESKTOP_WIDTH = 232;
const MAX_DESKTOP_WIDTH = 380;
const COLLAPSED_DESKTOP_WIDTH = 88;

export default function Sidebar({
  isOpen,
  onClose,
  desktopWidth,
  isDesktopCollapsed,
  onDesktopWidthChange,
  onDesktopCollapsedChange
}: SidebarProps) {
  const { user, logout, loading } = useAuth();
  const location = useLocation();

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

  const menuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Accueil', path: APP_ROUTES.HOME },
    { icon: <CalendarIcon size={20} />, label: 'Calendrier', path: APP_ROUTES.CALENDAR },
    { icon: <CarFront size={20} />, label: 'Co-voiturage', path: APP_ROUTES.CARPOOL },
    { icon: <Flame size={20} />, label: 'Brulage', path: APP_ROUTES.BRULAGE },
    { icon: <Book size={20} />, label: 'Ressources', path: APP_ROUTES.RESOURCES },
    { icon: <LayoutDashboard size={20} />, label: 'Tableau de bord', path: APP_ROUTES.DASHBOARD },
  ];
  const isActive = (path: string) =>
    path === APP_ROUTES.HOME
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const effectiveDesktopWidth = isDesktopCollapsed ? COLLAPSED_DESKTOP_WIDTH : desktopWidth;

  const startDesktopResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onDesktopCollapsedChange(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(MAX_DESKTOP_WIDTH, Math.max(MIN_DESKTOP_WIDTH, moveEvent.clientX));
      onDesktopWidthChange(nextWidth);
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
  };

  const collapsedLabelClass = isDesktopCollapsed ? 'lg:hidden' : '';
  const collapsedCenterClass = isDesktopCollapsed ? 'lg:justify-center lg:px-0' : '';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-on-surface/40 z-[100] transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-[300px] bg-surface-container-lowest z-[101] transform transition-[width,transform] duration-300 ease-in-out shadow-ambient-lg sidebar-content rounded-r-squircle-lg lg:w-[var(--desktop-sidebar-width)] lg:translate-x-0 lg:rounded-none lg:border-r lg:border-outline-variant/70 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ '--desktop-sidebar-width': `${effectiveDesktopWidth}px` } as CSSProperties}
      >
        <button
          type="button"
          onPointerDown={startDesktopResize}
          className="group absolute -right-3 top-0 hidden h-full w-6 cursor-col-resize items-center justify-center lg:flex"
          aria-label="Redimensionner le menu"
          title="Glisser pour redimensionner"
        >
          <span className="flex h-14 w-5 items-center justify-center rounded-full border border-outline-variant/80 bg-surface-container-lowest text-on-surface-variant opacity-0 shadow-ambient-sm transition-opacity group-hover:opacity-100">
            <GripVertical size={14} />
          </span>
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className={`flex items-center justify-between gap-2 p-5 ${isDesktopCollapsed ? 'lg:flex-col lg:px-3' : ''}`}>
            <div className={`flex min-w-0 items-center gap-3 ${isDesktopCollapsed ? 'lg:flex-col' : ''}`}>
              <img
                src={LOGO_PATHS.default}
                alt="Logo Flashover 78"
                className="h-10 w-10 rounded-full object-contain"
              />
              <div className={collapsedLabelClass}>
                <h2 className="text-headline-md text-on-surface">Menu</h2>
                <p className="hidden text-label-sm uppercase tracking-[0.16em] text-primary lg:block">
                  SDIS 78
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDesktopCollapsedChange(!isDesktopCollapsed)}
              className="hidden p-2 hover:bg-surface-container-high rounded-squircle-sm transition-colors lg:inline-flex"
              aria-label={isDesktopCollapsed ? 'Déplier le menu' : 'Rétracter le menu'}
              title={isDesktopCollapsed ? 'Déplier le menu' : 'Rétracter le menu'}
            >
              {isDesktopCollapsed ? (
                <ChevronRight size={18} className="text-on-surface-variant" />
              ) : (
                <ChevronLeft size={18} className="text-on-surface-variant" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-container-high rounded-squircle-sm transition-colors lg:hidden"
              aria-label="Fermer le menu"
            >
              <X size={20} className="text-on-surface-variant" />
            </button>
          </div>

          {/* User info */}
          {!loading && user && (
            <div className={`px-5 py-4 mx-4 bg-surface-container rounded-squircle ${isDesktopCollapsed ? 'lg:px-2' : ''}`}>
              <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'lg:justify-center' : ''}`}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-11 h-11 rounded-full" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`flex-1 min-w-0 ${collapsedLabelClass}`}>
                  <div className="font-semibold text-on-surface truncate">{user.displayName || 'Utilisateur'}</div>
                  <div className="text-label-sm text-on-surface-variant truncate">{user.email}</div>
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div className={`px-5 py-4 mx-4 bg-surface-container rounded-squircle ${isDesktopCollapsed ? 'lg:px-2' : ''}`}>
              <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'lg:justify-center' : ''}`}>
                <div className="animate-pulse bg-surface-container-high w-11 h-11 rounded-full"></div>
                <div className={`flex-1 ${collapsedLabelClass}`}>
                  <div className="animate-pulse bg-surface-container-high h-4 w-24 rounded mb-1"></div>
                  <div className="animate-pulse bg-surface-container-high h-3 w-32 rounded"></div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 mt-2">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                onClick={onClose}
                title={isDesktopCollapsed ? item.label : undefined}
                className={`flex items-center mx-3 px-4 py-3 rounded-squircle-sm transition-all duration-200 ${collapsedCenterClass} ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {item.icon}
                <span className={`ml-3 text-body-lg ${collapsedLabelClass}`}>{item.label}</span>
              </Link>
            ))}

            <div className="mt-6 mx-5 pt-4" style={{ borderTop: '1px solid var(--outline-variant)' }}>
              <Link
                to={APP_ROUTES.SETTINGS}
                onClick={onClose}
                title={isDesktopCollapsed ? 'Paramètres' : undefined}
                className={`flex items-center px-4 py-3 rounded-squircle-sm text-on-surface-variant hover:bg-surface-container transition-colors ${collapsedCenterClass}`}
              >
                <Settings size={20} />
                <span className={`ml-3 text-body-lg ${collapsedLabelClass}`}>Paramètres</span>
              </Link>
            </div>
          </nav>

          {/* Footer */}
          <div className={`p-4 mx-3 mb-3 bg-surface-container rounded-squircle ${isDesktopCollapsed ? 'lg:px-2' : ''}`}>
            {!loading && user ? (
              <div className={`flex items-center justify-between ${isDesktopCollapsed ? 'lg:justify-center' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-body-md text-on-surface truncate ${collapsedLabelClass}`}>{user.displayName || 'Utilisateur'}</span>
                </div>
                <button
                  onClick={async () => { await logout(); onClose(); }}
                  className={`flex items-center gap-1.5 text-label-lg text-primary hover:text-primary-dark transition-colors ${collapsedLabelClass}`}
                  title="Se déconnecter"
                >
                  <LogOut size={16} />
                  <span>Quitter</span>
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center gap-3">
                <div className="animate-pulse bg-surface-container-high w-8 h-8 rounded-full"></div>
                <div className={`animate-pulse bg-surface-container-high h-4 w-24 rounded ${collapsedLabelClass}`}></div>
              </div>
            ) : (
              <button
                onClick={() => { onClose(); window.location.href = APP_ROUTES.LOGIN; }}
                className="w-full flex items-center justify-center gap-2 py-2.5 btn-primary-gradient rounded-squircle-sm"
                title="Se connecter"
              >
                <LogIn size={18} />
                <span className={collapsedLabelClass}>Se connecter</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
