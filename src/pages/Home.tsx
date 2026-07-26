import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../utils/constants';
import { ArrowRight, Book, Calendar, CarFront, Flame, LayoutDashboard, ShieldCheck } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-5 fade-in lg:space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-surface-container-lowest px-5 py-5 shadow-ambient-sm sm:px-6 lg:rounded-[2.25rem] lg:px-8 lg:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(173,44,0,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(238,238,240,0.72))]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-display-sm text-on-surface lg:text-display-md">
              Accueil Flashover 78
            </h1>
          </div>
        </div>
      </section>

      <section className="space-y-3 lg:hidden">
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

      <section className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
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

        <aside className="space-y-4">
          <OperationalPanel
            icon={<Calendar size={20} />}
            title="Aujourd'hui"
            label="Calendrier"
            description="Sessions, rendez-vous et échéances visibles depuis le poste PC."
            onClick={() => navigate(APP_ROUTES.CALENDAR)}
          />
          <OperationalPanel
            icon={<CarFront size={20} />}
            title="Coordination"
            label="Co-voiturage"
            description="Préparation des trajets et regroupements avant les sessions."
            onClick={() => navigate(APP_ROUTES.CARPOOL)}
          />
          <div className="rounded-[1.6rem] bg-on-surface p-5 text-white shadow-ambient">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-squircle-sm bg-white/10">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="text-label-sm uppercase tracking-[0.16em] text-white/55">Statut</p>
                <p className="text-headline-md">Interface PC active</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

    </div>
  );
}

interface OperationalPanelProps {
  icon: JSX.Element;
  title: string;
  label: string;
  description: string;
  onClick: () => void;
}

function OperationalPanel({ icon, title, label, description, onClick }: OperationalPanelProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[1.6rem] bg-surface-container-lowest p-5 text-left shadow-ambient-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ambient focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-squircle-sm bg-primary/8 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-primary">{label}</p>
          <h3 className="mt-1 text-headline-md text-on-surface">{title}</h3>
          <p className="mt-2 text-body-md text-on-surface-variant">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default Home;
