import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CarFront,
  Flame,
  Home,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { APP_ROUTES } from '../utils/constants';

const moreDestinations = [
  { to: APP_ROUTES.CARPOOL, label: 'Co-voiturage', icon: <CarFront size={21} /> },
  { to: APP_ROUTES.RESOURCES, label: 'Documents', icon: <BookOpen size={21} /> },
  { to: APP_ROUTES.DASHBOARD, label: 'Tableau de bord', icon: <BarChart3 size={21} /> },
  { to: APP_ROUTES.SETTINGS, label: 'Paramètres', icon: <Settings size={21} /> },
];

function Navigation() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === APP_ROUTES.HOME
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const moreIsActive = moreDestinations.some((item) => isActive(item.to));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMoreOpen(false)}
            aria-label="Fermer le menu"
          />
          <section
            className="absolute inset-x-3 bottom-[6.8rem] rounded-lg border border-outline-variant bg-surface-container-lowest p-3 shadow-ambient-lg"
            aria-label="Navigation complémentaire"
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="text-headline-md text-on-surface">Plus</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
                aria-label="Fermer le menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreDestinations.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    'flex min-h-14 items-center gap-3 rounded-lg px-3 py-3 text-body-md font-semibold',
                    isActive(item.to)
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-on-surface',
                  ].join(' ')}
                  aria-current={isActive(item.to) ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden" aria-label="Navigation principale">
        <div className="glass mx-3 mb-3 rounded-lg border border-outline-variant/70 px-2 shadow-glass">
          <div className="safe-area-bottom mx-auto">
            <div className="grid grid-cols-4 gap-1 py-2">
              <NavItem
                to={APP_ROUTES.HOME}
                icon={<Home size={22} />}
                label="Accueil"
                isActive={isActive(APP_ROUTES.HOME)}
              />
              <NavItem
                to={APP_ROUTES.CALENDAR}
                icon={<CalendarDays size={22} />}
                label="Calendrier"
                isActive={isActive(APP_ROUTES.CALENDAR)}
              />
              <NavItem
                to={APP_ROUTES.BRULAGE}
                icon={<Flame size={22} />}
                label="Brûlage"
                isActive={isActive(APP_ROUTES.BRULAGE)}
              />
              <button
                type="button"
                onClick={() => setMoreOpen((current) => !current)}
                className={[
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5',
                  moreIsActive || moreOpen ? 'bg-primary/10 text-primary' : 'text-on-surface-variant',
                ].join(' ')}
                aria-expanded={moreOpen}
                aria-label="Ouvrir les autres rubriques"
              >
                <Menu size={22} strokeWidth={moreIsActive || moreOpen ? 2.5 : 1.8} />
                <span className="text-[11px] font-semibold">Plus</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
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
      className={[
        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5',
        isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}

export default Navigation;
