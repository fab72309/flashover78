import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { ChevronLeft, ChevronRight, Search, Plus, X } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { CalendarEvent } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-calendar/dist/Calendar.css';
import { Clock, MapPin, Users } from 'lucide-react';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { documents: events, loading } = useCollection<CalendarEvent>('events');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getNextEvent = () => {
    if (!events.length) return null;
    const now = new Date();
    return events
      .filter(event => event.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  };

  const nextEvent = getNextEvent();

  const getEventsForDate = (date: Date) => {
    const eventsForDate = events.filter(
      event => format(event.date instanceof Date ? event.date : new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    return eventsForDate;
  };

  const tileContent = ({ date }: { date: Date }) => {
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
  };

  const handleDateClick = (value: Value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
    }
  };

  return (
    <div className="min-h-screen space-y-3 relative pb-20 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm p-2 -mx-4 px-4">
        <div className="flex justify-center space-x-2 mb-2">
          <button 
            onClick={() => setView('day')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              view === 'day' ? 'bg-[#FF4500] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Jour
          </button>
          <button 
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              view === 'week' ? 'bg-[#FF4500] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semaine
          </button>
          <button 
            onClick={() => setView('month')}
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
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-2 shadow-sm">
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
            tileContent={tileContent}
            navigationLabel={({ date }) => 
              format(date, 'MMMM yyyy', { locale: fr })
            }
          />
        </div>
      )}
      
      {nextEvent && (
        <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-[#FF4500]">
          <h2 className="text-sm font-semibold mb-1.5 underline">Prochaine formation :</h2>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#FF4500]">{nextEvent.title}</h3>
            <p className="text-xs text-gray-600">{nextEvent.description}</p>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Clock size={14} />
              <span>{format(nextEvent.date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
            </div>
            {nextEvent.location && (
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <MapPin size={14} />
                <span>{nextEvent.location}</span>
              </div>
            )}
            {nextEvent.formateurs && nextEvent.formateurs.length > 0 && (
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Users size={14} />
                <span>{nextEvent.formateurs.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return to Home Button */}
      <button
        onClick={() => navigate('/')}
        className="w-full bg-white text-[#FF4500] py-4 rounded-lg mt-6 mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>

      {/* Event Details Popup */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
             <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
               <h2 className="text-lg font-semibold">
                 {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
               </h2>
               <button
                 onClick={() => setSelectedDate(null)}
                 className="p-2 hover:bg-gray-100 rounded-full"
                 aria-label="Fermer"
               >
                 <X size={20} className="text-gray-500" />
               </button>
             </div>
             <div className="p-4 space-y-4">
               {getEventsForDate(selectedDate).map(event => (
                 <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                   <h3 className="font-semibold text-lg">{event.title}</h3>
                   <p className="text-gray-600 mt-2">{event.description}</p>
                   <div className="flex items-center justify-between mt-2 text-gray-500">
                     <div className="flex items-center gap-2">
                       <Clock size={16} />
                       <span>{format(event.date instanceof Date ? event.date : new Date(event.date), "HH:mm", { locale: fr })}</span>
                     </div>
                     {event.location && (
                       <div className="flex items-center gap-2">
                         <MapPin size={16} />
                         <span>{event.location}</span>
                       </div>
                     )}
                   </div>
                   {event.observations && (
                     <p className="text-gray-600 mt-2">
                       <span className="font-medium">Observations:</span> {event.observations}
                     </p>
                   )}
                   {event.formateurs && event.formateurs.length > 0 && (
                     <div className="mt-2">
                       <span className="font-medium">Formateurs:</span>
                       <ul className="list-disc list-inside">
                         {event.formateurs.map((formateur, index) => (
                           <li key={index} className="text-gray-600 ml-2">{formateur}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
               ))}
               {getEventsForDate(selectedDate).length === 0 && (
                 <p className="text-center text-gray-500">Aucun événement pour cette date</p>
               )}
             </div>
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