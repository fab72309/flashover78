import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BookOpen, CalendarDays, CarFront, Clock3, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageIntro from '../components/PageIntro';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { listEvents, listMyRequests, listResources, listTrips } from '../services/supabaseService';
import type { CalendarEvent, CarpoolMyRequest, CarpoolTrip, Resource } from '../types';
import { APP_ROUTES } from '../utils/constants';

interface DashboardData {
  events: CalendarEvent[];
  trips: CarpoolTrip[];
  requests: CarpoolMyRequest[];
  resources: Resource[];
}

const emptyData: DashboardData = {
  events: [],
  trips: [],
  requests: [],
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
      const [events, trips, requests, resources] = await Promise.all([
        listEvents(),
        listTrips(),
        listMyRequests(user.id),
        listResources(),
      ]);
      setData({ events, trips, requests, resources });
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
  const openTrips = data.trips.filter(
    (trip) => trip.status === 'open' && trip.departureDatetime >= now
  );
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');

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
            <Metric icon={<CarFront size={20} />} label="Trajets ouverts" value={openTrips.length} />
            <Metric
              icon={<Clock3 size={20} />}
              label="Demandes en attente"
              value={pendingRequests.length}
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
                  <p className="mt-1 text-body-md text-on-surface-variant">Départs ouverts et demandes à suivre.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CARPOOL)}
                  className="text-body-md font-semibold text-primary"
                >
                  Ouvrir
                </button>
              </div>
              {openTrips.length === 0 && pendingRequests.length === 0 ? (
                <EmptyState text="Aucune action de covoiturage en attente." />
              ) : (
                <>
                  {pendingRequests.slice(0, 2).map((request) => (
                    <button
                      type="button"
                      key={request.id}
                      onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${request.tripId}`)}
                      className="surface-card flex w-full items-start gap-4 p-4 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                        <Clock3 size={20} />
                      </span>
                      <span>
                        <span className="block font-semibold text-on-surface">Demande en attente</span>
                        <span className="mt-1 block text-body-md text-on-surface-variant">
                          {request.seatsRequested} place{request.seatsRequested > 1 ? 's' : ''} demandée
                          {request.trip ? ` · ${request.trip.departureCity}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                  {openTrips.slice(0, Math.max(0, 3 - pendingRequests.length)).map((trip) => (
                    <button
                      type="button"
                      key={trip.id}
                      onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${trip.id}`)}
                      className="surface-card flex w-full items-start gap-4 p-4 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                        <CarFront size={20} />
                      </span>
                      <span>
                        <span className="block font-semibold text-on-surface">
                          {trip.departureCity} vers {trip.arrivalLabel}
                        </span>
                        <span className="mt-1 block text-body-md text-on-surface-variant">
                          {format(trip.departureDatetime, "d MMMM 'à' HH:mm", { locale: fr })}
                          {` · ${trip.availableSeats} place${trip.availableSeats > 1 ? 's' : ''}`}
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
