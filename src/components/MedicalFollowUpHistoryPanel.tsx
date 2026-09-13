import { useEffect, useState } from 'react';
import { ChevronRight, Clock3, Download, Edit3, FileText, HeartPulse, Mail, Share2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import {
  downloadMedicalFollowUp,
  getMedicalFollowUpFilename,
  getMedicalFollowUpEditRemainingMs,
  getMedicalFollowUpRoute,
  canEditMedicalFollowUp,
  isMedicalFollowUpEvolution,
  openMedicalFollowUpPdf,
  shareMedicalFollowUp,
} from '../utils/medicalFollowUp';
import { getFormEmailDestinations, listMyMedicalFollowUps } from '../services/supabaseService';
import type { MedicalFollowUpRecord } from '../types';
import { renderMedicalFollowUpPdf } from '../utils/medicalFollowUpPdf';
import {
  createDefaultFormEmailDestinations,
  formatEmailRecipients,
  mergeEmailRecipients,
} from '../utils/emailDestinations';

type PdfAction = 'open' | 'download' | 'share';

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
  const { showToast } = useToast();
  const [items, setItems] = useState<MedicalFollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [emailDestinations, setEmailDestinations] = useState(createDefaultFormEmailDestinations);

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

  useEffect(() => {
    let isMounted = true;
    getFormEmailDestinations().then((destinations) => {
      if (isMounted) setEmailDestinations(destinations);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePdfAction = async (record: MedicalFollowUpRecord, action: PdfAction) => {
    const actionKey = `${record.id}:${action}`;
    const previewWindow = action === 'open' && typeof window !== 'undefined'
      ? window.open('', '_blank')
      : null;
    const isEvolution = isMedicalFollowUpEvolution(record);
    const filename = getMedicalFollowUpFilename(record, isEvolution);
    setActiveAction(actionKey);

    try {
      const document = await renderMedicalFollowUpPdf(record, { isEvolution });
      if (action === 'open') {
        if (previewWindow && !previewWindow.closed) {
          openMedicalFollowUpPdf(document, filename, previewWindow);
        } else {
          openMedicalFollowUpPdf(document, filename);
        }
      } else if (action === 'download') {
        downloadMedicalFollowUp(document, filename);
      } else {
        const recipientEmails = mergeEmailRecipients(
          [record.emailFormateur],
          emailDestinations.suiviMedical,
        );
        const outcome = await shareMedicalFollowUp(
          document,
          filename,
          record.emailFormateur,
          emailDestinations.suiviMedical,
        );
        if (outcome === 'downloaded') {
          showToast(`Le PDF a été téléchargé et un message pour ${formatEmailRecipients(recipientEmails)} a été préparé.`, 'info');
        } else {
          showToast('Le PDF est prêt dans le partage de votre appareil.', 'info');
        }
      }
    } catch (actionError) {
      if (actionError instanceof DOMException && actionError.name === 'AbortError') return;
      previewWindow?.close();
      console.error(actionError);
      showToast('Impossible d’ouvrir ou de partager le PDF de ce suivi médical.', 'error');
    } finally {
      setActiveAction(null);
    }
  };

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
            const wasUpdated = isMedicalFollowUpEvolution(item);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-start"
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
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePdfAction(item, 'open')}
                      disabled={activeAction !== null}
                      className="btn-primary-gradient inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm px-3 py-2 text-label-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Ouvrir le PDF du suivi médical du ${format(parseISO(item.dateFormation), 'd MMMM yyyy', { locale: fr })}`}
                    >
                      <FileText size={16} />
                      {activeAction === `${item.id}:open` ? 'Ouverture...' : 'Ouvrir le PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePdfAction(item, 'download')}
                      disabled={activeAction !== null}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm bg-surface-container-high px-3 py-2 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Télécharger le PDF du suivi médical du ${format(parseISO(item.dateFormation), 'd MMMM yyyy', { locale: fr })}`}
                    >
                      <Download size={16} />
                      {activeAction === `${item.id}:download` ? 'Téléchargement...' : 'Télécharger'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePdfAction(item, 'share')}
                      disabled={activeAction !== null}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-3 py-2 text-label-lg font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Envoyer le PDF du suivi médical du ${format(parseISO(item.dateFormation), 'd MMMM yyyy', { locale: fr })}`}
                    >
                      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? <Share2 size={16} /> : <Mail size={16} />}
                      {activeAction === `${item.id}:share` ? 'Préparation...' : 'Envoyer par email'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!editable || activeAction !== null}
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
