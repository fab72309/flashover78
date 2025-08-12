import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { ChevronLeft, ChevronRight, Search, Plus } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { CalendarEvent } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-calendar/dist/Calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { documents: events, loading } = useCollection<CalendarEvent>('events');
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [search, setSearch] = useState('');

  // Date de référence pour les vues semaine/jour
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const dayContainerRef = useRef<HTMLDivElement | null>(null);

  // Helper robuste pour convertir Firestore Timestamp | string | number | Date en Date
  const toDate = (input: unknown): Date => {
    if (input instanceof Date) return input;
    // Firestore Timestamp
    if (input && typeof input === 'object' && 'toDate' in (input as any) && typeof (input as any).toDate === 'function') {
      return (input as any).toDate();
    }
    // ISO string ou millis
    return new Date(input as any);
  };

  // Lundi de la semaine pour une date donnée
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    // getDay(): 0=Dimanche, 1=Lundi, ..., 6=Samedi
    const diff = (day === 0 ? -6 : 1) - day; // ajuste pour obtenir lundi
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Filtrage des événements selon la recherche
  const filteredEvents = events.filter(event => {
    const query = search.toLowerCase();
    return (
      event.title.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query)) ||
      (event.location && event.location.toLowerCase().includes(query))
    );
  });

  // Récupère les événements de la semaine courante
  const getEventsForCurrentWeek = () => {
    const startOfWeek = getMonday(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return filteredEvents.filter(event => {
      const eventDate = toDate(event.date);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });
  };

  // Récupère les événements du jour courant
  const getEventsForToday = () => {
    const base = view === 'day' ? currentDate : today;
    return filteredEvents.filter(event => {
      const eventDate = toDate(event.date);
      return format(eventDate, 'yyyy-MM-dd') === format(base, 'yyyy-MM-dd');
    });
  };

  // Pour la vue Mois, marqueurs filtrés
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => format(toDate(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
  };

  const handleDateClick = (value: Value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setCurrentDate(value);
      setView('day');
    }
  };

  useEffect(() => {
    if (view !== 'day') return;
    const hour = (view === 'day' ? new Date(currentDate) : new Date()).getHours();
    const el = document.getElementById(`hour-${hour}`);
    if (el && dayContainerRef.current) {
      // petite temporisation pour laisser le rendu compléter
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
    }
  }, [view, currentDate]);

  return (
    <div className="min-h-screen space-y-3 relative pb-20 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm p-2 -mx-4 px-4">
        <div className="flex justify-center space-x-2 mb-2">
          <button 
            type="button"
            aria-pressed={view === 'day'}
            onClick={() => { setView('day'); setCurrentDate(today); }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              view === 'day' ? 'bg-[#FF4500] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Jour
          </button>
          <button 
            type="button"
            aria-pressed={view === 'week'}
            onClick={() => { setView('week'); setCurrentDate(today); }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              view === 'week' ? 'bg-[#FF4500] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semaine
          </button>
          <button 
            type="button"
            aria-pressed={view === 'month'}
            onClick={() => { setView('month'); setCurrentDate(today); }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              view === 'month' ? 'bg-[#FF4500] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mois
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un événement"
            className="w-full p-2 pl-9 bg-gray-50 rounded-lg text-sm mb-3"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-2 shadow-sm">
          <div key={view}>
            {view === 'month' ? (
              <Calendar
                onClickDay={handleDateClick}
                value={today}
                prevLabel={<ChevronLeft className="text-[#FF4500]" size={18} />}
                nextLabel={<ChevronRight className="text-[#FF4500]" size={18} />}
                className="w-full border-none"
                tileClassName={({ date }) => {
                  const hasEvents = getEventsForDate(date).length > 0;
                  const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  return `rounded-lg relative ${
                    isSelected ? 'bg-[#FF4500] text-white' : 
                    isToday ? 'text-[#FF4500] font-bold' :
                    hasEvents ? 'hover:bg-orange-100' : 
                    'hover:bg-gray-100'
                  }`;
                }}
                tileContent={({ date }) => {
                  const eventsForDate = getEventsForDate(date);
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  if (eventsForDate.length > 0) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-8 h-8 border-2 ${isToday ? 'bg-[#FF4500] border-[#FF4500]' : 'border-[#FF4500]'} rounded-full`}></div>
                      </div>
                    );
                  } else if (isToday) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-[#FF4500] rounded-full"></div>
                      </div>
                    );
                  }
                  return null;
                }}
                navigationLabel={({ date }) => format(date, 'MMMM yyyy', { locale: fr })}
              />
            ) : view === 'week' ? (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; })}
                      className="p-1 rounded hover:bg-gray-100"
                      aria-label="Semaine précédente"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; })}
                      className="p-1 rounded hover:bg-gray-100"
                      aria-label="Semaine suivante"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentDate(new Date())}
                      className="ml-2 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Aujourd'hui
                    </button>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {(() => {
                      const start = getMonday(currentDate);
                      const end = new Date(start);
                      end.setDate(start.getDate() + 6);
                      return `${format(start, 'dd MMM', { locale: fr })} – ${format(end, 'dd MMM yyyy', { locale: fr })}`;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 bg-gray-50 rounded-lg overflow-hidden">
                  {[...Array(7)].map((_, i) => {
                    const monday = getMonday(currentDate);
                    const day = new Date(monday);
                    day.setDate(monday.getDate() + i);
                    return (
                      <div key={i} className="p-2 text-center font-semibold bg-white border-b border-gray-200">
                        {format(day, 'EEE dd/MM', { locale: fr })}
                      </div>
                    );
                  })}
                  {[...Array(7)].map((_, i) => {
                    const monday = getMonday(currentDate);
                    const day = new Date(monday);
                    day.setDate(monday.getDate() + i);
                    const events = getEventsForCurrentWeek().filter(event => {
                      const eventDate = toDate(event.date);
                      return format(eventDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                    });
                    return (
                      <div key={i} className="min-h-[100px] bg-white border-r border-gray-200 p-2">
                        {events.length > 0 ? (
                          events.map(event => (
                            <div key={event.id} className="mb-2 p-2 rounded bg-[#FF4500]/10">
                              <div className="font-medium text-[#FF4500]">{event.title}</div>
                              <div className="text-xs text-gray-500">{format(toDate(event.date), 'HH:mm', { locale: fr })} - {event.location}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400 text-center">Aucun événement</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd; })}
                      className="p-1 rounded hover:bg-gray-100"
                      aria-label="Jour précédent"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; })}
                      className="p-1 rounded hover:bg-gray-100"
                      aria-label="Jour suivant"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentDate(new Date())}
                      className="ml-2 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Aujourd'hui
                    </button>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
                  </div>
                </div>
                <div ref={dayContainerRef} className="grid grid-cols-1 divide-y divide-gray-200 bg-gray-50 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                  {[...Array(24)].map((_, hour) => {
                    const base = currentDate;
                    const events = getEventsForToday().filter(event => {
                      const eventDate = toDate(event.date);
                      return format(eventDate, 'yyyy-MM-dd') === format(base, 'yyyy-MM-dd') && new Date(eventDate).getHours() === hour;
                    });
                    return (
                      <div id={`hour-${hour}`} key={hour} className="flex flex-col p-2 min-h-[40px]">
                        <div className="text-xs font-semibold text-gray-500 mb-1">{hour.toString().padStart(2, '0')}:00</div>
                        {events.length > 0 ? (
                          events.map(event => (
                            <div key={event.id} className="mb-1 p-2 rounded bg-[#FF4500]/10">
                              <div className="font-medium text-[#FF4500]">{event.title}</div>
                              <div className="text-xs text-gray-500">{event.location}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button 
        onClick={() => navigate('/calendar/add')}
        className="fixed right-4 bottom-20 w-14 h-14 bg-[#FF4500] rounded-full flex items-center justify-center shadow-lg hover:bg-[#FF4500]/90 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF4500]"
        aria-label="Ajouter un événement"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}

export default CalendarPage;