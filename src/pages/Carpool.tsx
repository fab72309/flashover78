import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Filter,
  HandHelping,
  MapPin,
  MessageSquarePlus,
  RefreshCw,
  Route,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import type { CalendarEvent, CarpoolPost, CarpoolPostKind } from '../types';
import { listEvents } from '../services/supabaseService';
import {
  createCarpoolPost,
  listCarpoolPosts,
  listMyCarpoolPosts,
} from '../services/carpoolMobilityService';
import { APP_ROUTES } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';
import { getUserFacingError } from '../utils/userFacingError';
import { logClientFailure } from '../utils/clientDiagnostics';
import {
  getCarpoolPostKindLabel,
  getCarpoolPostStatusLabel,
} from '../utils/statusLabels';

type PostFormState = {
  eventId: string;
  kind: CarpoolPostKind;
  departureCity: string;
  departureLabel: string;
  departureDatetime: string;
  arrivalLabel: string;
  seats: number;
  vehicleNote: string;
  luggageNote: string;
  priceNote: string;
  notes: string;
};

type FeedKindFilter = 'all' | CarpoolPostKind;

const createInitialPostForm = (eventId = '', kind: CarpoolPostKind = 'offer'): PostFormState => ({
  eventId,
  kind,
  departureCity: '',
  departureLabel: '',
  departureDatetime: '',
  arrivalLabel: '',
  seats: 1,
  vehicleNote: '',
  luggageNote: '',
  priceNote: '',
  notes: '',
});

