import { useEffect, useState } from 'react';
import { Clock3, Download, FileText, Mail, Share2, Wrench } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import {
  getEquipmentRepairRequestPdfBlob,
  getFormEmailDestinations,
  listMyEquipmentRepairRequests,
  sendEquipmentRepairRequestEmail,
} from '../services/supabaseService';
import type { EquipmentRepairRequestRecord } from '../types';
import {
  downloadEquipmentRepairRequestPdf,
  formatEquipmentRepairRequestDate,
  getEquipmentRepairRequestEmailLabel,
  getEquipmentRepairRequestEquipmentLabel,
  getEquipmentRepairRequestLocationLabel,
  openEquipmentRepairRequestPdf,
  shareEquipmentRepairRequestPdf,
} from '../utils/equipmentRepairRequest';
import {
  createDefaultFormEmailDestinations,
  formatEmailRecipients,
} from '../utils/emailDestinations';
import { logClientFailure } from '../utils/clientDiagnostics';

type PdfAction = 'open' | 'download' | 'share';

export default function EquipmentRepairHistoryPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<EquipmentRepairRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [emailDestinations, setEmailDestinations] = useState(createDefaultFormEmailDestinations);
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    listMyEquipmentRepairRequests(userId)
      .then((records) => {
        if (isMounted) setItems(records);
      })
      .catch(() => {
        logClientFailure('Chargement de l’historique des réparations impossible');
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

  const handlePdfAction = async (record: EquipmentRepairRequestRecord, action: PdfAction) => {
    const actionKey = `${record.id}:${action}`;
    const previewWindow = action === 'open' && typeof window !== 'undefined'
      ? window.open('', '_blank', 'noopener,noreferrer')
      : null;
    setActiveAction(actionKey);

    try {
      if (action === 'share') {
        const delivery = await sendEquipmentRepairRequestEmail(record.id, true);
        if (delivery.deliveryStatus === 'sent') {
          setItems((currentItems) => currentItems.map((item) => item.id === record.id
            ? {
              ...item,
              emailStatus: 'sent',
              emailSentAt: new Date(),
              emailProviderId: delivery.providerId,
              emailError: null,
            }
            : item));
          showToast('La demande a été envoyée via Brevo.', 'success');
          return;
        }

        setItems((currentItems) => currentItems.map((item) => item.id === record.id
          ? {
            ...item,
            emailStatus: 'failed',
            emailSentAt: null,
            emailProviderId: null,
            emailError: delivery.deliveryError,
          }
          : item));

        const document = await getEquipmentRepairRequestPdfBlob(record);
        const outcome = await shareEquipmentRepairRequestPdf(
          document,
          record.pdfFilename,
          emailDestinations.demandeReparation,
        );
        if (outcome === 'downloaded') {
          showToast(`L’envoi automatique n’a pas pu être confirmé. Le PDF a été téléchargé et un message pour ${formatEmailRecipients(emailDestinations.demandeReparation)} a été préparé.`, 'info');
        } else {
          showToast('L’envoi automatique n’a pas pu être confirmé. Le PDF est prêt dans le partage de votre appareil.', 'info');
        }
        return;
      }

      const document = await getEquipmentRepairRequestPdfBlob(record);
      if (action === 'open') {
        if (previewWindow && !previewWindow.closed) {
          openEquipmentRepairRequestPdf(document, record.pdfFilename, previewWindow);
        } else {
          openEquipmentRepairRequestPdf(document, record.pdfFilename);
        }
      } else {
        downloadEquipmentRepairRequestPdf(document, record.pdfFilename);
      }
    } catch (actionError) {
      if (actionError instanceof DOMException && actionError.name === 'AbortError') return;
      previewWindow?.close();
      logClientFailure('Ouverture du PDF de réparation impossible');
      showToast('Impossible d’ouvrir ou de partager le PDF de cette demande.', 'error');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className="mt-7 border-t border-outline-variant pt-6">
      <div>
        <p className="text-label-sm uppercase text-primary">Brûlage</p>
        <h2 className="mt-1 text-headline-lg text-on-surface">Mes demandes de réparation</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Retrouvez les demandes et les PDF enregistrés depuis l’application.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-body-md text-red-800">
          L’historique des demandes de réparation n’est pas disponible.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-outline p-6 text-center">
          <Wrench className="mx-auto text-on-surface-variant" size={24} />
          <p className="mt-2 text-body-md text-on-surface-variant">
            Aucune demande de réparation enregistrée.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-start"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wrench size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-on-surface">
                  Demande de réparation · {item.demandeConcerne}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  {item.dateDemande ? `Le ${formatEquipmentRepairRequestDate(item.dateDemande)}` : 'Date non renseignée'}
                  {item.lieuFormation ? ` · ${getEquipmentRepairRequestLocationLabel(item)}` : ''}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  {getEquipmentRepairRequestEquipmentLabel(item)}
                  {item.numeroInventaire.trim() ? ` · Inventaire : ${item.numeroInventaire.trim()}` : ''}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  Demandeur : {item.nomDemandeur}
                </p>
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm font-semibold text-primary">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={14} />
                    Enregistrée le {item.createdAt.toLocaleDateString('fr-FR')} à {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{getEquipmentRepairRequestEmailLabel(item)}</span>
                </span>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'open')}
                    disabled={activeAction !== null}
                    className="btn-primary-gradient inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm px-3 py-2 text-label-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Ouvrir le PDF de la demande du ${item.nomDemandeur}`}
                  >
                    <FileText size={16} />
                    {activeAction === `${item.id}:open` ? 'Ouverture...' : 'Ouvrir le PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'download')}
                    disabled={activeAction !== null}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm bg-surface-container-high px-3 py-2 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Télécharger le PDF de la demande du ${item.nomDemandeur}`}
                  >
                    <Download size={16} />
                    {activeAction === `${item.id}:download` ? 'Téléchargement...' : 'Télécharger'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'share')}
                    disabled={activeAction !== null}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-3 py-2 text-label-lg font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Envoyer le PDF de la demande du ${item.nomDemandeur} aux destinataires configurés`}
                  >
                    {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? <Share2 size={16} /> : <Mail size={16} />}
                    {activeAction === `${item.id}:share` ? 'Préparation...' : 'Envoyer par email'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
