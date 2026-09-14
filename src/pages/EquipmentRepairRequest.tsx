import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Mail, RotateCcw, Share2, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createEquipmentRepairRequest,
  getEquipmentRepairRequestPdfBlob,
  getFormEmailDestinations,
  sendEquipmentRepairRequestEmail,
  type EquipmentRepairRequestSubmissionResult,
} from '../services/supabaseService';
import type { EquipmentRepairRequestFormData, EquipmentRepairRequestKind } from '../types';
import {
  createInitialEquipmentRepairRequestForm,
  downloadEquipmentRepairRequestPdf,
  formatEquipmentRepairRequestDate,
  getEquipmentRepairRequestEquipmentOptions,
  getEquipmentRepairRequestEquipmentLabel,
  getEquipmentRepairRequestFilename,
  getEquipmentRepairRequestRoute,
  isEquipmentRepairRequestLocationWithDetails,
  openEquipmentRepairRequestPdf,
  shareEquipmentRepairRequestPdf,
  validateEquipmentRepairRequestForm,
  EQUIPMENT_REPAIR_REQUEST_OPTIONS,
} from '../utils/equipmentRepairRequest';
import { renderEquipmentRepairRequestPdf } from '../utils/equipmentRepairRequestPdf';
import { APP_ROUTES } from '../utils/constants';
import {
  createDefaultFormEmailDestinations,
  formatEmailRecipients,
  type FormEmailDestinations,
} from '../utils/emailDestinations';

const inputClasses =
  'w-full rounded-squircle-sm border border-outline-variant/70 bg-surface-container-lowest px-4 py-3 text-body-lg text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const readOnlyInputClasses =
  'w-full rounded-squircle-sm border border-outline-variant/60 bg-surface-container px-4 py-3 text-body-lg text-on-surface-variant outline-none';
const sectionClasses = 'surface-card space-y-5 p-5 md:p-6';

function SectionTitle({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-lg font-bold text-primary">
        {number}
      </span>
      <div>
        <h2 className="text-headline-md text-on-surface">{title}</h2>
        {description ? <p className="mt-1 text-body-md text-on-surface-variant">{description}</p> : null}
      </div>
    </div>
  );
}

function FieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <span className="mb-1.5 block text-label-lg text-on-surface">
      {children}
      {optional ? <span className="ml-1 font-normal text-on-surface-variant">(facultatif)</span> : null}
    </span>
  );
}

function ChoiceGrid({
  name,
  value,
  options,
  onChange,
  required = false,
  columns = 'sm:grid-cols-2',
}: {
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
  columns?: string;
}) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {options.map((option, index) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high"
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={(event) => onChange(event.target.value)}
            required={required && index === 0}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {option === 'Autre :' ? 'Autre :' : option}
        </label>
      ))}
    </div>
  );
}

