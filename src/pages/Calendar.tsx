import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import {
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import FormateurAssignments from '../components/FormateurAssignments';
import { useCollection } from '../hooks/useFirestore';
import type { CalendarEvent, TrainerLevel } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-calendar/dist/Calendar.css';
import {
  APP_ROUTES,
  TRAINER_LEVEL_LABELS,
  TRAINER_LEVELS,
} from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import { canContribute } from '../utils/permissions';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const { documents: events, loading } = useCollection<CalendarEvent>('events');
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [search, setSearch] = useState('');
  const [trainerLevelFilter, setTrainerLevelFilter] = useState<TrainerLevel | 'all'>('all');
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const dayContainerRef = useRef<HTMLDivElement | null>(null);

  const toDate = (input: unknown): Date => {
    if (input instanceof Date) return input;
    if (
      input
      && typeof input === 'object'
      && 'toDate' in input
      && typeof input.toDate === 'function'
    ) {
      return input.toDate() as Date;
    }
    return new Date(String(input));
  };

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const filteredEvents = events.filter((event) => {
    const query = search.toLowerCase();
    const formateurSearchText = [
      ...(event.formateurAssignments ?? []).map((assignment) => (
        `${assignment.displayName} ${assignment.level}`
      )),
      ...(event.formateurs ?? []),
    ].join(' ').toLowerCase();
    const matchesTrainerLevel = trainerLevelFilter === 'all'
      || (event.formateurAssignments ?? []).some(
        (assignment) => assignment.level === trainerLevelFilter
      );

    return matchesTrainerLevel && (
      event.title.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query)) ||
      (event.location && event.location.toLowerCase().includes(query)) ||
      formateurSearchText.includes(query)
    );
  });

  const getEventsForCurrentWeek = () => {
    const startOfWeek = getMonday(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return filteredEvents.filter((event) => {
      const eventDate = toDate(event.date);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });
  };

  const getEventsForToday = () => {
    const base = view === 'day' ? currentDate : selectedDate;
    return filteredEvents.filter((event) => {
      const eventDate = toDate(event.date);
      return format(eventDate, 'yyyy-MM-dd') === format(base, 'yyyy-MM-dd');
    });
  };

  const getEventsForDate = (date: Date) =>
    filteredEvents.filter((event) => format(toDate(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));

  const selectedDateEvents = getEventsForDate(selectedDate).sort(
    (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()
  );

  const upcomingEvents = filteredEvents
    .filter((event) => toDate(event.date).getTime() >= today.setHours(0, 0, 0, 0))
    .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime())
    .slice(0, 4);

  const eventsThisMonth = filteredEvents.filter(
    (event) =>
      toDate(event.date).getMonth() === currentDate.getMonth() &&
      toDate(event.date).getFullYear() === currentDate.getFullYear()
  );
  const monthHasSelection = selectedDateEvents.length > 0;

  const handleDateClick = (value: Value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setCurrentDate(value);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth < 768;
      setIsMobile(nextIsMobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (view !== 'day') return;
    const hour = new Date(currentDate).getHours();
    const el = document.getElementById(`hour-${hour}`);
    if (el && dayContainerRef.current) {
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
    }
  }, [view, currentDate]);

  const viewButton = (v: 'day' | 'week' | 'month', label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => {
        setView(v);
        setCurrentDate(selectedDate);
      }}
      className={`px-4 py-2 rounded-full text-label-lg transition-all duration-200 ${
        view === v
          ? 'bg-primary text-white shadow-ambient-sm'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen space-y-5 relative pb-20 fade-in">
      <section className="surface-card p-4 md:p-5 overflow-hidden relative">
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-label-lg">
                <CalendarDays size={16} />
                Vue planning
              </div>
              <h1 className="text-display-sm text-on-surface mt-3">Calendrier des formations</h1>
              <p className="text-body-lg text-on-surface-variant mt-2 max-w-2xl">
                Une vue plus lisible des formations, avec accès direct au co-voiturage et aux créneaux du jour.
              </p>
            </div>

            {!isMobile && (
              <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                <MetricCard label="Ce mois" value={eventsThisMonth.length} icon={<Sparkles size={16} />} />
                <MetricCard label="Jour choisi" value={selectedDateEvents.length} icon={<Clock3 size={16} />} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {viewButton('month', 'Mois')}
              {viewButton('week', 'Semaine')}
              {viewButton('day', 'Jour')}
            </div>

            <div className="flex min-w-0 flex-1 max-w-3xl w-full gap-2 md:w-auto">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  placeholder="Rechercher un événement, un lieu, une formation"
                  className="w-full p-3 pl-11 bg-surface-container-highest rounded-full text-body-md text-on-surface placeholder:text-on-surface-variant"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
              </div>
              <select
                value={trainerLevelFilter}
                onChange={(event) => setTrainerLevelFilter(event.target.value as TrainerLevel | 'all')}
                className="max-w-[12rem] rounded-full bg-surface-container-highest px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Filtrer le calendrier par fonction formateur"
              >
                <option value="all">Toutes les fonctions</option>
                {TRAINER_LEVELS.map((level) => (
                  <option key={level} value={level}>{TRAINER_LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner"></div>
        </div>
      ) : view === 'month' ? (
        <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.35fr)_380px]'}`}>
          <section className="surface-card p-4 md:p-5">
            <div className="calendar-shell">
              <Calendar
                onClickDay={handleDateClick}
                value={selectedDate}
                activeStartDate={currentDate}
                onActiveStartDateChange={({ activeStartDate }) => {
                  if (activeStartDate) {
                    setCurrentDate(activeStartDate);
                  }
                }}
                prev2Label={null}
                next2Label={null}
                prevLabel={<ChevronLeft className="text-primary" size={18} />}
                nextLabel={<ChevronRight className="text-primary" size={18} />}
                className={`calendar-editorial w-full border-none ${isMobile ? 'calendar-editorial-mobile' : ''}`}
                tileClassName={({ date, view: tileView }) => {
                  if (tileView !== 'month') return '';
                  const hasEvents = getEventsForDate(date).length > 0;
                  const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  return [
                    'calendar-tile',
                    hasEvents ? 'calendar-tile-has-events' : '',
                    isToday ? 'calendar-tile-today' : '',
                    isSelected ? 'calendar-tile-selected' : '',
                  ].join(' ');
                }}
                tileContent={({ date, view: tileView }) => {
                  if (tileView !== 'month') return null;
                  const eventsForDate = getEventsForDate(date);
                  if (!eventsForDate.length) return null;
                  return (
                    <div className={`calendar-event-dots ${isMobile ? 'calendar-event-dots-mobile' : ''}`}>
                      {eventsForDate.slice(0, 3).map((event) => (
                        <span key={event.id} className="calendar-event-dot" />
                      ))}
                    </div>
                  );
                }}
                formatShortWeekday={(_, date) => format(date, 'EEE', { locale: fr }).slice(0, 3)}
                navigationLabel={({ date }) => (
                  <div className="calendar-heading">
                    <span className="calendar-heading-month">{format(date, 'MMMM', { locale: fr })}</span>
                    <span className="calendar-heading-year">{format(date, 'yyyy')}</span>
                  </div>
                )}
              />
            </div>

            {isMobile && (
              <div className="mt-4 rounded-squircle bg-surface-container-low p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-body-lg font-semibold text-on-surface">
                      {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-label-sm">
                    {selectedDateEvents.length}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {monthHasSelection ? (
                    selectedDateEvents.slice(0, 3).map((event) => (
                      <EventMiniCard
                        key={event.id}
                        event={event}
                        trainerLevelFilter={trainerLevelFilter}
                        onOpen={() => navigate(`${APP_ROUTES.TRAINING_SESSION}/${event.id}`)}
                        onCarpool={() => navigate(`${APP_ROUTES.CARPOOL}?eventId=${event.id}`)}
                      />
                    ))
                  ) : (
                    <p className="text-body-md text-on-surface-variant">
                      Touchez un jour du mois pour afficher son aperçu.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {!isMobile && <aside className="space-y-4">
            <section className="surface-card p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-label-lg text-primary uppercase tracking-wide">Jour sélectionné</p>
                  <h2 className="text-headline-lg text-on-surface mt-2">
                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  </h2>
                </div>
                <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-label-lg">
                  {selectedDateEvents.length} événement{selectedDateEvents.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedDateEvents.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">
                    Aucun événement prévu ce jour-là.
                  </p>
                ) : (
                  selectedDateEvents.map((event) => (
                    <EventAgendaCard
                      key={event.id}
                      event={event}
                      trainerLevelFilter={trainerLevelFilter}
                      onOpen={() => navigate(`${APP_ROUTES.TRAINING_SESSION}/${event.id}`)}
                      onCarpool={() => navigate(`${APP_ROUTES.CARPOOL}?eventId=${event.id}`)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="surface-card p-4 md:p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h2 className="text-headline-sm text-on-surface">À venir</h2>
              </div>

              <div className="mt-4 space-y-3">
                {upcomingEvents.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Aucun événement à venir.</p>
                ) : (
                  upcomingEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        const eventDate = toDate(event.date);
                        setSelectedDate(eventDate);
                        setCurrentDate(eventDate);
                      }}
                      className="w-full text-left rounded-squircle-sm bg-surface-container p-4 hover:bg-surface-container-high transition-colors"
                    >
                      <div className="text-body-lg font-semibold text-on-surface">{event.title}</div>
                      <div className="text-body-md text-on-surface-variant mt-1">
                        {format(toDate(event.date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>}
        </div>
      ) : view === 'week' ? (
        <section className="surface-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentDate((d) => {
                  const nd = new Date(d);
                  nd.setDate(nd.getDate() - 7);
                  return nd;
                })}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
                aria-label="Semaine précédente"
              >
                <ChevronLeft size={18} className="text-on-surface-variant" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate((d) => {
                  const nd = new Date(d);
                  nd.setDate(nd.getDate() + 7);
                  return nd;
                })}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
                aria-label="Semaine suivante"
              >
                <ChevronRight size={18} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="text-headline-sm text-on-surface">
              {(() => {
                const start = getMonday(currentDate);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                return `${format(start, 'dd MMM', { locale: fr })} - ${format(end, 'dd MMM yyyy', { locale: fr })}`;
              })()}
            </div>
          </div>

          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-7'}`}>
            {[...Array(7)].map((_, i) => {
              const monday = getMonday(currentDate);
              const day = new Date(monday);
              day.setDate(monday.getDate() + i);
              const dayEvents = getEventsForCurrentWeek().filter(
                (event) => format(toDate(event.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
              );

              return (
                <div key={i} className={`rounded-squircle bg-surface-container-low p-3 ${isMobile ? '' : 'min-h-[220px]'}`}>
                  <div className="pb-3 border-b border-outline-variant/70">
                    <div className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                      {format(day, 'EEE', { locale: fr })}
                    </div>
                    <div className="text-headline-sm text-on-surface mt-1">{format(day, 'd')}</div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {dayEvents.length === 0 ? (
                      <div className="text-label-sm text-on-surface-variant opacity-60">Aucun événement</div>
                    ) : (
                      dayEvents.map((event) => (
                        <EventMiniCard
                          key={event.id}
                          event={event}
                          trainerLevelFilter={trainerLevelFilter}
                          onOpen={() => navigate(`${APP_ROUTES.TRAINING_SESSION}/${event.id}`)}
                          onCarpool={() => navigate(`${APP_ROUTES.CARPOOL}?eventId=${event.id}`)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="surface-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentDate((d) => {
                  const nd = new Date(d);
                  nd.setDate(nd.getDate() - 1);
                  return nd;
                })}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
                aria-label="Jour précédent"
              >
                <ChevronLeft size={18} className="text-on-surface-variant" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate((d) => {
                  const nd = new Date(d);
                  nd.setDate(nd.getDate() + 1);
                  return nd;
                })}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
                aria-label="Jour suivant"
              >
                <ChevronRight size={18} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="text-headline-sm text-on-surface">
              {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </div>
          </div>

          <div ref={dayContainerRef} className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {[...Array(24)].map((_, hour) => {
              const base = currentDate;
              const hourEvents = getEventsForToday().filter((event) => {
                const eventDate = toDate(event.date);
                return (
                  format(eventDate, 'yyyy-MM-dd') === format(base, 'yyyy-MM-dd') &&
                  new Date(eventDate).getHours() === hour
                );
              });

              return (
                <div
                  key={hour}
                  id={`hour-${hour}`}
                  className={`grid gap-3 rounded-squircle bg-surface-container-low p-3 ${
                    isMobile ? 'grid-cols-1' : 'grid-cols-[72px_minmax(0,1fr)]'
                  }`}
                >
                  <div className="text-label-lg font-semibold text-on-surface-variant pt-1">{hour.toString().padStart(2, '0')}:00</div>
                  <div className="space-y-2">
                    {hourEvents.length === 0 ? (
                      <div className="text-label-sm text-on-surface-variant opacity-50 py-2">Aucun créneau</div>
                    ) : (
                      hourEvents.map((event) => (
                        <EventAgendaCard
                          key={event.id}
                          event={event}
                          compact
                          trainerLevelFilter={trainerLevelFilter}
                          onOpen={() => navigate(`${APP_ROUTES.TRAINING_SESSION}/${event.id}`)}
                          onCarpool={() => navigate(`${APP_ROUTES.CARPOOL}?eventId=${event.id}`)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {canContribute(user) && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate(APP_ROUTES.CALENDAR_ADD)}
            className="w-14 h-14 btn-primary-gradient rounded-full flex items-center justify-center shadow-ambient-lg"
            aria-label="Ajouter un événement"
          >
            <Plus size={24} className="text-white" />
          </button>
        </div>
      )}

    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-squircle bg-surface-container p-4">
      <div className="flex items-center gap-2 text-primary text-label-lg">{icon}<span>{label}</span></div>
      <div className="text-display-sm text-on-surface mt-2">{value}</div>
    </div>
  );
}

function EventAgendaCard({
  event,
  onOpen,
  onCarpool,
  compact = false,
  trainerLevelFilter = 'all',
}: {
  event: CalendarEvent;
  onOpen: () => void;
  onCarpool: () => void;
  compact?: boolean;
  trainerLevelFilter?: TrainerLevel | 'all';
}) {
  return (
    <div className={`rounded-squircle-sm bg-surface-container p-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body-lg font-semibold text-on-surface">{event.title}</div>
          <div className="flex flex-wrap gap-3 mt-2 text-body-md text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={15} />
              {format(event.date, 'HH:mm', { locale: fr })}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {event.description && !compact && (
        <p className="text-body-md text-on-surface-variant line-clamp-2">{event.description}</p>
      )}

      <FormateurAssignments
        assignments={event.formateurAssignments}
        legacyFormateurs={event.formateurs}
        levelFilter={trainerLevelFilter}
        compact={compact}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-label-lg font-semibold text-white"
        >
          <CalendarDays size={15} />
          Voir la session
        </button>
        <button
          type="button"
          onClick={onCarpool}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary/10 px-3 text-label-lg text-primary"
        >
          <CarFront size={15} />
          Trajets
        </button>
      </div>
    </div>
  );
}

function EventMiniCard({
  event,
  onOpen,
  onCarpool,
  trainerLevelFilter = 'all',
}: {
  event: CalendarEvent;
  onOpen: () => void;
  onCarpool: () => void;
  trainerLevelFilter?: TrainerLevel | 'all';
}) {
  return (
    <div className="rounded-squircle-sm bg-surface-container p-3">
      <div className="text-label-lg font-semibold text-on-surface">{event.title}</div>
      <div className="text-label-sm text-on-surface-variant mt-1">
        {format(event.date, 'HH:mm', { locale: fr })}
      </div>
      <div className="mt-2">
        <FormateurAssignments
          assignments={event.formateurAssignments}
          legacyFormateurs={event.formateurs}
          levelFilter={trainerLevelFilter}
          compact
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={onOpen} className="text-label-sm font-semibold text-primary">
          Session
        </button>
        <button type="button" onClick={onCarpool} className="text-label-sm text-primary">
          Co-voiturage
        </button>
      </div>
    </div>
  );
}

export default CalendarPage;