function toDateTimeLocal(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

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

export default function Carpool() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const selectedEventId = searchParams.get('eventId') ?? undefined;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [posts, setPosts] = useState<CarpoolPost[]>([]);
  const [myPosts, setMyPosts] = useState<CarpoolPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postForm, setPostForm] = useState<PostFormState>(() => (
    createInitialPostForm(selectedEventId ?? '', 'offer')
  ));
  const [filters, setFilters] = useState({
    search: '',
    departureCity: '',
    kind: 'all' as FeedKindFilter,
    onlyActive: true,
  });

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [eventRows, postRows, myPostRows] = await Promise.all([
        listEvents(),
        listCarpoolPosts(selectedEventId),
        listMyCarpoolPosts(user.id),
      ]);
      setEvents(eventRows);
      setPosts(postRows);
      setMyPosts(myPostRows);
    } catch (err) {
      logClientFailure('Chargement des publications de covoiturage impossible');
      setError(getUserFacingError(err, 'Erreur lors du chargement des publications'));
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const requestedKind = searchParams.get('compose');
    if (requestedKind !== 'offer' && requestedKind !== 'need') return;

    setPostForm((current) => ({
      ...current,
      eventId: selectedEventId ?? current.eventId,
      kind: requestedKind,
    }));
    setShowComposer(true);
  }, [searchParams, selectedEventId]);

  const filteredPosts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const departureCity = filters.departureCity.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesQuery = !query || [
        post.departureCity,
        post.departureLabel,
        post.arrivalLabel,
        post.authorName,
        post.eventTitle ?? '',
      ].some((value) => value.toLowerCase().includes(query));
      const matchesCity = !departureCity || post.departureCity.toLowerCase().includes(departureCity);
      const matchesKind = filters.kind === 'all' || post.kind === filters.kind;
      const matchesStatus = !filters.onlyActive || ['open', 'partially_matched'].includes(post.status);
      return matchesQuery && matchesCity && matchesKind && matchesStatus;
    });
  }, [filters, posts]);

  const correspondenceCount = useMemo(() => (
    Array.from(new Map(
      myPosts.flatMap((post) => post.matches).map((match) => [match.id, match])
    ).values()).filter((match) => match.status === 'pending' || match.status === 'accepted').length
  ), [myPosts]);

  const openComposer = (kind: CarpoolPostKind, source?: CarpoolPost) => {
    const sourceEventId = source?.eventId ?? selectedEventId ?? '';
    setPostForm({
      ...createInitialPostForm(sourceEventId, kind),
      departureCity: source?.departureCity ?? '',
      departureLabel: source?.departureLabel ?? '',
      departureDatetime: source ? toDateTimeLocal(source.departureDatetime) : '',
      arrivalLabel: source?.arrivalLabel ?? '',
      seats: kind === 'need' ? 1 : source?.totalSeats ?? 1,
      notes: source?.notes ?? '',
    });
    setShowComposer(true);
  };

  const handlePostSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const departureDatetime = new Date(postForm.departureDatetime);
    const seats = Number(postForm.seats);
    if (!postForm.eventId) {
      showToast('Associez la publication à une formation.', 'error');
      return;
    }
    if (Number.isNaN(departureDatetime.getTime())) {
      showToast('Indiquez une date et une heure de départ valides.', 'error');
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) {
      showToast('Le nombre de places doit être compris entre 1 et 8.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createCarpoolPost({
        authorId: user.id,
        eventId: postForm.eventId,
        kind: postForm.kind,
        departureCity: postForm.departureCity,
        departureLabel: postForm.departureLabel,
        departureDatetime,
        arrivalLabel: postForm.arrivalLabel,
        seats,
        vehicleNote: postForm.vehicleNote,
        luggageNote: postForm.luggageNote,
        priceNote: postForm.priceNote,
        notes: postForm.notes,
      });
      setShowComposer(false);
      setPostForm(createInitialPostForm(selectedEventId ?? '', 'offer'));
      await loadData();
      showToast(postForm.kind === 'offer' ? 'Offre de places publiée.' : 'Besoin de trajet publié.', 'success');
    } catch (err) {
      logClientFailure('Publication de covoiturage impossible');
      showToast(getUserFacingError(err, 'Impossible de publier cette mobilité.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <section className="surface-card p-5 overflow-hidden relative">
        <div className="absolute inset-y-0 right-0 w-56 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-label-lg">
                <CarFront size={16} />
                Co)Voiturage formateurs
              </div>
              <h1 className="text-display-sm text-on-surface mt-3">Covoiturage</h1>
              <p className="text-body-lg text-on-surface-variant mt-2">
                Publiez une offre ou un besoin autour d’une même formation. Les correspondances restent en attente jusqu’à validation par les personnes concernées.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-3 rounded-squircle-sm bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Actualiser
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openComposer('offer')}
              className="group flex min-h-32 w-full items-center justify-between gap-4 rounded-squircle border-2 border-primary bg-primary px-5 py-5 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Route size={21} />
                </span>
                <span>
                  <span className="block text-headline-sm font-semibold">Je propose des places</span>
                  <span className="mt-1.5 block text-body-md text-white/85">Je publie mon trajet et le nombre de places disponibles.</span>
                </span>
              </span>
              <ArrowRight size={22} className="shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => openComposer('need')}
              className="group flex min-h-32 w-full items-center justify-between gap-4 rounded-squircle border-2 border-secondary bg-secondary px-5 py-5 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <MessageSquarePlus size={21} />
                </span>
                <span>
                  <span className="block text-headline-sm font-semibold">Demander un trajet</span>
                  <span className="mt-1.5 block text-body-md text-white/85">Je publie mon besoin ; les conducteurs peuvent ensuite proposer une correspondance.</span>
                </span>
              </span>
              <ArrowRight size={22} className="shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              icon={<CarFront size={18} />}
              label="Publications actives"
              value={posts.filter((post) => ['open', 'partially_matched'].includes(post.status)).length}
            />
            <StatCard
              icon={<HandHelping size={18} />}
              label="Besoins à couvrir"
              value={posts.filter((post) => post.kind === 'need' && ['open', 'partially_matched'].includes(post.status)).length}
            />
            <StatCard icon={<CheckCircle2 size={18} />} label="Mes correspondances" value={correspondenceCount} />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Ville, point de départ, formation, auteur..."
                className="w-full rounded-full bg-surface-container-highest pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant"
              />
            </label>
            <label className="relative block">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                value={filters.departureCity}
                onChange={(event) => setFilters((current) => ({ ...current, departureCity: event.target.value }))}
                placeholder="Filtrer par ville"
                className="w-full rounded-full bg-surface-container-highest pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant"
              />
            </label>
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, onlyActive: !current.onlyActive }))}
              className={`px-4 py-3 rounded-full text-body-md transition-colors flex items-center justify-center gap-2 ${
                filters.onlyActive ? 'btn-primary-gradient text-white' : 'bg-surface-container text-on-surface'
              }`}
            >
              <Filter size={18} />
              Actives
            </button>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Filtrer par type de publication">
            {(['all', 'offer', 'need'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, kind }))}
                className={`px-3 py-2 rounded-full text-label-lg transition-colors ${
                  filters.kind === kind ? 'bg-on-surface text-surface' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {kind === 'all' ? 'Toutes' : getCarpoolPostKindLabel(kind)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {showComposer && (
        <PostComposer
          events={events}
          form={postForm}
          saving={saving}
          onChange={setPostForm}
          onClose={() => setShowComposer(false)}
          onSubmit={handlePostSubmit}
        />
      )}

      <section className="rounded-squircle bg-sky-50 border border-sky-100 p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-sky-700 mt-0.5 shrink-0" />
        <div className="text-body-md text-sky-950">
          <strong>Comment ça marche ?</strong> Une publication reste ouverte tant qu’elle n’est pas annulée ou terminée. Une correspondance peut être proposée par l’un des deux formateurs ; elle devient validée seulement après l’acceptation de l’autre. Les coordonnées ne sont accessibles qu’après validation.
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="surface-card p-5 text-red-600">{error}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-headline-md text-on-surface">Publications de mobilité</h2>
                <p className="text-body-md text-on-surface-variant mt-1">Offres et besoins rattachés aux formations à venir.</p>
              </div>
              <span className="text-label-lg text-on-surface-variant">{filteredPosts.length} résultat(s)</span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="surface-card p-6 text-on-surface-variant">
                Aucune publication ne correspond aux filtres actuels. Vous pouvez publier votre besoin même si aucune offre n’est encore disponible.
              </div>
            ) : (
              filteredPosts.map((post) => (
                <MobilityPostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  onOpen={() => navigate(`${APP_ROUTES.CARPOOL}/${post.id}`)}
                  onCreateNeed={() => openComposer('need', post)}
                />
              ))
            )}
          </section>

          <section className="surface-card p-5 h-fit">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-primary" />
              <h2 className="text-headline-sm text-on-surface">Mes publications</h2>
            </div>
            <p className="text-body-md text-on-surface-variant mt-1">Retrouvez ici vos offres, vos besoins et leurs correspondances.</p>
            <div className="mt-4 space-y-3">
              {myPosts.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">Vous n’avez encore rien publié.</p>
              ) : (
                myPosts.map((post) => (
                  <div key={post.id} className="rounded-squircle-sm bg-surface-container p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-label-lg text-primary">{getCarpoolPostKindLabel(post.kind)}</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-1">
                          {post.departureCity} <ArrowRight size={15} className="inline mx-1" /> {post.arrivalLabel}
                        </div>
                        <div className="text-label-lg text-on-surface-variant mt-1">
                          {format(post.departureDatetime, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-label-sm font-semibold uppercase ${postStatusClass(post.status)}`}>
                        {getCarpoolPostStatusLabel(post.status)}
                      </span>
                    </div>
                    <div className="text-body-md text-on-surface-variant">
                      {post.kind === 'offer'
                        ? `${post.availableSeats ?? 0} / ${post.totalSeats ?? 0} place(s) disponible(s)`
                        : `${post.requestedSeats ?? 0} place(s) recherchée(s)`}
                    </div>
                    {post.matches.length > 0 && (
                      <div className="text-label-lg text-on-surface-variant">
                        {post.matches.filter((match) => match.status === 'pending').length} proposition(s) en attente · {post.matches.filter((match) => match.status === 'accepted').length} validée(s)
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`${APP_ROUTES.CARPOOL}/${post.id}`)}
                      className="w-full px-3 py-2 rounded-squircle-sm bg-surface-container-high text-on-surface"
                    >
                      Gérer la publication
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PostComposer({
  events,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  events: CalendarEvent[];
  form: PostFormState;
  saving: boolean;
  onChange: (next: PostFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const selectedEvent = events.find((event) => event.id === form.eventId);
  const setField = <K extends keyof PostFormState>(field: K, value: PostFormState[K]) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <form onSubmit={onSubmit} className="surface-card p-5 space-y-5" aria-labelledby="mobility-composer-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-label-lg text-primary uppercase tracking-wide">Publication de mobilité</div>
          <h2 id="mobility-composer-title" className="text-headline-md text-on-surface mt-1">
            {form.kind === 'offer' ? 'Je propose des places' : 'Demander un trajet'}
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">Les deux parcours créent le même type d’évènement et pourront ensuite être associés.</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-squircle-sm text-on-surface-variant hover:bg-surface-container" aria-label="Fermer la publication">
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['offer', 'need'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange({ ...form, kind })}
            className={`rounded-squircle-sm p-4 text-left border transition-colors ${
              form.kind === kind ? 'border-primary bg-primary/10' : 'border-transparent bg-surface-container'
            }`}
          >
            <div className="text-label-lg text-primary">{getCarpoolPostKindLabel(kind)}</div>
            <div className="text-body-md text-on-surface mt-1">
              {kind === 'offer' ? 'Je conduis et je peux accueillir un ou plusieurs formateurs.' : 'Je souhaite rejoindre la formation depuis mon point de départ.'}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Formation">
          <select
            value={form.eventId}
            onChange={(event) => {
              const nextEventId = event.target.value;
              const nextEvent = events.find((candidate) => candidate.id === nextEventId);
              onChange({
                ...form,
                eventId: nextEventId,
                arrivalLabel: form.arrivalLabel || nextEvent?.location || '',
              });
            }}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            required
          >
            <option value="">Sélectionner une formation</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {format(event.date, 'dd MMM yyyy HH:mm', { locale: fr })}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ville de départ">
          <input
            value={form.departureCity}
            onChange={(event) => setField('departureCity', event.target.value)}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            placeholder="Versailles, Mantes, Rambouillet..."
            required
          />
        </Field>

        <Field label="Point de rendez-vous">
          <input
            value={form.departureLabel}
            onChange={(event) => setField('departureLabel', event.target.value)}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            placeholder="Centre de secours, parking, gare..."
            required
          />
        </Field>

        <Field label="Heure de départ">
          <input
            type="datetime-local"
            value={form.departureDatetime}
            onChange={(event) => setField('departureDatetime', event.target.value)}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            required
          />
        </Field>

        <Field label="Destination / site de formation">
          <input
            value={form.arrivalLabel}
            onChange={(event) => setField('arrivalLabel', event.target.value)}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            placeholder={selectedEvent?.location || 'Site de formation'}
            required
          />
        </Field>

        <Field label={form.kind === 'offer' ? 'Places proposées' : 'Places recherchées'}>
          <input
            type="number"
            min={1}
            max={8}
            value={form.seats}
            onChange={(event) => setField('seats', Number(event.target.value))}
            className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
            required
          />
        </Field>
      </div>

      {form.kind === 'offer' && (
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Véhicule">
            <input
              value={form.vehicleNote}
              onChange={(event) => setField('vehicleNote', event.target.value)}
              className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
              placeholder="Véhicule 5 places..."
            />
          </Field>
          <Field label="Bagages / matériel">
            <input
              value={form.luggageNote}
              onChange={(event) => setField('luggageNote', event.target.value)}
              className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
              placeholder="Coffre disponible..."
            />
          </Field>
          <Field label="Participation">
            <input
              value={form.priceNote}
              onChange={(event) => setField('priceNote', event.target.value)}
              className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
              placeholder="Partage du carburant..."
            />
          </Field>
        </div>
      )}

      <Field label={form.kind === 'offer' ? 'Informations pour les passagers' : 'Précisions pour les conducteurs'}>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => setField('notes', event.target.value)}
          className="w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-on-surface"
          placeholder={form.kind === 'offer' ? 'Détails utiles sur le trajet...' : 'Horaires, matériel, contraintes particulières...'}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label-lg text-on-surface-variant flex items-center gap-2">
          <CalendarDays size={16} />
          La publication sera visible par les formateurs concernés.
        </p>
        <button type="submit" disabled={saving} className="px-5 py-3 rounded-squircle-sm btn-primary-gradient text-white disabled:opacity-50">
          {saving ? 'Publication...' : form.kind === 'offer' ? 'Publier l’offre' : 'Publier le besoin'}
        </button>
      </div>
    </form>
  );
}

