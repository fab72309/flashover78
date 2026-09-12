import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CarFront,
  Clock3,
  Filter,
  LocateFixed,
  MapPin,
  MessageSquarePlus,
  RefreshCw,
  Route,
  Search,
  Users,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import type { CalendarEvent, CarpoolMyRequest, CarpoolTrip } from '../types';
import {
  cancelTrip,
  cancelTripRequest,
  createTrip,
  createTripRequest,
  listEvents,
  listMyRequests,
  listMyTrips,
  listTrips,
} from '../services/supabaseService';
import { APP_ROUTES } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';
import { getRequestStatusLabel, getTripStatusLabel } from '../utils/statusLabels';

const initialTripForm = {
  eventId: '',
  departureCity: '',
  departureLabel: '',
  departureDatetime: '',
  totalSeats: 3,
  vehicleNote: '',
  luggageNote: '',
  priceNote: '',
  notes: '',
};

const initialRequestForm = {
  tripId: '',
  seatsRequested: 1,
  message: '',
};

function statusBadge(status: CarpoolTrip['status']) {
  switch (status) {
    case 'open':
      return 'bg-emerald-100 text-emerald-700';
    case 'full':
      return 'bg-amber-100 text-amber-700';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function Carpool() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [trips, setTrips] = useState<CarpoolTrip[]>([]);
  const [myTrips, setMyTrips] = useState<CarpoolTrip[]>([]);
  const [myRequests, setMyRequests] = useState<CarpoolMyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [tripForm, setTripForm] = useState(() => ({
    ...initialTripForm,
    eventId: searchParams.get('eventId') ?? '',
  }));
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    departureCity: '',
    onlyAvailable: true,
  });
  const selectedEventId = searchParams.get('eventId') ?? undefined;

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [eventRows, tripRows, myTripRows, myRequestRows] = await Promise.all([
        listEvents(),
        listTrips(selectedEventId),
        listMyTrips(user.id),
        listMyRequests(user.id),
      ]);

      setEvents(eventRows);
      setTrips(tripRows);
      setMyTrips(myTripRows);
      setMyRequests(myRequestRows);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des trajets');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTrips = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return trips.filter((trip) => {
      const matchesQuery =
        !query ||
        trip.departureCity.toLowerCase().includes(query) ||
        trip.departureLabel.toLowerCase().includes(query) ||
        trip.arrivalLabel.toLowerCase().includes(query) ||
        trip.driverName.toLowerCase().includes(query) ||
        (trip.eventTitle ?? '').toLowerCase().includes(query);

      const matchesCity =
        !filters.departureCity ||
        trip.departureCity.toLowerCase().includes(filters.departureCity.trim().toLowerCase());

      const matchesAvailability = !filters.onlyAvailable || (trip.availableSeats > 0 && trip.status === 'open');

      return matchesQuery && matchesCity && matchesAvailability;
    });
  }, [filters, trips]);

  const requestableTrips = useMemo(
    () => trips.filter((trip) => (
      trip.driverId !== user?.id &&
      trip.status === 'open' &&
      trip.availableSeats > 0 &&
      !myRequests.some((request) => (
        request.tripId === trip.id && (request.status === 'pending' || request.status === 'accepted')
      ))
    )),
    [myRequests, trips, user?.id]
  );

  const selectedRequestTrip = requestableTrips.find((trip) => trip.id === requestForm.tripId) ?? null;

  const openRequestForm = (tripId?: string) => {
    setRequestForm({
      ...initialRequestForm,
      tripId: tripId ?? requestableTrips[0]?.id ?? '',
    });
    setShowTripForm(false);
    setShowRequestForm(true);
  };

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      const selectedEvent = events.find((event) => event.id === tripForm.eventId);
      await createTrip({
        eventId: tripForm.eventId || null,
        driverId: user.id,
        departureCity: tripForm.departureCity,
        departureLabel: tripForm.departureLabel,
        departureDatetime: new Date(tripForm.departureDatetime),
        arrivalLabel: selectedEvent?.location || 'Site de formation',
        totalSeats: Number(tripForm.totalSeats),
        priceNote: tripForm.priceNote,
        vehicleNote: tripForm.vehicleNote,
        luggageNote: tripForm.luggageNote,
        notes: tripForm.notes,
      });

      setTripForm({
        ...initialTripForm,
        eventId: searchParams.get('eventId') ?? '',
      });
      setShowTripForm(false);
      await loadData();
      showToast('Trajet publié.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible de créer le trajet', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRequestTrip) {
      return;
    }

    const seatsRequested = Number(requestForm.seatsRequested);
    if (!Number.isInteger(seatsRequested) || seatsRequested < 1 || seatsRequested > selectedRequestTrip.availableSeats) {
      showToast('Le nombre de places demandé n’est pas disponible.', 'error');
      return;
    }

    setSaving(true);

    try {
      await createTripRequest({
        tripId: selectedRequestTrip.id,
        requesterId: user.id,
        seatsRequested,
        message: requestForm.message,
      });
      setRequestForm(initialRequestForm);
      setShowRequestForm(false);
      await loadData();
      showToast('Demande envoyée au conducteur.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’envoyer la demande', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    try {
      await cancelTrip(tripId);
      await loadData();
      showToast('Trajet annulé.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’annuler ce trajet', 'error');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelTripRequest(requestId);
      await loadData();
      showToast('Demande annulée.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’annuler cette demande', 'error');
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <section className="surface-card p-5 overflow-hidden relative">
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-label-lg">
                <CarFront size={16} />
                Co-voiturage formateurs
              </div>
              <h1 className="text-display-sm text-on-surface mt-3">Organiser les trajets vers les formations</h1>
              <p className="text-body-lg text-on-surface-variant mt-2 max-w-2xl">
                Proposez des places, demandez un trajet, suivez les validations et gardez chaque venue rattachée au calendrier.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadData}
                className="px-4 py-3 rounded-squircle-sm bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => (showRequestForm ? setShowRequestForm(false) : openRequestForm())}
                className="px-4 py-3 rounded-squircle-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-2"
                aria-expanded={showRequestForm}
              >
                <MessageSquarePlus size={18} />
                Demander un trajet
              </button>
              <button
                type="button"
                onClick={() => setShowTripForm((prev) => !prev)}
                className="px-4 py-3 rounded-squircle-sm btn-primary-gradient text-white flex items-center gap-2"
              >
                <Route size={18} />
                Proposer un trajet
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StatCard icon={<CarFront size={18} />} label="Trajets ouverts" value={trips.filter((trip) => trip.status === 'open').length} />
            <StatCard icon={<Users size={18} />} label="Demandes en attente" value={myTrips.flatMap((trip) => trip.requests).filter((request) => request.status === 'pending').length} />
            <StatCard icon={<Clock3 size={18} />} label="Mes départs" value={myTrips.length} />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                value={filters.search}
                onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                placeholder="Ville de départ, conducteur, formation..."
                className="w-full rounded-full bg-surface-container-highest pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant"
              />
            </label>
            <label className="relative block">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                value={filters.departureCity}
                onChange={(e) => setFilters((current) => ({ ...current, departureCity: e.target.value }))}
                placeholder="Filtrer par ville"
                className="w-full rounded-full bg-surface-container-highest pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant"
              />
            </label>
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, onlyAvailable: !current.onlyAvailable }))}
              className={`px-4 py-3 rounded-full text-body-md transition-colors flex items-center gap-2 ${
                filters.onlyAvailable ? 'btn-primary-gradient text-white' : 'bg-surface-container text-on-surface'
              }`}
            >
              <Filter size={18} />
              Places dispo
            </button>
          </div>
        </div>
      </section>

      {showRequestForm && (
        <section className="surface-card p-5 space-y-4" aria-labelledby="request-trip-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <MessageSquarePlus size={18} />
                <h2 id="request-trip-title" className="text-headline-md text-on-surface">Demander un trajet</h2>
              </div>
              <p className="text-body-md text-on-surface-variant mt-1">
                Choisissez une offre ouverte, indiquez le nombre de places souhaité et laissez un message au conducteur.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="p-2 rounded-squircle-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              aria-label="Fermer la demande de trajet"
            >
              <X size={18} />
            </button>
          </div>

          {requestableTrips.length === 0 ? (
            <div className="rounded-squircle-sm bg-surface-container p-4 text-body-md text-on-surface-variant">
              Aucun trajet ouvert proposé par un autre formateur n’est disponible pour le moment. Une demande se fait à partir d’une offre publiée.
            </div>
          ) : (
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Trajet souhaité">
                  <select
                    value={requestForm.tripId}
                    onChange={(e) => setRequestForm((current) => ({
                      ...current,
                      tripId: e.target.value,
                      seatsRequested: 1,
                    }))}
                    className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                    required
                  >
                    <option value="">Sélectionner un trajet</option>
                    {requestableTrips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.departureCity} → {trip.arrivalLabel} · {format(trip.departureDatetime, "d MMM à HH:mm", { locale: fr })} · {trip.driverName}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nombre de places">
                  <input
                    type="number"
                    min={1}
                    max={selectedRequestTrip?.availableSeats || 1}
                    value={requestForm.seatsRequested}
                    onChange={(e) => setRequestForm((current) => ({ ...current, seatsRequested: Number(e.target.value) }))}
                    className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                    required
                  />
                </Field>
              </div>

              <Field label="Message au conducteur">
                <textarea
                  rows={3}
                  value={requestForm.message}
                  onChange={(e) => setRequestForm((current) => ({ ...current, message: e.target.value }))}
                  className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                  placeholder="Précisions de départ, matériel, contrainte horaire..."
                />
              </Field>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !selectedRequestTrip}
                  className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50"
                >
                  {saving ? 'Envoi...' : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {showTripForm && (
        <form onSubmit={handleTripSubmit} className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-headline-md text-on-surface">Proposer un trajet</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Le trajet reste rattaché à une formation pour simplifier les départs.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Formation">
              <select
                value={tripForm.eventId}
                onChange={(e) => setTripForm((current) => ({ ...current, eventId: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              >
                <option value="">Sélectionner une formation</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {format(event.date, 'dd MMM yyyy HH:mm', { locale: fr })}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ville de départ">
              <input
                value={tripForm.departureCity}
                onChange={(e) => setTripForm((current) => ({ ...current, departureCity: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Versailles, Mantes, Rambouillet..."
                required
              />
            </Field>

            <Field label="Point de rendez-vous">
              <input
                value={tripForm.departureLabel}
                onChange={(e) => setTripForm((current) => ({ ...current, departureLabel: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Centre de secours, parking, gare..."
                required
              />
            </Field>

            <Field label="Heure de départ">
              <input
                type="datetime-local"
                value={tripForm.departureDatetime}
                onChange={(e) => setTripForm((current) => ({ ...current, departureDatetime: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              />
            </Field>

            <Field label="Nombre de places">
              <input
                type="number"
                min={1}
                max={8}
                value={tripForm.totalSeats}
                onChange={(e) => setTripForm((current) => ({ ...current, totalSeats: Number(e.target.value) }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              />
            </Field>

            <Field label="Véhicule">
              <input
                value={tripForm.vehicleNote}
                onChange={(e) => setTripForm((current) => ({ ...current, vehicleNote: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Clio, Kangoo, 7 places..."
              />
            </Field>

            <Field label="Bagages / matériel">
              <input
                value={tripForm.luggageNote}
                onChange={(e) => setTripForm((current) => ({ ...current, luggageNote: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Coffre plein, matériel possible..."
              />
            </Field>

            <Field label="Participation">
              <input
                value={tripForm.priceNote}
                onChange={(e) => setTripForm((current) => ({ ...current, priceNote: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Ex: partage carburant"
              />
            </Field>
          </div>

          <Field label="Note conducteur">
            <textarea
              value={tripForm.notes}
              onChange={(e) => setTripForm((current) => ({ ...current, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
              placeholder="Détails utiles pour les passagers"
            />
          </Field>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50">
              {saving ? 'Publication...' : 'Publier le trajet'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="surface-card p-5 text-red-600">{error}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-headline-md text-on-surface">Trajets disponibles</h2>
                <p className="text-body-md text-on-surface-variant mt-1">Consultez les places restantes et envoyez une demande.</p>
              </div>
            </div>

            {filteredTrips.length === 0 ? (
              <div className="surface-card p-6 text-on-surface-variant">Aucun trajet ne correspond aux filtres actuels.</div>
            ) : (
              filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpen={() => navigate(`${APP_ROUTES.CARPOOL}/${trip.id}`)}
                  onRequest={requestableTrips.some((candidate) => candidate.id === trip.id)
                    ? () => openRequestForm(trip.id)
                    : undefined}
                />
              ))
            )}
          </section>

          <div className="space-y-4">
            <section className="surface-card p-5">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-primary" />
                <h2 className="text-headline-sm text-on-surface">Mes trajets</h2>
              </div>
              <div className="mt-4 space-y-3">
                {myTrips.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Aucun trajet proposé pour le moment.</p>
                ) : (
                  myTrips.map((trip) => (
                    <div key={trip.id} className="rounded-squircle-sm bg-surface-container p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-body-lg font-semibold text-on-surface">{trip.departureCity} → {trip.arrivalLabel}</div>
                          <div className="text-label-lg text-on-surface-variant mt-1">
                            {format(trip.departureDatetime, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-label-sm font-semibold uppercase ${statusBadge(trip.status)}`}>
                          {getTripStatusLabel(trip.status)}
                        </span>
                      </div>
                      <div className="text-body-md text-on-surface-variant">
                        {trip.availableSeats} / {trip.totalSeats} places restantes
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${trip.id}`)}
                          className="px-3 py-2 rounded-squircle-sm bg-surface-container-high text-on-surface"
                        >
                          Voir les demandes
                        </button>
                        {trip.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleCancelTrip(trip.id)}
                            className="px-3 py-2 rounded-squircle-sm bg-rose-100 text-rose-700"
                          >
                            Annuler le trajet
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="surface-card p-5">
              <div className="flex items-center gap-2">
                <MessageSquarePlus size={18} className="text-primary" />
                <h2 className="text-headline-sm text-on-surface">Mes demandes</h2>
              </div>
              <div className="mt-4 space-y-3">
                {myRequests.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Aucune demande envoyée.</p>
                ) : (
                  myRequests.map((request) => (
                    <div key={request.id} className="rounded-squircle-sm bg-surface-container p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-body-lg font-semibold text-on-surface">
                            {request.trip?.departureCity ?? 'Trajet'} → {request.trip?.arrivalLabel ?? 'Formation'}
                          </div>
                          <div className="text-label-lg text-on-surface-variant mt-1">
                            {request.trip ? format(request.trip.departureDatetime, "d MMM yyyy 'à' HH:mm", { locale: fr }) : 'Trajet indisponible'}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-label-sm font-semibold uppercase bg-surface-container-high text-on-surface-variant">
                          {getRequestStatusLabel(request.status)}
                        </span>
                      </div>
                      <div className="text-body-md text-on-surface-variant mt-3">{request.seatsRequested} place(s) demandée(s)</div>
                      {request.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(request.id)}
                          className="mt-3 px-3 py-2 rounded-squircle-sm bg-rose-100 text-rose-700"
                        >
                          Annuler ma demande
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-label-lg text-on-surface mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-squircle bg-surface-container p-4">
      <div className="flex items-center gap-2 text-primary">{icon}<span className="text-label-lg">{label}</span></div>
      <div className="text-display-sm text-on-surface mt-3">{value}</div>
    </div>
  );
}

function TripCard({
  trip,
  onOpen,
  onRequest,
}: {
  trip: CarpoolTrip;
  onOpen: () => void;
  onRequest?: () => void;
}) {
  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-label-lg text-primary">
            <LocateFixed size={16} />
            {trip.departureCity}
          </div>
          <h3 className="text-headline-md text-on-surface mt-2">{trip.departureLabel}</h3>
          <div className="flex items-center gap-2 text-body-md text-on-surface-variant mt-1">
            <ArrowRight size={16} />
            {trip.arrivalLabel}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-label-sm font-semibold uppercase ${statusBadge(trip.status)}`}>
          {getTripStatusLabel(trip.status)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mt-5">
        <Meta icon={<Clock3 size={16} />} label={format(trip.departureDatetime, "EEEE d MMMM 'à' HH:mm", { locale: fr })} />
        <Meta icon={<Users size={16} />} label={`${trip.availableSeats} / ${trip.totalSeats} places`} />
        <Meta icon={<CarFront size={16} />} label={trip.driverName} />
      </div>

      <div className="mt-4 grid gap-2 text-body-md text-on-surface-variant">
        {trip.eventTitle && <div>Formation: {trip.eventTitle}</div>}
        {trip.eventLocation && <div>Site: {trip.eventLocation}</div>}
        {trip.vehicleNote && <div>Véhicule: {trip.vehicleNote}</div>}
        {trip.notes && <div>Note: {trip.notes}</div>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {onRequest && (
          <button type="button" onClick={onRequest} className="px-4 py-2.5 rounded-squircle-sm btn-primary-gradient text-white">
            Demander un trajet
          </button>
        )}
        <button type="button" onClick={onOpen} className="px-4 py-2.5 rounded-squircle-sm bg-surface-container text-on-surface">
          Voir le détail
        </button>
      </div>
    </article>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