export default function EquipmentRepairRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<EquipmentRepairRequestFormData>(() => createInitialEquipmentRepairRequestForm(user));
  const [emailDestinations, setEmailDestinations] = useState<FormEmailDestinations>(createDefaultFormEmailDestinations);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<EquipmentRepairRequestSubmissionResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    getFormEmailDestinations().then((destinations) => {
      if (isMounted) setEmailDestinations(destinations);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      emailDemandeur: user.email.trim(),
      nomDemandeur: current.nomDemandeur.trim() || user.displayName.trim(),
    }));
  }, [user]);

  const updateField = <K extends keyof EquipmentRepairRequestFormData>(
    field: K,
    value: EquipmentRepairRequestFormData[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleKindChange = (kind: string) => {
    if (kind !== 'Matériel' && kind !== 'Habillement') return;
    setForm((current) => ({
      ...current,
      demandeConcerne: kind as EquipmentRepairRequestKind,
      equipement: '',
      equipementAutre: '',
      numeroInventaire: '',
      probleme: '',
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formForSubmission: EquipmentRepairRequestFormData = {
      ...form,
      emailDemandeur: form.emailDemandeur.trim() || user?.email.trim() || '',
      nomDemandeur: form.nomDemandeur.trim() || user?.displayName.trim() || '',
    };
    const validationError = validateEquipmentRepairRequestForm(formForSubmission);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    setSubmitting(true);
    let pdfOpened = false;

    try {
      const document = await renderEquipmentRepairRequestPdf(formForSubmission);
      const filename = getEquipmentRepairRequestFilename(formForSubmission);
      if (previewWindow && !previewWindow.closed) {
        pdfOpened = openEquipmentRepairRequestPdf(document, filename, previewWindow);
      }
      const result = await createEquipmentRepairRequest(formForSubmission, document, filename);
      setSubmission(result);
      if (!pdfOpened) openEquipmentRepairRequestPdf(document, filename);
      showToast(
        result.deliveryStatus === 'sent'
          ? 'La demande a été enregistrée et envoyée par email.'
          : 'La demande a été enregistrée. Le PDF reste disponible pour un partage manuel.',
        result.deliveryStatus === 'sent' ? 'success' : 'info',
      );
    } catch (error) {
      console.error(error);
      previewWindow?.close();
      showToast(
        error instanceof Error ? error.message : 'Impossible de générer et d’enregistrer la demande de réparation.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(createInitialEquipmentRepairRequestForm(user));
    setSubmission(null);
    navigate(getEquipmentRepairRequestRoute(), { replace: true });
  };

  const handleShare = async () => {
    if (!submission) return;

    try {
      const delivery = await sendEquipmentRepairRequestEmail(submission.record.id, true);
      if (delivery.deliveryStatus === 'sent') {
        setSubmission((current) => current
          ? {
            ...current,
            record: {
              ...current.record,
              emailStatus: 'sent',
              emailSentAt: new Date(),
              emailProviderId: delivery.providerId,
              emailError: null,
            },
            deliveryStatus: 'sent',
            deliveryError: null,
          }
          : current);
        showToast('La demande a été envoyée via Brevo.', 'success');
        return;
      }

      setSubmission((current) => current
        ? {
          ...current,
          record: {
            ...current.record,
            emailStatus: 'failed',
            emailSentAt: null,
            emailProviderId: null,
            emailError: delivery.deliveryError,
          },
          deliveryStatus: delivery.deliveryStatus,
          deliveryError: delivery.deliveryError,
        }
        : current);

      const document = await getEquipmentRepairRequestPdfBlob(submission.record);
      const outcome = await shareEquipmentRepairRequestPdf(
        document,
        submission.filename,
        emailDestinations.demandeReparation,
      );
      if (outcome === 'downloaded') {
        showToast('Le PDF a été téléchargé et un message pour les destinataires configurés a été préparé.', 'info');
      } else {
        showToast('Le PDF est prêt dans le partage de votre appareil.', 'info');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      showToast('L’envoi ou le partage de la demande n’a pas abouti.', 'error');
    }
  };

  const equipmentOptions = getEquipmentRepairRequestEquipmentOptions(form.demandeConcerne);
  const recipientLabel = formatEmailRecipients(emailDestinations.demandeReparation);
  const inventoryField = (
    <div>
      <FieldLabel optional>Numéro d’inventaire :</FieldLabel>
      <input
        className={inputClasses}
        value={form.numeroInventaire}
        onChange={(event) => updateField('numeroInventaire', event.target.value)}
        placeholder="Votre réponse"
      />
    </div>
  );
  const nameField = (
    <div>
      <FieldLabel>Nom du demandeur :</FieldLabel>
      <input
        className={inputClasses}
        value={form.nomDemandeur}
        onChange={(event) => updateField('nomDemandeur', event.target.value)}
        placeholder="Votre réponse"
        required
      />
    </div>
  );
  const problemField = (
    <div>
      <FieldLabel>
        {form.demandeConcerne === 'Habillement'
          ? 'Problème rencontré :'
          : 'Description du problème rencontré :'}
      </FieldLabel>
      <textarea
        className={`${inputClasses} min-h-36 resize-y`}
        value={form.probleme}
        onChange={(event) => updateField('probleme', event.target.value)}
        placeholder="Votre réponse"
        required
      />
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.BRULAGE)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          aria-label="Retour au brûlage"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="text-label-sm uppercase tracking-[0.16em] text-primary">Brûlage</span>
      </div>

      <PageIntro
        title="Demande de réparation"
        subtitle="Reprenez les éléments du questionnaire GFO 78 pour signaler une réparation de matériel ou d’habillement."
        eyebrow={(
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary">
            <Wrench size={16} />
            Formulaire équipement
          </span>
        )}
      />

      <div className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
        La demande est enregistrée dans votre espace. Après validation, le PDF est envoyé aux destinataires configurés ({recipientLabel}) lorsque le service d’envoi est disponible.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className={sectionClasses}>
          <SectionTitle number="1" title="Informations générales" description="Les champs reprennent la première étape du questionnaire source." />
          <div>
            <FieldLabel>Lieu de formation</FieldLabel>
            <ChoiceGrid
              name="lieuFormation"
              value={form.lieuFormation}
              options={EQUIPMENT_REPAIR_REQUEST_OPTIONS.lieuxFormation}
              onChange={(value) => updateField('lieuFormation', value as EquipmentRepairRequestFormData['lieuFormation'])}
              required
            />
            {isEquipmentRepairRequestLocationWithDetails(form.lieuFormation) ? (
              <input
                className={`${inputClasses} mt-3`}
                value={form.lieuFormationAutre}
                onChange={(event) => updateField('lieuFormationAutre', event.target.value)}
                placeholder="Précisez le lieu de formation"
                aria-label="Préciser le lieu de formation"
                required
              />
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                className={inputClasses}
                type="date"
                value={form.dateDemande}
                onChange={(event) => updateField('dateDemande', event.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Adresse mail du demandeur (@sdis78.fr)</FieldLabel>
              <input
                className={readOnlyInputClasses}
                type="email"
                value={user?.email?.trim() || form.emailDemandeur}
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="2" title="La demande concerne" />
          <ChoiceGrid
            name="demandeConcerne"
            value={form.demandeConcerne}
            options={EQUIPMENT_REPAIR_REQUEST_OPTIONS.demandes}
            onChange={handleKindChange}
            required
            columns="sm:grid-cols-2"
          />
        </section>

        <section className={sectionClasses}>
          <SectionTitle
            number="3"
            title={form.demandeConcerne || 'Détail de la demande'}
            description={form.demandeConcerne
              ? 'Sélectionnez l’équipement concerné puis décrivez précisément le problème.'
              : 'Sélectionnez une branche pour afficher les éléments correspondants.'}
          />

          {form.demandeConcerne ? (
            <>
              <div>
                <FieldLabel>
                  {form.demandeConcerne === 'Habillement'
                    ? 'Quel est le matériel concerné :'
                    : 'Matériel concerné :'}
                </FieldLabel>
                <ChoiceGrid
                  name="equipement"
                  value={form.equipement}
                  options={equipmentOptions}
                  onChange={(value) => updateField('equipement', value as EquipmentRepairRequestFormData['equipement'])}
                  required
                  columns="sm:grid-cols-2 lg:grid-cols-3"
                />
                {form.equipement === 'Autre :' ? (
                  <input
                    className={`${inputClasses} mt-3`}
                    value={form.equipementAutre}
                    onChange={(event) => updateField('equipementAutre', event.target.value)}
                    placeholder="Précisez le matériel concerné"
                    aria-label="Préciser le matériel concerné"
                    required
                  />
                ) : null}
              </div>

              {form.demandeConcerne === 'Matériel'
                ? <>{problemField}{inventoryField}{nameField}</>
                : <>{inventoryField}{problemField}{nameField}</>}
            </>
          ) : (
            <p className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
              Choisissez « Matériel » ou « Habillement » pour afficher les choix du questionnaire.
            </p>
          )}
        </section>

        <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <p className="text-body-md font-semibold text-on-surface">Vérifiez les réponses avant validation.</p>
            <p className="mt-1 text-body-md text-on-surface-variant">Le PDF reprend les éléments renseignés et reste disponible dans votre historique.</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !user}
            className="btn-primary-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-squircle-sm px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={19} />
            {submitting ? 'Enregistrement...' : 'Valider la demande'}
          </button>
        </div>
      </form>

      {submission ? (
        <section className="surface-card space-y-4 border border-emerald-500/25 p-5 md:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={23} />
            <div>
              <h2 className="text-headline-md text-on-surface">Demande enregistrée</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                La demande {submission.record.demandeConcerne.toLowerCase()} du {formatEquipmentRepairRequestDate(submission.record.dateDemande)} pour {getEquipmentRepairRequestEquipmentLabel(submission.record)} est conservée dans votre espace. Le PDF a été ouvert dans un nouvel onglet.
              </p>
            </div>
          </div>
          <p className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
            {submission.deliveryStatus === 'sent'
              ? `Un email a été envoyé via Brevo à ${recipientLabel}.`
              : `L’envoi automatique vers ${recipientLabel} n’a pas pu être confirmé. Le partage manuel reste disponible.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => openEquipmentRepairRequestPdf(submission.document, submission.filename)}
              className="btn-primary-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold"
            >
              <FileText size={18} />
              Ouvrir le PDF
            </button>
            <button
              type="button"
              onClick={() => downloadEquipmentRepairRequestPdf(submission.document, submission.filename)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm bg-surface-container-high px-4 py-2.5 text-body-md font-semibold text-on-surface transition hover:bg-surface-container-highest"
            >
              <Download size={18} />
              Télécharger le PDF
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-4 py-2.5 text-body-md font-semibold text-primary transition hover:bg-primary/5"
            >
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? <Share2 size={18} /> : <Mail size={18} />}
              Envoyer par email
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold text-on-surface-variant transition hover:bg-surface-container"
            >
              <RotateCcw size={17} />
              Nouvelle demande
            </button>
          </div>
        </section>
      ) : null}

    </div>
  );
}
