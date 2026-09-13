import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  Route,
  UserRound,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import type { CarpoolContact, CarpoolMatch, CarpoolPost } from '../types';
import {
  cancelCarpoolMatch,
  cancelCarpoolPost,
  completeCarpoolPost,
  createCarpoolMatch,
  getCarpoolPostById,
  getCarpoolPostContacts,
  listMyCarpoolPosts,
  requestCarpoolRide,
  respondToCarpoolMatch,
} from '../services/carpoolMobilityService';
import { APP_ROUTES } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';
import {
  getCarpoolMatchStatusLabel,
  getCarpoolPostKindLabel,
  getCarpoolPostStatusLabel,
} from '../utils/statusLabels';

function postStatusClass(status: CarpoolPost['status']) {
  switch (status) {
    case 'open':
      return 'bg-emerald-100 text-emerald-700';
    case 'partially_matched':
      return 'bg-sky-100 text-sky-700';
    case 'matched':
      return 'bg-violet-100 text-violet-700';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    case 'expired':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function matchStatusClass(status: CarpoolMatch['status']) {
  switch (status) {
    case 'accepted':
      return 'bg-emerald-100 text-emerald-700';
    case 'rejected':
      return 'bg-rose-100 text-rose-700';
    case 'cancelled':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

export default function CarpoolPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [post, setPost] = useState<CarpoolPost | null>(null);
  const [myOffers, setMyOffers] = useState<CarpoolPost[]>([]);
  const [contacts, setContacts] = useState<CarpoolContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({ seats: 1, message: '' });
  const [offerForm, setOfferForm] = useState({ offerPostId: '', seats: 1, message: '' });

  const loadPost = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const [result, ownPosts] = await Promise.all([
        getCarpoolPostById(id),
        user ? listMyCarpoolPosts(user.id) : Promise.resolve([]),
      ]);
      if (!result) {
        setPost(null);
        setError('Publication introuvable');
        return;
      }

      setPost(result);
      const activeOffers = ownPosts.filter((candidate) => (
        candidate.kind === 'offer'
        && ['open', 'partially_matched'].includes(candidate.status)
        && (candidate.availableSeats ?? 0) > 0
        && (!result.eventId || candidate.eventId === result.eventId)
      ));
      setMyOffers(activeOffers);
      setOfferForm((current) => ({
        ...current,
        offerPostId: activeOffers.some((offer) => offer.id === current.offerPostId)
          ? current.offerPostId
          : activeOffers[0]?.id ?? '',
      }));

      if (user && (result.authorId === user.id || result.matches.some((match) => match.status === 'accepted'))) {
        try {
          setContacts(await getCarpoolPostContacts(result.id, user.id));
        } catch {
          setContacts([]);
        }
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Impossible de charger la publication');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const isOwner = Boolean(user && post && post.authorId === user.id);
  const isOffer = post?.kind === 'offer';
  const availableSeats = post?.availableSeats ?? 0;
  const canProposeToNeed = Boolean(post && !isOwner && post.kind === 'need' && myOffers.length > 0);

  const acceptedContacts = useMemo(
    () => contacts.filter((contact) => contact.userId !== user?.id),
    [contacts, user?.id]
  );

  const handleRequestRide = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !post || !isOffer) return;

    const seats = Number(requestForm.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > availableSeats) {
      showToast('Le nombre de places demandé n’est pas disponible.', 'error');
      return;
    }

    setSaving(true);
    try {
      await requestCarpoolRide({
        offerPostId: post.id,
        requesterId: user.id,
        seatsRequested: seats,
        message: requestForm.message,
      });
      setRequestForm({ seats: 1, message: '' });
      await loadPost();
      showToast('Votre besoin et la demande de correspondance ont été envoyés.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’envoyer cette demande.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProposeRide = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !post || post.kind !== 'need') return;

    const offer = myOffers.find((candidate) => candidate.id === offerForm.offerPostId);
    const seats = Number(offerForm.seats);
    if (!offer || !Number.isInteger(seats) || seats < 1 || seats > (offer.availableSeats ?? 0)) {
      showToast('Sélectionnez une offre et un nombre de places disponible.', 'error');
      return;
    }
    if (post.requestedSeats && seats > post.requestedSeats) {
      showToast('Cette proposition dépasse le besoin publié.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createCarpoolMatch({
        offerPostId: offer.id,
        needPostId: post.id,
        initiatorId: user.id,
        seatsRequested: seats,
        message: offerForm.message,
      });
      setOfferForm((current) => ({ ...current, message: '' }));
      await loadPost();
      showToast('Votre proposition a été envoyée au demandeur.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’envoyer cette proposition.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRespond = async (matchId: string, status: 'accepted' | 'rejected') => {
    setSaving(true);
    try {
      await respondToCarpoolMatch(matchId, status, user?.id);
      await loadPost();
      showToast(status === 'accepted' ? 'Correspondance validée.' : 'Proposition refusée.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible de traiter cette proposition.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMatch = async (matchId: string) => {
    setSaving(true);
    try {
      await cancelCarpoolMatch(matchId, user?.id);
      await loadPost();
      showToast('Correspondance annulée.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible d’annuler la correspondance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePostAction = async (action: 'cancel' | 'complete') => {
    if (!post) return;
    setSaving(true);
    try {
      if (action === 'cancel') {
        await cancelCarpoolPost(post.id, user?.id);
        showToast('Publication annulée.', 'success');
      } else {
        await completeCarpoolPost(post.id, user?.id);
        showToast('Publication marquée comme terminée.', 'success');
      }
      await loadPost();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Impossible de modifier la publication.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><LoadingSpinner /></div>;
  }

  if (!post || error) {
    return (
      <div className="surface-card p-5">
        <p className="text-red-600">{error || 'Publication introuvable'}</p>
        <button type="button" onClick={() => navigate(APP_ROUTES.CARPOOL)} className="mt-4 text-primary hover:underline">
          Retour au co-voiturage
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(APP_ROUTES.CARPOOL)} className="p-2 rounded-squircle-sm hover:bg-surface-container">
          <ArrowLeft size={20} className="text-on-surface-variant" />
        </button>
        <div>
          <h1 className="text-display-sm text-on-surface">Détail de la publication</h1>
          <p className="text-body-md text-on-surface-variant">Suivi du besoin, de l’offre et des correspondances.</p>
        </div>
      </div>

      <section className="surface-card p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-label-lg">
              <span className={`px-2.5 py-1 rounded-full ${post.kind === 'offer' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                {getCarpoolPostKindLabel(post.kind)}
              </span>
              <span className={`px-2.5 py-1 rounded-full ${postStatusClass(post.status)}`}>
                {getCarpoolPostStatusLabel(post.status)}
              </span>
            </div>
            <h2 className="text-display-sm text-on-surface mt-3">
              {post.departureCity} <ArrowRight size={22} className="inline mx-1 text-primary" /> {post.arrivalLabel}
            </h2>
            <div className="text-body-lg text-on-surface-variant mt-2">
              Départ le {format(post.departureDatetime, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
          </div>
          <div className="rounded-squircle bg-surface-container px-4 py-3 min-w-44">
            <div className="text-label-lg text-on-surface-variant">{isOffer ? 'Places restantes' : 'Places recherchées'}</div>
            <div className="text-display-sm text-on-surface mt-1">{isOffer ? availableSeats : post.requestedSeats}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Publication par" value={post.authorName} icon={<UserRound size={16} />} />
          <InfoCard label="Formation" value={post.eventTitle || 'Non rattachée'} icon={<Users size={16} />} />
          <InfoCard label="Départ" value={post.departureLabel} icon={<Route size={16} />} />
          <InfoCard label="Date de publication" value={format(post.createdAt, 'd MMM yyyy', { locale: fr })} icon={<Clock3 size={16} />} />
        </div>

        <div className="grid gap-2 text-body-md text-on-surface-variant">
          {post.eventLocation && <div>Site de formation : {post.eventLocation}</div>}
          {isOffer && post.totalSeats && <div>Capacité publiée : {post.totalSeats} place(s)</div>}
          {isOffer && post.vehicleNote && <div>Véhicule : {post.vehicleNote}</div>}
          {isOffer && post.luggageNote && <div>Bagages / matériel : {post.luggageNote}</div>}
          {isOffer && post.priceNote && <div>Participation : {post.priceNote}</div>}
          {post.notes && <div>Note : {post.notes}</div>}
        </div>

        {isOwner && ['open', 'partially_matched', 'matched'].includes(post.status) && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={saving} onClick={() => handlePostAction('complete')} className="px-4 py-2.5 rounded-squircle-sm bg-surface-container text-on-surface disabled:opacity-50">
              Marquer comme terminée
            </button>
            <button type="button" disabled={saving} onClick={() => handlePostAction('cancel')} className="px-4 py-2.5 rounded-squircle-sm bg-rose-100 text-rose-700 disabled:opacity-50">
              Annuler la publication
            </button>
          </div>
        )}
      </section>

      {!isOwner && isOffer && post.status !== 'matched' && post.status !== 'cancelled' && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquare size={18} />
            <h2 className="text-headline-md text-on-surface">Demander ce trajet</h2>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">Votre demande crée automatiquement une publication de besoin et une correspondance à valider par le conducteur.</p>
          <form onSubmit={handleRequestRide} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre de places">
                <input
                  type="number"
                  min={1}
                  max={availableSeats || 1}
                  value={requestForm.seats}
                  onChange={(event) => setRequestForm((current) => ({ ...current, seats: Number(event.target.value) }))}
                  className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                  required
                />
              </Field>
              <div className="rounded-squircle-sm bg-sky-50 border border-sky-100 p-4 text-body-md text-sky-950 self-end">
                Après validation, les coordonnées du conducteur seront visibles dans cette publication.
              </div>
            </div>
            <Field label="Message au conducteur">
              <textarea
                rows={3}
                value={requestForm.message}
                onChange={(event) => setRequestForm((current) => ({ ...current, message: event.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Précisions de départ, matériel, contrainte horaire..."
              />
            </Field>
            <button type="submit" disabled={saving || availableSeats < 1} className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50">
              {saving ? 'Envoi...' : 'Créer mon besoin et demander une place'}
            </button>
          </form>
        </section>
      )}

      {canProposeToNeed && post.status !== 'cancelled' && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <HandHelpingIcon />
            <h2 className="text-headline-md text-on-surface">Proposer une place</h2>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">Choisissez l’une de vos offres ouvertes. Le demandeur devra confirmer la correspondance.</p>
          <form onSubmit={handleProposeRide} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mon offre">
                <select
                  value={offerForm.offerPostId}
                  onChange={(event) => setOfferForm((current) => ({ ...current, offerPostId: event.target.value, seats: 1 }))}
                  className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                  required
                >
                  <option value="">Sélectionner une offre</option>
                  {myOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.departureCity} → {offer.arrivalLabel} · {offer.availableSeats} place(s) · {format(offer.departureDatetime, 'd MMM HH:mm', { locale: fr })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Places proposées">
                <input
                  type="number"
                  min={1}
                  max={Math.min(8, myOffers.find((offer) => offer.id === offerForm.offerPostId)?.availableSeats ?? 1, post.requestedSeats ?? 8)}
                  value={offerForm.seats}
                  onChange={(event) => setOfferForm((current) => ({ ...current, seats: Number(event.target.value) }))}
                  className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                  required
                />
              </Field>
            </div>
            <Field label="Message au demandeur">
              <textarea
                rows={3}
                value={offerForm.message}
                onChange={(event) => setOfferForm((current) => ({ ...current, message: event.target.value }))}
                className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="Point de rendez-vous, véhicule, précision d’horaire..."
              />
            </Field>
            <button type="submit" disabled={saving || !offerForm.offerPostId} className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50">
              {saving ? 'Envoi...' : 'Envoyer ma proposition'}
            </button>
          </form>
        </section>
      )}

      {post.kind === 'need' && !isOwner && myOffers.length === 0 && post.status !== 'matched' && post.status !== 'cancelled' && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Route size={18} />
            <h2 className="text-headline-md text-on-surface">Vous pouvez répondre avec votre propre offre</h2>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">Publiez une offre de places depuis ce parcours ; elle sera ensuite disponible pour créer la correspondance avec ce besoin.</p>
          <button
            type="button"
            onClick={() => navigate(`${APP_ROUTES.CARPOOL}?compose=offer${post.eventId ? `&eventId=${encodeURIComponent(post.eventId)}` : ''}`)}
            className="mt-4 px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white"
          >
            Publier une offre
          </button>
        </section>
      )}

      <section className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-md text-on-surface">Correspondances</h2>
            <p className="text-body-md text-on-surface-variant mt-1">Chaque proposition reste traçable jusqu’à son acceptation, son refus ou son annulation.</p>
          </div>
          <span className="rounded-full bg-surface-container px-3 py-1 text-label-lg text-on-surface-variant">{post.matches.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {post.matches.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Aucune correspondance pour le moment.</p>
          ) : (
            post.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                post={post}
                currentUserId={user?.id}
                saving={saving}
                onRespond={handleRespond}
                onCancel={handleCancelMatch}
              />
            ))
          )}
        </div>
      </section>

      {acceptedContacts.length > 0 && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            <h2 className="text-headline-md text-on-surface">Coordonnées après validation</h2>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">Ces informations sont visibles uniquement parce qu’une correspondance a été validée.</p>
          <div className="grid gap-3 md:grid-cols-2 mt-4">
            {acceptedContacts.map((contact) => (
              <div key={contact.userId} className="rounded-squircle-sm bg-surface-container p-4">
                <div className="text-body-lg font-semibold text-on-surface">{getContactName(contact.userId, post)}</div>
                <div className="flex flex-wrap gap-3 mt-2 text-body-md text-on-surface-variant">
                  {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail size={15} />{contact.email}</a>}
                  {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone size={15} />{contact.phone}</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchCard({
  match,
  post,
  currentUserId,
  saving,
  onRespond,
  onCancel,
}: {
  match: CarpoolMatch;
  post: CarpoolPost;
  currentUserId?: string;
  saving: boolean;
  onRespond: (matchId: string, status: 'accepted' | 'rejected') => void;
  onCancel: (matchId: string) => void;
}) {
  const isInitiator = match.initiatorId === currentUserId;
  const canRespond = Boolean(
    currentUserId
    && !isInitiator
    && match.status === 'pending'
    && [match.offerAuthorId, match.needAuthorId].includes(currentUserId)
  );
  const counterpart = post.id === match.offerPostId ? match.needAuthorName : match.offerAuthorName;

  return (
    <div className="rounded-squircle-sm bg-surface-container p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-body-lg font-semibold text-on-surface">{counterpart}</div>
          <div className="text-body-md text-on-surface-variant mt-1">
            {match.seatsRequested} place(s) · proposition par {match.initiatorName}
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-label-sm font-semibold uppercase ${matchStatusClass(match.status)}`}>
          {getCarpoolMatchStatusLabel(match.status)}
        </span>
      </div>
      {match.message && <div className="text-body-md text-on-surface-variant">Message : {match.message}</div>}
      <div className="text-label-lg text-on-surface-variant">Créée le {format(match.createdAt, 'd MMM yyyy à HH:mm', { locale: fr })}</div>
      <div className="flex flex-wrap gap-2">
        {canRespond && (
          <>
            <button type="button" disabled={saving} onClick={() => onRespond(match.id, 'accepted')} className="px-3 py-2 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50">
              <Check size={15} className="inline mr-1" /> Accepter
            </button>
            <button type="button" disabled={saving} onClick={() => onRespond(match.id, 'rejected')} className="px-3 py-2 rounded-squircle-sm bg-rose-100 text-rose-700 disabled:opacity-50">
              Refuser
            </button>
          </>
        )}
        {(isInitiator || match.status === 'accepted') && match.status !== 'cancelled' && (
          <button type="button" disabled={saving} onClick={() => onCancel(match.id)} className="px-3 py-2 rounded-squircle-sm bg-surface-container-high text-on-surface disabled:opacity-50">
            <Ban size={15} className="inline mr-1" /> Annuler la correspondance
          </button>
        )}
      </div>
    </div>
  );
}

function getContactName(userId: string, post: CarpoolPost) {
  const match = post.matches.find((candidate) => (
    candidate.offerAuthorId === userId || candidate.needAuthorId === userId
  ));
  if (match) {
    return match.offerAuthorId === userId ? match.offerAuthorName : match.needAuthorName;
  }
  return post.authorId === userId ? post.authorName : 'Formateur';
}

function HandHelpingIcon() {
  return <Users size={18} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-label-lg text-on-surface mb-1.5">{label}</span>
      {children}
    </label>
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
