import { useEffect, useState } from 'react';
import { ChevronRight, Clock3, Edit3, HeartPulse } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import {
  getMedicalFollowUpEditRemainingMs,
  getMedicalFollowUpRoute,
  canEditMedicalFollowUp,
} from '../utils/medicalFollowUp';
import { listMyMedicalFollowUps } from '../services/supabaseService';
import type { MedicalFollowUpRecord } from '../types';

function getRemainingLabel(record: MedicalFollowUpRecord) {
  const hours = Math.ceil(getMedicalFollowUpEditRemainingMs(record) / (60 * 60 * 1000));
  if (hours <= 0) return 'Modification expirée';
  return `Modifiable encore ${hours} h`;
}

function getEmailLabel(record: MedicalFollowUpRecord) {
  if (record.emailStatus === 'sent') return 'Email envoyé';
  if (record.emailStatus === 'failed') return 'Email à vérifier';
  return 'Email en attente';
}

export default function MedicalFollowUpHistoryPanel({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<MedicalFollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    listMyMedicalFollowUps(userId)
      .then((records) => {
        if (isMounted) setItems(records);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <section className="mt-7 border-t border-outline-variant pt-6">
      <div>
        <p className="text-label-sm uppercase text-primary">Suivi individuel</p>
        <h2 className="mt-1 text-headline-lg text-on-surface">Mes suivis médicaux</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Retrouvez le résumé de vos brûlages et modifiez une fiche pendant 72 heures.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-body-md text-red-800">
          Le résumé des suivis médicaux n’est pas disponible.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-outline p-6 text-center">
          <HeartPulse className="mx-auto text-on-surface-variant" size={24} />
          <p className="mt-2 text-body-md text-on-surface-variant">
            Aucun suivi médical enregistré.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const editable = canEditMedicalFollowUp(item);
            const wasUpdated = item.updatedAt.getTime() - item.createdAt.getTime() > 1000;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HeartPulse size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-on-surface">
                    {wasUpdated ? 'Evolution Suivi médical' : 'Suivi médical'} · {item.trainerLevel}
                  </p>
                  <p className="mt-1 text-body-md text-on-surface-variant">
                    Brûlage du {format(parseISO(item.dateFormation), 'd MMMM yyyy', { locale: fr })}
                    {' · '}
                    {item.lieuFormation === 'Autre :' || item.lieuFormation === 'Friche batimentaire'
                      ? `${item.lieuFormation} ${item.lieuFormationAutre}`
                      : item.lieuFormation}
                  </p>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm font-semibold text-primary">
                    <span>Enregistré le {format(item.createdAt, "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={14} />
                      {getRemainingLabel(item)}
                    </span>
                    <span>{getEmailLabel(item)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => navigate(`${getMedicalFollowUpRoute(item.trainerLevel)}?edit=${encodeURIComponent(item.id)}`)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-4 py-2.5 text-body-md font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-outline-variant disabled:text-on-surface-variant"
                >
                  <Edit3 size={17} />
                  {editable ? 'Modifier' : 'Délai dépassé'}
                  {editable ? <ChevronRight size={17} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
