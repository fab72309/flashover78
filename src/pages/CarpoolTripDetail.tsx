import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Route, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import type { CarpoolTrip } from '../types';
import {
  acceptTripRequest,
  createTripRequest,
  getTripById,
  rejectTripRequest,
} from '../services/supabaseService';
import { APP_ROUTES } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';
import { getRequestStatusLabel } from '../utils/statusLabels';
import { getUserFacingError } from '../utils/userFacingError';
import { logClientFailure } from '../utils/clientDiagnostics';

export default function CarpoolTripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [trip, setTrip] = useState<CarpoolTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ seatsRequested: 1, message: '' });
  const [error, setError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getTripById(id);
      setTrip(result);
      if (!result) {
        setError('Trajet introuvable');
      }
    } catch (err) {
      logClientFailure('Chargement du trajet impossible');
      setError(getUserFacingError(err, 'Impossible de charger le trajet'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const isDriver = Boolean(user && trip && user.id === trip.driverId);
  const hasPendingRequest = Boolean(
    user && trip?.requests.some((request) => request.requesterId === user.id && request.status === 'pending')
  );

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !trip) {
      return;
    }

    setSaving(true);
    try {
      await createTripRequest({
        tripId: trip.id,
        requesterId: user.id,
        seatsRequested: Number(form.seatsRequested),
        message: form.message,
      });
      setForm({ seatsRequested: 1, message: '' });
      await loadTrip();
      showToast('Demande envoyée au conducteur.', 'success');
    } catch (err) {
      logClientFailure('Envoi de la demande de covoiturage impossible');
      showToast(getUserFacingError(err, 'Impossible d’envoyer la demande'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptTripRequest(requestId);
      await loadTrip();
      showToast('Demande acceptée.', 'success');
    } catch (err) {
      logClientFailure('Acceptation de la demande de covoiturage impossible');
      showToast(getUserFacingError(err, 'Impossible d’accepter la demande'), 'error');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectTripRequest(requestId);
      await loadTrip();
      showToast('Demande refusée.', 'success');
    } catch (err) {
      logClientFailure('Refus de la demande de covoiturage impossible');
      showToast(getUserFacingError(err, 'Impossible de refuser la demande'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    );
  }

  if (!trip || error) {
    return (
      <div className="surface-card p-5">
        <p className="text-red-600">{error || 'Trajet introuvable'}</p>
        <button type="button" onClick={() => navigate(APP_ROUTES.CARPOOL)} className="mt-4 text-primary hover:underline">
          Retour au co-voiturage
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.CARPOOL)}
          className="p-2 rounded-squircle-sm hover:bg-surface-container transition-colors"
        >
          <ArrowLeft size={20} className="text-on-surface-variant" />
        </button>
        <div>
          <h1 className="text-display-sm text-on-surface">Détail du trajet</h1>
          <p className="text-body-md text-on-surface-variant">Gestion des places, demandes et informations conducteur.</p>
        </div>
      </div>

      <section className="surface-card p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-label-lg text-primary uppercase tracking-wide">Trajet proposé</div>
            <h2 className="text-display-sm text-on-surface mt-2">{trip.departureCity} → {trip.arrivalLabel}</h2>
            <div className="text-body-lg text-on-surface-variant mt-2">
              Départ le {format(trip.departureDatetime, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
          </div>
          <div className="rounded-squircle bg-surface-container px-4 py-3">
            <div className="text-label-lg text-on-surface-variant">Places restantes</div>
            <div className="text-display-sm text-on-surface mt-1">{trip.availableSeats}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Conducteur" value={trip.driverName} icon={<Route size={16} />} />
          <InfoCard label="Email" value={trip.driverEmail} icon={<Mail size={16} />} />
          <InfoCard label="Téléphone" value={trip.driverPhone || 'Non renseigné'} icon={<Phone size={16} />} />
          <InfoCard label="Formation" value={trip.eventTitle || 'Non rattachée'} icon={<Users size={16} />} />
        </div>

        <div className="grid gap-3 text-body-md text-on-surface-variant">
          <div>Point de départ: {trip.departureLabel}</div>
          {trip.eventLocation && <div>Site de formation: {trip.eventLocation}</div>}
          {trip.vehicleNote && <div>Véhicule: {trip.vehicleNote}</div>}
          {trip.luggageNote && <div>Bagages: {trip.luggageNote}</div>}
          {trip.priceNote && <div>Participation: {trip.priceNote}</div>}
          {trip.notes && <div>Notes: {trip.notes}</div>}
        </div>
      </section>

      {!isDriver && (
        <section className="surface-card p-5">
          <h2 className="text-headline-md text-on-surface">Demander un trajet</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Le conducteur validera manuellement votre demande.
          </p>

          <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Nombre de places</span>
              <input
                type="number"
                min={1}
                max={trip.availableSeats || 1}
                value={form.seatsRequested}
                onChange={(e) => setForm((current) => ({ ...current, seatsRequested: Number(e.target.value) }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              />
            </label>

            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Message</span>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Précisions de départ, matériel, contrainte horaire..."
              />
            </label>

            <button
              type="submit"
              disabled={saving || trip.availableSeats <= 0 || hasPendingRequest}
              className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50"
            >
              {saving ? 'Envoi...' : hasPendingRequest ? 'Demande déjà envoyée' : 'Envoyer la demande'}
            </button>
          </form>
        </section>
      )}

      <section className="surface-card p-5">
        <h2 className="text-headline-md text-on-surface">Demandes reçues</h2>
        <div className="mt-4 space-y-3">
          {trip.requests.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Aucune demande pour l’instant.</p>
          ) : (
            trip.requests.map((request) => (
              <div key={request.id} className="rounded-squircle-sm bg-surface-container p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-body-lg font-semibold text-on-surface">{request.requesterName}</div>
                    <div className="text-body-md text-on-surface-variant mt-1">{request.requesterEmail}</div>
                    {request.requesterPhone && <div className="text-body-md text-on-surface-variant">{request.requesterPhone}</div>}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-label-sm font-semibold uppercase bg-surface-container-high text-on-surface-variant">
                    {getRequestStatusLabel(request.status)}
                  </span>
                </div>
                <div className="text-body-md text-on-surface-variant">{request.seatsRequested} place(s) demandée(s)</div>
                {request.message && <div className="text-body-md text-on-surface-variant">Message: {request.message}</div>}
                {isDriver && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleAccept(request.id)} className="px-3 py-2 rounded-squircle-sm btn-primary-gradient text-white">
                      Accepter
                    </button>
                    <button type="button" onClick={() => handleReject(request.id)} className="px-3 py-2 rounded-squircle-sm bg-rose-100 text-rose-700">
                      Refuser
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-squircle-sm bg-surface-container p-4">
      <div className="flex items-center gap-2 text-primary text-label-lg">{icon}<span>{label}</span></div>
      <div className="text-body-lg text-on-surface mt-3 break-words">{value}</div>
    </div>
  );
}