function MobilityPostCard({
  post,
  currentUserId,
  onOpen,
  onCreateNeed,
}: {
  post: CarpoolPost;
  currentUserId?: string;
  onOpen: () => void;
  onCreateNeed: () => void;
}) {
  const isOwner = post.authorId === currentUserId;
  const pendingMatches = post.matches.filter((match) => match.status === 'pending').length;

  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-label-lg">
            <span className={`px-2.5 py-1 rounded-full ${post.kind === 'offer' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
              {getCarpoolPostKindLabel(post.kind)}
            </span>
            {isOwner && <span className="text-on-surface-variant">Ma publication</span>}
          </div>
          <h3 className="text-headline-md text-on-surface mt-3">
            {post.departureCity} <ArrowRight size={20} className="inline mx-1 text-primary" /> {post.arrivalLabel}
          </h3>
          <div className="flex items-center gap-2 text-body-md text-on-surface-variant mt-2">
            <MapPin size={16} />
            {post.departureLabel}
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-label-sm font-semibold uppercase ${postStatusClass(post.status)}`}>
          {getCarpoolPostStatusLabel(post.status)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mt-5">
        <Meta icon={<Clock3 size={16} />} label={format(post.departureDatetime, "EEEE d MMMM 'à' HH:mm", { locale: fr })} />
        <Meta
          icon={<Users size={16} />}
          label={post.kind === 'offer'
            ? `${post.availableSeats ?? 0} / ${post.totalSeats ?? 0} places`
            : `${post.requestedSeats ?? 0} place(s) recherchée(s)`}
        />
        <Meta icon={<UserRound size={16} />} label={post.authorName} />
      </div>

      <div className="mt-4 grid gap-2 text-body-md text-on-surface-variant">
        {post.eventTitle && <div>Formation : {post.eventTitle}</div>}
        {post.eventLocation && <div>Site : {post.eventLocation}</div>}
        {post.kind === 'offer' && post.vehicleNote && <div>Véhicule : {post.vehicleNote}</div>}
        {post.kind === 'offer' && post.priceNote && <div>Participation : {post.priceNote}</div>}
        {post.notes && <div>Note : {post.notes}</div>}
      </div>

      {isOwner && pendingMatches > 0 && (
        <div className="mt-4 rounded-squircle-sm bg-amber-50 text-amber-900 px-4 py-3 text-body-md">
          {pendingMatches} proposition(s) attendent votre validation.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!isOwner && post.kind === 'offer' && post.status !== 'matched' && (
          <button type="button" onClick={onCreateNeed} className="px-4 py-2.5 rounded-squircle-sm btn-primary-gradient text-white">
            Créer mon besoin pour ce trajet
          </button>
        )}
        {!isOwner && post.kind === 'need' && post.status !== 'matched' && (
          <button type="button" onClick={onOpen} className="px-4 py-2.5 rounded-squircle-sm btn-primary-gradient text-white">
            Répondre à ce besoin
          </button>
        )}
        <button type="button" onClick={onOpen} className="px-4 py-2.5 rounded-squircle-sm bg-surface-container text-on-surface">
          Voir les détails
        </button>
      </div>
    </article>
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

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-squircle bg-surface-container p-4">
      <div className="flex items-center gap-2 text-primary"><span>{icon}</span><span className="text-label-lg">{label}</span></div>
      <div className="text-display-sm text-on-surface mt-3">{value}</div>
    </div>
  );
}
