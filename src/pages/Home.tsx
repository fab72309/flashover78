import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../utils/constants';
import {
  ArrowRight,
  Book,
  Calendar,
  CarFront,
  Flame,
  LayoutDashboard,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { listEvents, listMyTrips } from '../services/supabaseService';
import type { CalendarEvent } from '../types';

type InterfaceMode = 'mobile' | 'desktop';

const INTERFACE_MODE_STORAGE_KEY = 'flashover78-interface-mode';

function getInitialInterfaceMode(): InterfaceMode {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const storedMode = window.localStorage.getItem(INTERFACE_MODE_STORAGE_KEY);
  if (storedMode === 'mobile' || storedMode === 'desktop') {
    return storedMode;
  }

  return window.matchMedia('(max-width: 1023px)').matches ? 'mobile' : 'desktop';
}

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>(getInitialInterfaceMode);
  const [upcomingSessions, setUpcomingSessions] = useState<CalendarEvent[]>([]);
  const [pendingCarpoolRequests, setPendingCarpoolRequests] = useState(0);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const quickActions = [
    {
      title: 'Brulage',
      subtitle: 'Documents et référentiels opérationnels',
      icon: <Flame size={22} />,
      tone: 'primary' as const,
      route: APP_ROUTES.BRULAGE,
    },
    {
      title: 'Calendrier',
      subtitle: 'Sessions, rendez-vous et échéances',
      icon: <Calendar size={22} />,
      tone: 'surface' as const,
      route: APP_ROUTES.CALENDAR,
    },
    {
      title: 'Co-voiturage',
      subtitle: 'Proposer ou rejoindre un trajet',
      icon: <CarFront size={22} />,
      tone: 'tonal' as const,
      route: APP_ROUTES.CARPOOL,
    },
    {
      title: 'Ressources',
      subtitle: 'Supports, lectures et documents utiles',
      icon: <Book size={22} />,
      tone: 'tonal' as const,
      route: APP_ROUTES.RESOURCES,
    },
    {
      title: 'Tableau de bord',
      subtitle: 'Statistiques et indicateurs de suivi',
      icon: <LayoutDashboard size={22} />,
      tone: 'tonal' as const,
      route: APP_ROUTES.DASHBOARD,
    },
  ];
  const secondaryActions = quickActions.slice(1);

  useEffect(() => {
    window.localStorage.setItem(INTERFACE_MODE_STORAGE_KEY, interfaceMode);
  }, [interfaceMode]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(false);

      try {
        const [events, myTrips] = await Promise.all([
          listEvents(),
          listMyTrips(user.id),
        ]);
        const now = new Date();
        const horizon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        const sessions = events
          .filter((event) => event.date >= now && event.date <= horizon)
          .sort((first, second) => first.date.getTime() - second.date.getTime())
          .slice(0, 3);
        const pendingRequests = myTrips
          .flatMap((trip) => trip.requests)
          .filter((request) => request.status === 'pending').length;

        if (isMounted) {
          setUpcomingSessions(sessions);
          setPendingCarpoolRequests(pendingRequests);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setOverviewError(true);
        }
      } finally {
        if (isMounted) {
          setOverviewLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <div className="space-y-5 fade-in lg:space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-surface-container-lowest px-5 py-5 shadow-ambient-sm sm:px-6 lg:rounded-[2.25rem] lg:px-8 lg:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(173,44,0,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(238,238,240,0.72))]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:gap-5">
          <div className="max-w-3xl">
            <h1 className="text-display-sm text-on-surface lg:text-display-md">
              Accueil Flashover 78
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setInterfaceMode(interfaceMode === 'mobile' ? 'desktop' : 'mobile')}
            className="inline-flex items-center gap-2 self-start rounded-full border border-outline-variant/70 bg-white/70 px-3 py-2 text-label-lg font-semibold text-on-surface-variant shadow-ambient-sm transition-colors hover:bg-white sm:self-auto lg:hidden"
            aria-label={interfaceMode === 'mobile' ? 'Basculer vers l’interface PC' : 'Basculer vers l’interface mobile'}
          >
            {interfaceMode === 'mobile' ? <Monitor size={17} /> : <Smartphone size={17} />}
            {interfaceMode === 'mobile' ? 'Interface PC' : 'Interface mobile'}
          </button>
          <div
            className="hidden items-center gap-1 rounded-lg border border-outline-variant/70 bg-surface-container-lowest/80 p-1 shadow-ambient-sm lg:flex"
            role="group"
            aria-label="Mode d’affichage"
          >
            <button
              type="button"
              onClick={() => setInterfaceMode('mobile')}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                interfaceMode === 'mobile'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              aria-label="Afficher l’interface mobile"
              aria-pressed={interfaceMode === 'mobile'}
              title="Interface mobile"
            >
              <Smartphone size={17} />
            </button>
            <button
              type="button"
              onClick={() => setInterfaceMode('desktop')}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                interfaceMode === 'desktop'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              aria-label="Afficher l’interface PC"
              aria-pressed={interfaceMode === 'desktop'}
              title="Interface PC"
            >
              <Monitor size={17} />
            </button>
          </div>
        </div>
      </section>

      <section className={interfaceMode === 'mobile' ? 'mx-auto w-full max-w-xl space-y-3' : 'hidden'}>
        {quickActions.map((action) => (
          <button
            key={action.route}
            onClick={() => navigate(action.route)}
            className={[
              'group flex w-full items-center gap-4 rounded-squircle border border-outline-variant/70 p-4 text-left shadow-ambient-sm transition-all duration-200',
              'active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2',
              action.tone === 'primary'
                ? 'border-primary/20 btn-primary-gradient'
                : action.tone === 'surface'
                  ? 'bg-surface-container-lowest text-on-surface hover:-translate-y-0.5 hover:shadow-ambient'
                  : 'bg-surface-container text-on-surface hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-ambient',
            ].join(' ')}
          >
            <span className={[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-squircle-sm',
              action.tone === 'primary' ? 'bg-white/15 text-white' : 'bg-primary/8 text-primary',
            ].join(' ')}>
              {action.icon}
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-[1rem] font-semibold leading-tight tracking-tight sm:text-[1.08rem]">
                {action.title}
              </h2>
              <p className={[
                'mt-1 text-[0.82rem] leading-snug sm:text-sm',
                action.tone === 'primary' ? 'text-white/85' : 'text-on-surface-variant',
              ].join(' ')}>
                {action.subtitle}
              </p>
            </div>
            <ArrowRight
              size={18}
              className={action.tone === 'primary' ? 'text-white/80' : 'text-on-surface-variant'}
            />
          </button>
        ))}
      </section>

      <section className={interfaceMode === 'desktop' ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]' : 'hidden'}>
        <div className="space-y-5">
          <button
            onClick={() => navigate(APP_ROUTES.BRULAGE)}
            className="group relative min-h-[18rem] w-full overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#9f2600,#d33a0a)] p-7 text-left text-white shadow-ambient-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-ambient-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
          >
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-squircle bg-white/15">
                  <Flame size={28} />
                </span>
              </div>
              <div>
                <p className="text-label-sm uppercase tracking-[0.18em] text-white/70">
                  Module opérationnel
                </p>
                <h2 className="mt-2 text-display-md">Brulage</h2>
                <p className="mt-3 max-w-xl text-body-lg text-white/82">
                  Documents, référentiels et parcours liés aux caissons, MLB et MaF.
                </p>
              </div>
            </div>
          </button>

          <div className="grid gap-4 xl:grid-cols-2">
            {secondaryActions.map((action) => (
              <button
                key={action.route}
                onClick={() => navigate(action.route)}
                className={[
                  'group flex min-h-[10rem] flex-col justify-between rounded-[1.6rem] border border-outline-variant/70 p-5 text-left shadow-ambient-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ambient focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2',
                  action.tone === 'surface'
                    ? 'bg-surface-container-lowest text-on-surface'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
                ].join(' ')}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-squircle-sm bg-primary/8 text-primary">
                  {action.icon}
                </span>
                <div>
                  <h2 className="text-headline-md">{action.title}</h2>
                  <p className="mt-2 text-body-md text-on-surface-variant">{action.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside>
          <OperationalOverview
            sessions={upcomingSessions}
            pendingCarpoolRequests={pendingCarpoolRequests}
            loading={overviewLoading}
            error={overviewError}
            onOpenCalendar={() => navigate(APP_ROUTES.CALENDAR)}
            onOpenCarpool={() => navigate(APP_ROUTES.CARPOOL)}
            onOpenSession={(sessionId) => navigate(`${APP_ROUTES.TRAINING_SESSION}/${sessionId}`)}
          />
        </aside>
      </section>

    </div>
  );
}

interface OperationalOverviewProps {
  sessions: CalendarEvent[];
  pendingCarpoolRequests: number;
  loading: boolean;
  error: boolean;
  onOpenCalendar: () => void;
  onOpenCarpool: () => void;
  onOpenSession: (sessionId: string) => void;
}

function OperationalOverview({
  sessions,
  pendingCarpoolRequests,
  loading,
  error,
  onOpenCalendar,
  onOpenCarpool,
  onOpenSession,
}: OperationalOverviewProps) {
  return (
    <section className="rounded-[1.6rem] bg-surface-container-lowest p-5 shadow-ambient-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-primary">Calendrier</p>
          <h2 className="mt-1 text-headline-md text-on-surface">15 prochains jours</h2>
        </div>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="text-body-md font-semibold text-primary"
        >
          Tout voir
        </button>
      </div>

      <div className="mt-5 min-h-[12rem]">
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center" aria-label="Chargement des prochaines sessions">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="flex min-h-[12rem] items-center rounded-lg bg-surface-container px-4 text-body-md text-on-surface-variant">
            Les informations ne sont pas disponibles pour le moment.
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg bg-surface-container px-5 text-center">
            <Calendar size={24} className="text-primary" />
            <p className="mt-3 font-semibold text-on-surface">Aucune session prévue</p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Rien n’est programmé dans les 15 prochains jours.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                className="flex w-full items-start gap-3 rounded-lg bg-surface-container p-3 text-left transition-colors hover:bg-surface-container-high"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-on-surface">{session.title}</span>
                  <span className="mt-1 block text-label-md text-on-surface-variant">
                    {format(session.date, "EEE d MMM 'à' HH:mm", { locale: fr })}
                    {session.location ? ` · ${session.location}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCarpool}
        className="mt-4 flex w-full items-center justify-between gap-4 border-t border-outline-variant/70 pt-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CarFront size={18} />
          </span>
          <span>
            <span className="block font-semibold text-on-surface">Demandes de co-voiturage</span>
            <span className="block text-label-md text-on-surface-variant">En attente de votre réponse</span>
          </span>
        </span>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-sm font-bold text-white">
          {loading || error ? '–' : pendingCarpoolRequests}
        </span>
      </button>
    </section>
  );
}

export default Home;
