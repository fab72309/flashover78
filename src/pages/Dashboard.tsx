import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BookOpen, CalendarDays, CarFront, Clock3, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageIntro from '../components/PageIntro';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { listEvents, listResources } from '../services/supabaseService';
import { listCarpoolPosts, listMyCarpoolPosts } from '../services/carpoolMobilityService';
import type { CalendarEvent, CarpoolPost, Resource } from '../types';
import { APP_ROUTES } from '../utils/constants';

interface DashboardData {
  events: CalendarEvent[];
  posts: CarpoolPost[];
  myPosts: CarpoolPost[];
  resources: Resource[];
}

const emptyData: DashboardData = {
  events: [],
  posts: [],
  myPosts: [],
  resources: [],
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [events, posts, myPosts, resources] = await Promise.all([
        listEvents(),
        listCarpoolPosts(),
        listMyCarpoolPosts(user.id),
        listResources(),
      ]);
      setData({ events, posts, myPosts, resources });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const now = useMemo(() => new Date(), []);
  const upcomingEvents = data.events
    .filter((event) => event.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const activePosts = data.posts.filter(
    (post) => ['open', 'partially_matched'].includes(post.status) && post.departureDatetime >= now
  );
  const pendingMatches = Array.from(new Map(
    data.myPosts
      .flatMap((post) => post.matches.filter((match) => match.status === 'pending').map((match) => [match.id, { match, post }] as const))
  ).values());

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-start justify-between gap-3">
        <PageIntro
          title="Tableau de bord"
          subtitle="Les prochaines échéances et actions utiles, regroupées au même endroit."
        />
        <button
          type="button"
          onClick={loadDashboard}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high"
          aria-label="Actualiser le tableau de bord"
          title="Actualiser"
        >
          <RefreshCw size={19} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <section className="surface-card p-5" role="alert">
          <p className="text-red-700">Les indicateurs ne sont pas disponibles.</p>
          <button type="button" onClick={loadDashboard} className="mt-3 font-semibold text-primary">
            Réessayer
          </button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicateurs">
            <Metric
              icon={<CalendarDays size={20} />}
              label="Sessions à venir"
              value={upcomingEvents.length}
            />
            <Metric icon={<CarFront size={20} />} label="Publications actives" value={activePosts.length} />
            <Metric
              icon={<Clock3 size={20} />}
              label="Correspondances en attente"
              value={pendingMatches.length}
            />
            <Metric icon={<BookOpen size={20} />} label="Ressources indexées" value={data.resources.length} />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-headline-md text-on-surface">Prochaines sessions</h2>
                  <p className="mt-1 text-body-md text-on-surface-variant">Les trois échéances les plus proches.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CALENDAR)}
                  className="text-body-md font-semibold text-primary"
                >
                  Tout voir
                </button>
              </div>
              {upcomingEvents.length === 0 ? (
                <EmptyState text="Aucune session programmée." />
              ) : (
                upcomingEvents.slice(0, 3).map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => navigate(`${APP_ROUTES.TRAINING_SESSION}/${event.id}`)}
                    className="surface-card flex w-full items-start gap-4 p-4 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-on-surface">{event.title}</span>
                      <span className="mt-1 block text-body-md text-on-surface-variant">
                        {format(event.date, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                        {event.location ? ` · ${event.location}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-headline-md text-on-surface">Coordination des trajets</h2>
                  <p className="mt-1 text-body-md text-on-surface-variant">Publications actives et correspondances à suivre.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CARPOOL)}
                  className="text-body-md font-semibold text-primary"
                >
                  Ouvrir
                </button>
              </div>
              {activePosts.length === 0 && pendingMatches.length === 0 ? (
                <EmptyState text="Aucune action de covoiturage en attente." />
              ) : (
                <>
                  {pendingMatches.slice(0, 2).map(({ match, post }) => (
                    <button
                      type="button"
                      key={match.id}
                      onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${post.id}`)}
                      className="surface-card flex w-full items-start gap-4 p-4 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                        <Clock3 size={20} />
                      </span>
                      <span>
                        <span className="block font-semibold text-on-surface">Correspondance en attente</span>
                        <span className="mt-1 block text-body-md text-on-surface-variant">
                          {match.seatsRequested} place{match.seatsRequested > 1 ? 's' : ''}
                          {` · ${post.departureCity} → ${post.arrivalLabel}`}
                        </span>
                      </span>
                    </button>
                  ))}
                  {activePosts.slice(0, Math.max(0, 3 - pendingMatches.length)).map((post) => (
                    <button
                      type="button"
                      key={post.id}
                      onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${post.id}`)}
                      className="surface-card flex w-full items-start gap-4 p-4 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                        <CarFront size={20} />
                      </span>
                      <span>
                        <span className="block font-semibold text-on-surface">
                          {post.departureCity} vers {post.arrivalLabel}
                        </span>
                        <span className="mt-1 block text-body-md text-on-surface-variant">
                          {format(post.departureDatetime, "d MMMM 'à' HH:mm", { locale: fr })}
                          {post.kind === 'offer'
                            ? ` · ${post.availableSeats} place${post.availableSeats && post.availableSeats > 1 ? 's' : ''}`
                            : ` · ${post.requestedSeats} place${post.requestedSeats && post.requestedSeats > 1 ? 's' : ''} recherchée${post.requestedSeats && post.requestedSeats > 1 ? 's' : ''}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-card min-h-28 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <Activity size={17} className="text-on-surface-variant" />
      </div>
      <p className="mt-4 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-1 text-body-md text-on-surface-variant">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card p-5 text-body-md text-on-surface-variant">
      {text}
    </div>
  );
}

export default Dashboard;
