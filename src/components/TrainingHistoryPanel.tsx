import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronRight, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from './LoadingSpinner';
import { listMyTrainingHistory } from '../services/supabaseService';
import type { TrainingHistoryItem } from '../types';
import { APP_ROUTES } from '../utils/constants';

export default function TrainingHistoryPanel({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<TrainingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    listMyTrainingHistory(userId)
      .then((history) => {
        if (isMounted) {
          setItems(history);
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (isMounted) {
          setError(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <section className="mt-7 border-t border-outline-variant pt-6">
      <div>
        <p className="text-label-sm uppercase text-primary">Suivi individuel</p>
        <h2 className="mt-1 text-headline-lg text-on-surface">Mes formations</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Vos inscriptions et présences enregistrées.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-body-md text-red-800">
          L’historique des formations n’est pas disponible.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-outline p-6 text-center">
          <CalendarCheck className="mx-auto text-on-surface-variant" size={24} />
          <p className="mt-2 text-body-md text-on-surface-variant">
            Aucune inscription enregistrée.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                navigate(`${APP_ROUTES.TRAINING_SESSION}/${item.eventId}`)
              }
              className="flex w-full items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left hover:bg-surface-container"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarCheck size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-on-surface">
                  {item.event.title}
                </span>
                <span className="mt-1 block text-body-md text-on-surface-variant">
                  {format(item.event.date, "d MMMM yyyy 'à' HH:mm", {
                    locale: fr,
                  })}
                </span>
                <span className="mt-2 inline-flex items-center gap-1.5 text-label-sm font-semibold text-primary">
                  <Clock3 size={14} />
                  {getHistoryStatus(item)}
                </span>
              </span>
              <ChevronRight size={19} className="shrink-0 text-on-surface-variant" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function getHistoryStatus(item: TrainingHistoryItem) {
  if (item.status === 'waitlisted') {
    return 'Liste d’attente';
  }
  if (item.attendance === 'present') {
    return 'Présence validée';
  }
  if (item.attendance === 'absent') {
    return 'Absence enregistrée';
  }
  return 'Inscription confirmée';
}
