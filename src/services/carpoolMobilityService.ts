import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import {
  CARPOOL_MATCH_STATUSES,
  CARPOOL_POST_KINDS,
  CARPOOL_POST_STATUSES,
  TABLES,
} from '../utils/constants';
import type {
  CarpoolContact,
  CarpoolMatch,
  CarpoolMatchStatus,
  CarpoolPost,
  CarpoolPostKind,
} from '../types';
import { devUser, isDevAuthBypassEnabled } from '../utils/devAuth';

type CarpoolPostRow = {
  id: string;
  event_id: string | null;
  author_id: string;
  kind: CarpoolPostKind;
  departure_city: string;
  departure_label: string;
  departure_datetime: string;
  arrival_label: string;
  requested_seats: number | null;
  available_seats: number | null;
  total_seats: number | null;
  price_note: string | null;
  vehicle_note: string | null;
  luggage_note: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CarpoolMatchRow = {
  id: string;
  offer_post_id: string;
  need_post_id: string;
  initiator_id: string;
  seats_requested: number;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type EventContextRow = {
  id: string;
  title: string;
  location: string | null;
  date: string;
};

type DirectoryContextRow = {
  id: string;
  display_name: string;
};

type ContactRow = {
  user_id: string;
  email: string;
  phone: string | null;
};

type CreateCarpoolPostInput = {
  authorId: string;
  eventId?: string | null;
  kind: CarpoolPostKind;
  departureCity: string;
  departureLabel: string;
  departureDatetime: Date;
  arrivalLabel: string;
  seats: number;
  priceNote?: string;
  vehicleNote?: string;
  luggageNote?: string;
  notes?: string;
};

type CreateCarpoolMatchInput = {
  offerPostId: string;
  needPostId: string;
  initiatorId: string;
  seatsRequested: number;
  message?: string;
};

const previewNow = new Date();
const previewEventDate = new Date(previewNow.getTime() + 3 * 24 * 60 * 60 * 1000);
const previewEvent = {
  id: 'preview-event-1',
  title: 'Session caisson',
  location: 'Plateau technique Caissons',
  date: previewEventDate,
};
const previewOtherUser = {
  id: 'preview-carpool-user-2',
  displayName: 'Camille Martin',
  email: 'camille.martin@flashover78.local',
  phone: '06 00 00 00 02',
};

const mockPosts: CarpoolPost[] = [
  {
    id: 'preview-mobility-offer-1',
    eventId: previewEvent.id,
    eventTitle: previewEvent.title,
    eventLocation: previewEvent.location,
    eventDate: previewEvent.date,
    authorId: previewOtherUser.id,
    authorName: previewOtherUser.displayName,
    kind: 'offer',
    departureCity: 'Versailles',
    departureLabel: 'Centre de secours',
    departureDatetime: new Date(previewEventDate.getTime() - 90 * 60 * 1000),
    arrivalLabel: previewEvent.location,
    availableSeats: 2,
    totalSeats: 3,
    priceNote: 'Partage du carburant si souhaité',
    vehicleNote: 'Véhicule 5 places',
    luggageNote: 'Coffre disponible',
    notes: 'Départ ponctuel, possibilité de récupérer un formateur sur le trajet.',
    status: 'open',
    createdAt: previewNow,
    updatedAt: previewNow,
    matches: [],
  },
  {
    id: 'preview-mobility-need-1',
    eventId: previewEvent.id,
    eventTitle: previewEvent.title,
    eventLocation: previewEvent.location,
    eventDate: previewEvent.date,
    authorId: devUser.id,
    authorName: devUser.displayName,
    kind: 'need',
    departureCity: 'Versailles',
    departureLabel: 'Gare des Chantiers',
    departureDatetime: new Date(previewEventDate.getTime() - 80 * 60 * 1000),
    arrivalLabel: previewEvent.location,
    requestedSeats: 1,
    status: 'open',
    createdAt: previewNow,
    updatedAt: previewNow,
    matches: [],
  },
  {
    id: 'preview-mobility-need-2',
    eventId: previewEvent.id,
    eventTitle: previewEvent.title,
    eventLocation: previewEvent.location,
    eventDate: previewEvent.date,
    authorId: previewOtherUser.id,
    authorName: previewOtherUser.displayName,
    kind: 'need',
    departureCity: 'Mantes-la-Jolie',
    departureLabel: 'Gare de Mantes',
    departureDatetime: new Date(previewEventDate.getTime() - 70 * 60 * 1000),
    arrivalLabel: previewEvent.location,
    requestedSeats: 1,
    status: 'open',
    createdAt: previewNow,
    updatedAt: previewNow,
    matches: [],
  },
];

const mockMatches: CarpoolMatch[] = [];

function ensureValidStatus<T extends string>(status: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(status as T) ? (status as T) : fallback;
}

function firstRpcRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? data[0] ?? null : data;
}

function getMockPost(id: string) {
  return mockPosts.find((post) => post.id === id) ?? null;
}

function refreshMockPostStatus(postId: string) {
  const post = getMockPost(postId);
  if (!post || ['cancelled', 'completed', 'expired'].includes(post.status)) {
    return;
  }

  const acceptedSeats = mockMatches
    .filter((match) => (
      match.status === 'accepted'
      && (post.kind === 'offer' ? match.offerPostId === post.id : match.needPostId === post.id)
    ))
    .reduce((total, match) => total + match.seatsRequested, 0);

  if (post.kind === 'offer') {
    const availableSeats = Math.max(0, (post.totalSeats ?? 0) - acceptedSeats);
    post.availableSeats = availableSeats;
    post.status = availableSeats === 0
      ? 'matched'
      : acceptedSeats > 0
        ? 'partially_matched'
        : 'open';
  } else {
    post.status = acceptedSeats >= (post.requestedSeats ?? 0)
      ? 'matched'
      : acceptedSeats > 0
        ? 'partially_matched'
        : 'open';
  }
  post.updatedAt = new Date();
}

function hydrateMockPost(post: CarpoolPost): CarpoolPost {
  return {
    ...post,
    matches: mockMatches
      .filter((match) => match.offerPostId === post.id || match.needPostId === post.id)
      .map((match) => ({ ...match })),
  };
}

function findMockMatch(matchId: string) {
  return mockMatches.find((match) => match.id === matchId) ?? null;
}

function mapMockContact(userId: string): CarpoolContact | null {
  if (userId === devUser.id) {
    return { userId, email: devUser.email, phone: devUser.phone };
  }
  if (userId === previewOtherUser.id) {
    return { userId, email: previewOtherUser.email, phone: previewOtherUser.phone };
  }
  return null;
}

async function fetchPostContext(rows: CarpoolPostRow[]) {
  const postIds = rows.map((row) => row.id);
  if (postIds.length === 0) {
    return {
      postMap: new Map<string, CarpoolPostRow>(),
      eventMap: new Map<string, EventContextRow>(),
      profileMap: new Map<string, DirectoryContextRow>(),
      matchesByPost: new Map<string, CarpoolMatchRow[]>(),
    };
  }

  const [offerMatches, needMatches] = await Promise.all([
    supabase.from(TABLES.CARPOOL_MATCHES).select('*').in('offer_post_id', postIds),
    supabase.from(TABLES.CARPOOL_MATCHES).select('*').in('need_post_id', postIds),
  ]);

  if (offerMatches.error) throw offerMatches.error;
  if (needMatches.error) throw needMatches.error;

  const matchMap = new Map<string, CarpoolMatchRow>();
  ([...(offerMatches.data ?? []), ...(needMatches.data ?? [])] as CarpoolMatchRow[]).forEach((row) => {
    matchMap.set(row.id, row);
  });
  const matchRows = Array.from(matchMap.values());
  const knownPostIds = new Set(postIds);
  const relatedPostIds = Array.from(new Set(
    matchRows.flatMap((row) => [row.offer_post_id, row.need_post_id])
      .filter((id) => !knownPostIds.has(id))
  ));

  const relatedPosts = relatedPostIds.length
    ? await supabase.from(TABLES.CARPOOL_POSTS).select('*').in('id', relatedPostIds)
    : { data: [], error: null };

  if (relatedPosts.error) throw relatedPosts.error;

  const allRows = [
    ...rows,
    ...((relatedPosts.data ?? []) as CarpoolPostRow[]),
  ];
  const postMap = new Map(allRows.map((row) => [row.id, row]));
  const eventIds = Array.from(new Set(allRows.map((row) => row.event_id).filter(Boolean))) as string[];
  const profileIds = Array.from(new Set([
    ...allRows.map((row) => row.author_id),
    ...matchRows.map((row) => row.initiator_id),
  ]));

  const [events, profiles] = await Promise.all([
    eventIds.length
      ? supabase.from(TABLES.EVENTS).select('id, title, location, date').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from(TABLES.PROFILE_DIRECTORY).select('id, display_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (events.error) throw events.error;
  if (profiles.error) throw profiles.error;

  const matchesByPost = new Map<string, CarpoolMatchRow[]>();
  matchRows.forEach((row) => {
    matchesByPost.set(row.offer_post_id, [...(matchesByPost.get(row.offer_post_id) ?? []), row]);
    matchesByPost.set(row.need_post_id, [...(matchesByPost.get(row.need_post_id) ?? []), row]);
  });

  return {
    postMap,
    eventMap: new Map(((events.data ?? []) as EventContextRow[]).map((row) => [row.id, row])),
    profileMap: new Map(((profiles.data ?? []) as DirectoryContextRow[]).map((row) => [row.id, row])),
    matchesByPost,
  };
}

function mapPostRow(row: CarpoolPostRow, context: Awaited<ReturnType<typeof fetchPostContext>>): CarpoolPost {
  const event = row.event_id ? context.eventMap.get(row.event_id) : null;
  const author = context.profileMap.get(row.author_id);

  const matches = (context.matchesByPost.get(row.id) ?? [])
    .map((matchRow) => {
      const offer = context.postMap.get(matchRow.offer_post_id);
      const need = context.postMap.get(matchRow.need_post_id);
      if (!offer || !need) {
        return null;
      }

      return {
        id: matchRow.id,
        offerPostId: matchRow.offer_post_id,
        needPostId: matchRow.need_post_id,
        offerAuthorId: offer.author_id,
        offerAuthorName: context.profileMap.get(offer.author_id)?.display_name ?? 'Formateur',
        needAuthorId: need.author_id,
        needAuthorName: context.profileMap.get(need.author_id)?.display_name ?? 'Formateur',
        initiatorId: matchRow.initiator_id,
        initiatorName: context.profileMap.get(matchRow.initiator_id)?.display_name ?? 'Formateur',
        seatsRequested: matchRow.seats_requested,
        message: matchRow.message,
        status: ensureValidStatus(matchRow.status, CARPOOL_MATCH_STATUSES, 'pending'),
        createdAt: new Date(matchRow.created_at),
        updatedAt: new Date(matchRow.updated_at),
      } satisfies CarpoolMatch;
    })
    .filter((match): match is CarpoolMatch => match !== null);

  return {
    id: row.id,
    eventId: row.event_id,
    eventTitle: event?.title ?? null,
    eventLocation: event?.location ?? null,
    eventDate: event?.date ? new Date(event.date) : null,
    authorId: row.author_id,
    authorName: author?.display_name ?? 'Formateur',
    kind: ensureValidStatus(row.kind, CARPOOL_POST_KINDS, 'offer'),
    departureCity: row.departure_city,
    departureLabel: row.departure_label,
    departureDatetime: new Date(row.departure_datetime),
    arrivalLabel: row.arrival_label,
    requestedSeats: row.requested_seats,
    availableSeats: row.available_seats,
    totalSeats: row.total_seats,
    priceNote: row.price_note,
    vehicleNote: row.vehicle_note,
    luggageNote: row.luggage_note,
    notes: row.notes,
    status: ensureValidStatus(row.status, CARPOOL_POST_STATUSES, 'open'),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    matches,
  };
}

async function queryPostRows(eventId?: string, authorId?: string) {
  assertSupabaseConfigured();
  let query = supabase
    .from(TABLES.CARPOOL_POSTS)
    .select('*')
    .order('departure_datetime', { ascending: true });

  if (eventId) query = query.eq('event_id', eventId);
  if (authorId) query = query.eq('author_id', authorId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CarpoolPostRow[];
}

async function mapPostRows(rows: CarpoolPostRow[]) {
  const context = await fetchPostContext(rows);
  return rows.map((row) => mapPostRow(row, context));
}

export async function listCarpoolPosts(eventId?: string): Promise<CarpoolPost[]> {
  if (isDevAuthBypassEnabled) {
    return mockPosts
      .filter((post) => !eventId || post.eventId === eventId)
      .sort((a, b) => a.departureDatetime.getTime() - b.departureDatetime.getTime())
      .map(hydrateMockPost);
  }

  return mapPostRows(await queryPostRows(eventId));
}

export async function listMyCarpoolPosts(userId: string): Promise<CarpoolPost[]> {
  if (isDevAuthBypassEnabled) {
    return mockPosts
      .filter((post) => post.authorId === userId)
      .sort((a, b) => a.departureDatetime.getTime() - b.departureDatetime.getTime())
      .map(hydrateMockPost);
  }

  return mapPostRows(await queryPostRows(undefined, userId));
}

export async function getCarpoolPostById(id: string): Promise<CarpoolPost | null> {
  if (isDevAuthBypassEnabled) {
    const post = getMockPost(id);
    return post ? hydrateMockPost(post) : null;
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from(TABLES.CARPOOL_POSTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const [post] = await mapPostRows([data as CarpoolPostRow]);
  return post ?? null;
}

export async function createCarpoolPost(input: CreateCarpoolPostInput): Promise<CarpoolPost> {
  if (isDevAuthBypassEnabled) {
    const event = input.eventId === previewEvent.id ? previewEvent : null;
    const now = new Date();
    const post: CarpoolPost = {
      id: `preview-mobility-${Date.now()}`,
      eventId: input.eventId ?? null,
      eventTitle: event?.title ?? null,
      eventLocation: event?.location ?? null,
      eventDate: event?.date ?? null,
      authorId: input.authorId,
      authorName: input.authorId === devUser.id ? devUser.displayName : previewOtherUser.displayName,
      kind: input.kind,
      departureCity: input.departureCity.trim(),
      departureLabel: input.departureLabel.trim(),
      departureDatetime: input.departureDatetime,
      arrivalLabel: input.arrivalLabel.trim(),
      requestedSeats: input.kind === 'need' ? input.seats : null,
      availableSeats: input.kind === 'offer' ? input.seats : null,
      totalSeats: input.kind === 'offer' ? input.seats : null,
      priceNote: input.kind === 'offer' ? input.priceNote?.trim() || null : null,
      vehicleNote: input.kind === 'offer' ? input.vehicleNote?.trim() || null : null,
      luggageNote: input.kind === 'offer' ? input.luggageNote?.trim() || null : null,
      notes: input.notes?.trim() || null,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      matches: [],
    };
    mockPosts.push(post);
    return hydrateMockPost(post);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('create_carpool_post', {
    p_event_id: input.eventId ?? null,
    p_kind: input.kind,
    p_departure_city: input.departureCity,
    p_departure_label: input.departureLabel,
    p_departure_datetime: input.departureDatetime.toISOString(),
    p_arrival_label: input.arrivalLabel,
    p_seats: input.seats,
    p_price_note: input.priceNote ?? null,
    p_vehicle_note: input.vehicleNote ?? null,
    p_luggage_note: input.luggageNote ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;
  const createdId = firstRpcRow(data as CarpoolPostRow | CarpoolPostRow[] | null)?.id;
  if (!createdId) throw new Error('La publication n’a pas pu être créée.');
  const createdPost = await getCarpoolPostById(createdId);
  if (!createdPost) throw new Error('La publication créée est introuvable.');
  return createdPost;
}

export async function cancelCarpoolPost(postId: string, actingUserId?: string) {
  if (isDevAuthBypassEnabled) {
    const post = getMockPost(postId);
    if (!post || post.authorId !== (actingUserId ?? devUser.id)) {
      throw new Error('Publication introuvable ou action non autorisée');
    }
    mockMatches.forEach((match) => {
      if ((match.offerPostId === postId || match.needPostId === postId)
        && (match.status === 'pending' || match.status === 'accepted')) {
        match.status = 'cancelled';
        match.updatedAt = new Date();
      }
    });
    post.status = 'cancelled';
    post.updatedAt = new Date();
    mockMatches.forEach((match) => {
      refreshMockPostStatus(match.offerPostId);
      refreshMockPostStatus(match.needPostId);
    });
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('cancel_carpool_post', { p_post_id: postId });
  if (error) throw error;
}

export async function requestCarpoolRide(input: {
  offerPostId: string;
  requesterId: string;
  seatsRequested: number;
  message?: string;
}): Promise<CarpoolPost> {
  if (isDevAuthBypassEnabled) {
    const offer = getMockPost(input.offerPostId);
    if (
      !offer
      || offer.kind !== 'offer'
      || offer.authorId === input.requesterId
      || !['open', 'partially_matched'].includes(offer.status)
    ) {
      throw new Error('Offre de trajet introuvable');
    }
    if (!Number.isInteger(input.seatsRequested) || input.seatsRequested < 1 || (offer.availableSeats ?? 0) < input.seatsRequested) {
      throw new Error('Cette offre ne dispose pas de suffisamment de places');
    }
    if (mockMatches.some((match) => (
      match.offerPostId === offer.id
      && match.initiatorId === input.requesterId
      && match.status !== 'rejected'
      && match.status !== 'cancelled'
    ))) {
      throw new Error('Vous avez déjà une demande active sur cette offre');
    }

    const now = new Date();
    const need: CarpoolPost = {
      id: `preview-mobility-${Date.now()}`,
      eventId: offer.eventId,
      eventTitle: offer.eventTitle,
      eventLocation: offer.eventLocation,
      eventDate: offer.eventDate,
      authorId: input.requesterId,
      authorName: input.requesterId === devUser.id ? devUser.displayName : previewOtherUser.displayName,
      kind: 'need',
      departureCity: offer.departureCity,
      departureLabel: offer.departureLabel,
      departureDatetime: offer.departureDatetime,
      arrivalLabel: offer.arrivalLabel,
      requestedSeats: input.seatsRequested,
      notes: input.message?.trim() || null,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      matches: [],
    };
    const match: CarpoolMatch = {
      id: `preview-match-${Date.now()}`,
      offerPostId: offer.id,
      needPostId: need.id,
      offerAuthorId: offer.authorId,
      offerAuthorName: offer.authorName,
      needAuthorId: need.authorId,
      needAuthorName: need.authorName,
      initiatorId: input.requesterId,
      initiatorName: need.authorName,
      seatsRequested: input.seatsRequested,
      message: input.message?.trim() || null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    mockPosts.push(need);
    mockMatches.push(match);
    return hydrateMockPost(need);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('request_carpool_ride', {
    p_offer_post_id: input.offerPostId,
    p_seats_requested: input.seatsRequested,
    p_message: input.message ?? null,
  });
  if (error) throw error;
  const createdId = firstRpcRow(data as CarpoolPostRow | CarpoolPostRow[] | null)?.id;
  if (!createdId) throw new Error('La demande de trajet n’a pas pu être créée.');
  const createdPost = await getCarpoolPostById(createdId);
  if (!createdPost) throw new Error('La demande créée est introuvable.');
  return createdPost;
}

export async function completeCarpoolPost(postId: string, actingUserId?: string) {
  if (isDevAuthBypassEnabled) {
    const post = getMockPost(postId);
    if (!post || post.authorId !== (actingUserId ?? devUser.id)) {
      throw new Error('Publication introuvable ou action non autorisée');
    }
    post.status = 'completed';
    post.updatedAt = new Date();
    mockMatches.forEach((match) => {
      if ((match.offerPostId === postId || match.needPostId === postId) && match.status === 'pending') {
        match.status = 'cancelled';
        match.updatedAt = new Date();
      }
    });
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('complete_carpool_post', { p_post_id: postId });
  if (error) throw error;
}

export async function createCarpoolMatch(input: CreateCarpoolMatchInput) {
  if (isDevAuthBypassEnabled) {
    const offer = getMockPost(input.offerPostId);
    const need = getMockPost(input.needPostId);
    if (!offer || !need || offer.kind !== 'offer' || need.kind !== 'need') {
      throw new Error('La correspondance doit relier une offre et un besoin');
    }
    if (offer.eventId && need.eventId && offer.eventId !== need.eventId) {
      throw new Error('Les publications concernent deux formations différentes');
    }
    if (offer.authorId === need.authorId || ![offer.authorId, need.authorId].includes(input.initiatorId)) {
      throw new Error('Action non autorisée');
    }
    if (offer.status !== 'open' && offer.status !== 'partially_matched') {
      throw new Error('Cette offre n’a plus de place disponible');
    }
    if ((offer.availableSeats ?? 0) < input.seatsRequested) {
      throw new Error('Cette offre ne dispose pas de suffisamment de places');
    }
    const acceptedNeedSeats = mockMatches
      .filter((match) => match.needPostId === need.id && match.status === 'accepted')
      .reduce((total, match) => total + match.seatsRequested, 0);
    if ((need.requestedSeats ?? 0) - acceptedNeedSeats < input.seatsRequested) {
      throw new Error('Ce besoin est déjà couvert ou indisponible');
    }
    if (mockMatches.some((match) => (
      match.offerPostId === offer.id
      && match.needPostId === need.id
      && (match.status === 'pending' || match.status === 'accepted')
    ))) {
      throw new Error('Une correspondance est déjà en cours pour ces publications');
    }

    const match: CarpoolMatch = {
      id: `preview-match-${Date.now()}`,
      offerPostId: offer.id,
      needPostId: need.id,
      offerAuthorId: offer.authorId,
      offerAuthorName: offer.authorName,
      needAuthorId: need.authorId,
      needAuthorName: need.authorName,
      initiatorId: input.initiatorId,
      initiatorName: input.initiatorId === devUser.id ? devUser.displayName : previewOtherUser.displayName,
      seatsRequested: input.seatsRequested,
      message: input.message?.trim() || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockMatches.push(match);
    return match;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('create_carpool_match', {
    p_offer_post_id: input.offerPostId,
    p_need_post_id: input.needPostId,
    p_seats_requested: input.seatsRequested,
    p_message: input.message ?? null,
  });
  if (error) throw error;
}

export async function respondToCarpoolMatch(
  matchId: string,
  status: Extract<CarpoolMatchStatus, 'accepted' | 'rejected'>,
  actingUserId?: string
) {
  if (isDevAuthBypassEnabled) {
    const match = findMockMatch(matchId);
    const actorId = actingUserId ?? devUser.id;
    if (!match) throw new Error('Correspondance introuvable');
    if (match.status !== 'pending') throw new Error('Cette correspondance a déjà été traitée');
    if (actorId === match.initiatorId || ![match.offerAuthorId, match.needAuthorId].includes(actorId)) {
      throw new Error('Action réservée à l’autre formateur');
    }
    if (status === 'accepted') {
      const offer = getMockPost(match.offerPostId);
      const need = getMockPost(match.needPostId);
      if (!offer || !need || (offer.availableSeats ?? 0) < match.seatsRequested) {
        throw new Error('Plus assez de places disponibles');
      }
      const acceptedNeedSeats = mockMatches
        .filter((candidate) => candidate.needPostId === need.id && candidate.status === 'accepted')
        .reduce((total, candidate) => total + candidate.seatsRequested, 0);
      if ((need.requestedSeats ?? 0) - acceptedNeedSeats < match.seatsRequested) {
        throw new Error('Ce besoin est déjà couvert ou indisponible');
      }
    }
    match.status = status;
    match.updatedAt = new Date();
    if (status === 'accepted') {
      refreshMockPostStatus(match.offerPostId);
      refreshMockPostStatus(match.needPostId);
      const need = getMockPost(match.needPostId);
      if (need?.status === 'matched') {
        mockMatches.forEach((candidate) => {
          if (candidate.needPostId === need.id && candidate.status === 'pending' && candidate.id !== match.id) {
            candidate.status = 'rejected';
          }
        });
      }
    }
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('respond_to_carpool_match', {
    p_match_id: matchId,
    p_status: status,
  });
  if (error) throw error;
}

export async function cancelCarpoolMatch(matchId: string, actingUserId?: string) {
  if (isDevAuthBypassEnabled) {
    const match = findMockMatch(matchId);
    const actorId = actingUserId ?? devUser.id;
    if (!match) throw new Error('Correspondance introuvable');
    if (![match.initiatorId, match.offerAuthorId, match.needAuthorId].includes(actorId)) {
      throw new Error('Action non autorisée');
    }
    if (match.status === 'cancelled') return;
    const wasAccepted = match.status === 'accepted';
    match.status = 'cancelled';
    match.updatedAt = new Date();
    if (wasAccepted) {
      refreshMockPostStatus(match.offerPostId);
      refreshMockPostStatus(match.needPostId);
    }
    return;
  }

  assertSupabaseConfigured();
  const { error } = await supabase.rpc('cancel_carpool_match', { p_match_id: matchId });
  if (error) throw error;
}

export async function getCarpoolPostContacts(postId: string, actingUserId?: string): Promise<CarpoolContact[]> {
  if (isDevAuthBypassEnabled) {
    const post = getMockPost(postId);
    const actorId = actingUserId ?? devUser.id;
    if (!post) throw new Error('Publication introuvable');
    const acceptedMatches = mockMatches.filter((match) => (
      match.status === 'accepted'
      && (match.offerPostId === postId || match.needPostId === postId)
      && [match.offerAuthorId, match.needAuthorId].includes(actorId)
    ));
    if (post.authorId !== actorId && acceptedMatches.length === 0) {
      throw new Error('Contacts disponibles après validation uniquement');
    }
    const userIds = new Set<string>([post.authorId]);
    acceptedMatches.forEach((match) => {
      userIds.add(match.offerAuthorId);
      userIds.add(match.needAuthorId);
    });
    return Array.from(userIds)
      .map(mapMockContact)
      .filter((contact): contact is CarpoolContact => contact !== null);
  }

  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_carpool_post_contacts', { p_post_id: postId });
  if (error) throw error;
  return ((data ?? []) as ContactRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    phone: row.phone,
  }));
}
