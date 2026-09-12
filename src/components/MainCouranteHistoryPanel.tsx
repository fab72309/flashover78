import { useEffect, useState } from 'react';
import { ClipboardList, Clock3, Download, FileText, Mail, Share2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { getMainCourantePdfBlob, listMyMainCourantes } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';
import type { MainCouranteRecord } from '../types';
import {
  downloadMainCourantePdf,
  formatMainCouranteDate,
  MAIN_COURANTE_ADMIN_EMAIL,
  openMainCourantePdf,
  shareMainCourantePdf,
} from '../utils/mainCourante';

type PdfAction = 'open' | 'download' | 'share';

export default function MainCouranteHistoryPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<MainCouranteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    listMyMainCourantes(userId)
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

  const handlePdfAction = async (record: MainCouranteRecord, action: PdfAction) => {
    const actionKey = `${record.id}:${action}`;
    const previewWindow = action === 'open' && typeof window !== 'undefined'
      ? window.open('', '_blank')
      : null;
    setActiveAction(actionKey);

    try {
      const document = await getMainCourantePdfBlob(record);
      if (action === 'open') {
        if (previewWindow && !previewWindow.closed) {
          openMainCourantePdf(document, record.pdfFilename, previewWindow);
        } else {
          openMainCourantePdf(document, record.pdfFilename);
        }
      } else if (action === 'download') {
        downloadMainCourantePdf(document, record.pdfFilename);
      } else {
        const outcome = await shareMainCourantePdf(document, record.pdfFilename);
        if (outcome === 'downloaded') {
          showToast(`Le PDF a été téléchargé et un message pour ${MAIN_COURANTE_ADMIN_EMAIL} a été préparé.`, 'info');
        } else {
          showToast('Le PDF est prêt dans le partage de votre appareil.', 'info');
        }
      }
    } catch (actionError) {
      if (actionError instanceof DOMException && actionError.name === 'AbortError') return;
      previewWindow?.close();
      console.error(actionError);
      showToast('Impossible d’ouvrir ou de partager le PDF de cette main courante.', 'error');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className="mt-7 border-t border-outline-variant pt-6">
      <div>
        <p className="text-label-sm uppercase text-primary">Brûlage</p>
        <h2 className="mt-1 text-headline-lg text-on-surface">Mes mains courantes</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Retrouvez les mains courantes enregistrées depuis l’application.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-body-md text-red-800">
          Le résumé des mains courantes n’est pas disponible.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-outline p-6 text-center">
          <ClipboardList className="mx-auto text-on-surface-variant" size={24} />
          <p className="mt-2 text-body-md text-on-surface-variant">
            Aucune main courante enregistrée.
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
                <ClipboardList size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-on-surface">
                  Main courante · {item.siteFormation}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  Le {formatMainCouranteDate(item.dateMainCourante)}
                  {item.typeSession ? ` · ${item.typeSession}` : ''}
                  {item.formation ? ` · ${item.formation}` : ''}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  {item.formateurs.filter(Boolean).join(', ') || 'Aucun formateur sélectionné'}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-label-sm font-semibold text-primary">
                  <Clock3 size={14} />
                  Enregistrée le {item.createdAt.toLocaleDateString('fr-FR')} à {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'open')}
                    disabled={activeAction !== null}
                    className="btn-primary-gradient inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm px-3 py-2 text-label-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Ouvrir le PDF de la main courante du ${formatMainCouranteDate(item.dateMainCourante)}`}
                  >
                    <FileText size={16} />
                    {activeAction === `${item.id}:open` ? 'Ouverture...' : 'Ouvrir le PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'download')}
                    disabled={activeAction !== null}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm bg-surface-container-high px-3 py-2 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Télécharger le PDF de la main courante du ${formatMainCouranteDate(item.dateMainCourante)}`}
                  >
                    <Download size={16} />
                    {activeAction === `${item.id}:download` ? 'Téléchargement...' : 'Télécharger'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfAction(item, 'share')}
                    disabled={activeAction !== null}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-3 py-2 text-label-lg font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Envoyer le PDF de la main courante du ${formatMainCouranteDate(item.dateMainCourante)} à ${MAIN_COURANTE_ADMIN_EMAIL}`}
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
