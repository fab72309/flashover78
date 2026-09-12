import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, HeartPulse, Mail, RotateCcw, Share2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createMedicalFollowUp,
  getMyMedicalFollowUp,
  updateMedicalFollowUp,
  type MedicalFollowUpSubmissionResult,
} from '../services/supabaseService';
import type { MedicalFollowUpFormData, MedicalFollowUpRecord, TrainerLevel } from '../types';
import {
  canEditMedicalFollowUp,
  createInitialMedicalFollowUpForm,
  canAccessMedicalFollowUp,
  downloadMedicalFollowUp,
  getMedicalFollowUpFilename,
  getMedicalFollowUpFunctionOptions,
  getMedicalFollowUpRoute,
  isMedicalFollowUpLocationWithDetails,
  isMedicalFollowUpTrainerLevel,
  MEDICAL_FOLLOWUP_ADMIN_EMAIL,
  MEDICAL_FOLLOWUP_OPTIONS,
  openMedicalFollowUpPdf,
  shareMedicalFollowUp,
  validateMedicalFollowUpForm,
} from '../utils/medicalFollowUp';
import { renderMedicalFollowUpPdf } from '../utils/medicalFollowUpPdf';
import { APP_ROUTES } from '../utils/constants';

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

export default function MedicalFollowUp() {
  const navigate = useNavigate();
  const { trainerLevel: trainerLevelParam } = useParams<{ trainerLevel?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const functionOptions = getMedicalFollowUpFunctionOptions(user);
  const requestedTrainerLevel = isMedicalFollowUpTrainerLevel(trainerLevelParam)
    ? trainerLevelParam
    : null;
  const selectedTrainerLevel: TrainerLevel | null = requestedTrainerLevel
    ?? (functionOptions.length === 1 ? functionOptions[0].level : null);
  const editId = searchParams.get('edit');
  const [form, setForm] = useState<MedicalFollowUpFormData>(() => createInitialMedicalFollowUpForm(user, selectedTrainerLevel ?? undefined));
  const [editingRecord, setEditingRecord] = useState<MedicalFollowUpRecord | null>(null);
  const [editLoading, setEditLoading] = useState(Boolean(editId));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MedicalFollowUpSubmissionResult | null>(null);

  useEffect(() => {
    if (!editId || !user || !selectedTrainerLevel) {
      setEditLoading(false);
      return;
    }

    let isMounted = true;
    setEditLoading(true);
    getMyMedicalFollowUp(editId, user.id)
      .then((record) => {
        if (!isMounted) return;
        if (!record || record.trainerLevel !== selectedTrainerLevel) {
          showToast('Ce suivi médical est introuvable pour cette fonction.', 'error');
          navigate(getMedicalFollowUpRoute(selectedTrainerLevel), { replace: true });
          return;
        }
        setEditingRecord(record);
        setForm(record);
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) showToast('Impossible de charger ce suivi médical.', 'error');
      })
      .finally(() => {
        if (isMounted) setEditLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [editId, navigate, selectedTrainerLevel, showToast, user]);

  useEffect(() => {
    if (selectedTrainerLevel && !editId && user) {
      setForm(createInitialMedicalFollowUpForm(user, selectedTrainerLevel));
    }
  }, [editId, selectedTrainerLevel, user]);

  const updateField = <K extends keyof MedicalFollowUpFormData>(
    field: K,
    value: MedicalFollowUpFormData[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleObservation = (observation: string) => {
    setForm((current) => ({
      ...current,
      observationsPostBrulage: current.observationsPostBrulage.includes(observation)
        ? current.observationsPostBrulage.filter((value) => value !== observation)
        : [...current.observationsPostBrulage, observation],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateMedicalFollowUpForm(form);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    setSubmitting(true);
    setResult(null);

    try {
      const isEvolution = editingRecord !== null;
      const document = await renderMedicalFollowUpPdf(form, { isEvolution });
      const filename = getMedicalFollowUpFilename(form, isEvolution);
      const submission = editingRecord
        ? await updateMedicalFollowUp(editingRecord.id, form, document, filename)
        : await createMedicalFollowUp(form, document, filename);
      setResult(submission);
      openMedicalFollowUpPdf(document, filename, previewWindow);
      showToast(
        submission.deliveryStatus === 'sent'
          ? `${isEvolution ? 'L’évolution' : 'La fiche'} a été enregistrée et envoyée par email.`
          : `${isEvolution ? 'L’évolution' : 'La fiche'} a été enregistrée. Le PDF est ouvert dans un nouvel onglet.`,
        submission.deliveryStatus === 'sent' ? 'success' : 'info',
      );
    } catch (error) {
      console.error(error);
      previewWindow?.close();
      showToast(
        error instanceof Error ? error.message : 'Impossible d’enregistrer le suivi médical.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;

    try {
      const outcome = await shareMedicalFollowUp(result.document, result.filename, form.emailFormateur);
      if (outcome === 'downloaded') {
        showToast('La fiche a été téléchargée et le message de messagerie a été préparé.', 'info');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('Le partage de la fiche n’a pas abouti.', 'error');
    }
  };

  const resetForm = () => {
    if (selectedTrainerLevel) {
      navigate(getMedicalFollowUpRoute(selectedTrainerLevel), { replace: true });
      setForm(createInitialMedicalFollowUpForm(user, selectedTrainerLevel));
    }
    setEditingRecord(null);
    setResult(null);
  };

  const selectedFunctionIsAllowed = selectedTrainerLevel === null
    || functionOptions.some((option) => option.level === selectedTrainerLevel && option.implemented);

  if (!canAccessMedicalFollowUp(user) || !selectedFunctionIsAllowed) {
    return (
      <div className="space-y-5 fade-in">
        <PageIntro
          title="Suivi médical indisponible"
          subtitle={selectedTrainerLevel && !selectedFunctionIsAllowed
            ? `La fonction ${selectedTrainerLevel} n’est pas associée à votre compte.`
            : 'Aucune des fonctions associées à votre compte ne permet actuellement d’accéder à ce questionnaire.'}
          eyebrow={(
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary">
              <HeartPulse size={16} />
              Fonction non habilitée
            </span>
          )}
        />
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.BRULAGE)}
          className="btn-primary-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 font-semibold"
        >
          <ArrowLeft size={18} />
          Retour au brûlage
        </button>
      </div>
    );
  }

  if (!selectedTrainerLevel) {
    return (
      <div className="space-y-5 fade-in">
        <PageIntro
          title="Choisir une fonction"
          subtitle="Votre compte dispose de plusieurs fonctions. Sélectionnez celle qui correspond à ce suivi médical avant d’ouvrir le questionnaire."
          eyebrow={(
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary">
              <HeartPulse size={16} />
              Suivi médical
            </span>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {functionOptions.map((option) => (
            <button
              key={option.level}
              type="button"
              onClick={() => navigate(getMedicalFollowUpRoute(option.level))}
              className="surface-card flex min-h-24 flex-col items-start justify-between gap-2 p-5 text-left transition hover:bg-surface-container"
            >
              <span className="text-headline-sm font-bold text-on-surface">{option.label}</span>
              <span className="text-label-lg font-semibold text-primary">Ouvrir le questionnaire</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.BRULAGE)}
          className="inline-flex min-h-11 items-center gap-2 rounded-squircle-sm bg-surface-container-high px-4 py-2.5 font-semibold text-on-surface"
        >
          <ArrowLeft size={18} />
          Retour au brûlage
        </button>
      </div>
    );
  }

  if (editLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-body-lg text-on-surface-variant">
        Chargement du suivi médical...
      </div>
    );
  }

  if (editingRecord && !canEditMedicalFollowUp(editingRecord)) {
    return (
      <div className="space-y-5 fade-in">
        <PageIntro
          title="Modification expirée"
          subtitle="Un suivi médical peut être modifié pendant 72 heures après son enregistrement. Cette fiche reste disponible dans votre résumé, mais elle ne peut plus être modifiée."
          eyebrow={(
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-label-lg font-semibold text-amber-700">
              <HeartPulse size={16} />
              Délai dépassé
            </span>
          )}
        />
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.ACCOUNT)}
          className="btn-primary-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 font-semibold"
        >
          <ArrowLeft size={18} />
          Retour à mon compte
        </button>
      </div>
    );
  }

  const isEvolution = Boolean(editingRecord);

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
        title={isEvolution ? 'Evolution Suivi médical' : 'Suivi médical formateur'}
        subtitle="Renseignez les éléments du formulaire de suivi médical post-brûlage. Votre identité et votre adresse email sont reprises depuis le compte connecté."
        eyebrow={(
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary">
            <HeartPulse size={16} />
            Questionnaire {selectedTrainerLevel}
          </span>
        )}
      />

      <div className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
        Les réponses sont enregistrées dans votre espace. Après validation, la fiche est envoyée à votre adresse et à {MEDICAL_FOLLOWUP_ADMIN_EMAIL} lorsque le service d’envoi est configuré.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className={sectionClasses}>
          <SectionTitle number="1" title="Formateur" description="Ces informations proviennent de l’utilisateur actuellement connecté." />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Nom du formateur</FieldLabel>
              <input className={readOnlyInputClasses} value={form.nomFormateur} readOnly aria-readonly="true" />
            </div>
            <div>
              <FieldLabel>Prénom du formateur</FieldLabel>
              <input className={readOnlyInputClasses} value={form.prenomFormateur} readOnly aria-readonly="true" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Adresse email du formateur (SDIS78.FR)</FieldLabel>
              <input className={readOnlyInputClasses} type="email" value={form.emailFormateur} readOnly aria-readonly="true" />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="2" title="Formation" />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                className={inputClasses}
                type="date"
                value={form.dateFormation}
                onChange={(event) => updateField('dateFormation', event.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Journée</FieldLabel>
              <select className={inputClasses} value={form.journee} onChange={(event) => updateField('journee', event.target.value as MedicalFollowUpFormData['journee'])} required>
                {MEDICAL_FOLLOWUP_OPTIONS.journee.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Lieu de formation</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {MEDICAL_FOLLOWUP_OPTIONS.lieuFormation.map((option, index) => (
                <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                  <input
                    type="radio"
                    name="lieuFormation"
                    value={option}
                    checked={form.lieuFormation === option}
                    onChange={(event) => updateField('lieuFormation', event.target.value as MedicalFollowUpFormData['lieuFormation'])}
                    required={index === 0}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {option}
                </label>
              ))}
            </div>
            {isMedicalFollowUpLocationWithDetails(form.lieuFormation) ? (
              <div className="mt-3">
                <FieldLabel>Préciser le lieu</FieldLabel>
                <input
                  className={inputClasses}
                  value={form.lieuFormationAutre}
                  onChange={(event) => updateField('lieuFormationAutre', event.target.value)}
                  placeholder="Ex. site ou bâtiment concerné"
                  aria-label="Préciser le lieu"
                  required
                />
              </div>
            ) : null}
          </div>

          <div>
            <FieldLabel>Formation</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MEDICAL_FOLLOWUP_OPTIONS.formation.map((option, index) => (
                <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                  <input
                    type="radio"
                    name="formation"
                    value={option}
                    checked={form.formation === option}
                    onChange={(event) => updateField('formation', event.target.value as MedicalFollowUpFormData['formation'])}
                    required={index === 0}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {option}
                </label>
              ))}
            </div>
            {form.formation === 'Autre :' ? (
              <input
                className={`${inputClasses} mt-3`}
                value={form.formationAutre}
                onChange={(event) => updateField('formationAutre', event.target.value)}
                placeholder="Précisez la formation"
                required
              />
            ) : null}
          </div>

          <div>
            <FieldLabel>Rôle formateur</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MEDICAL_FOLLOWUP_OPTIONS.roleFormateur.map((option, index) => (
                <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                  <input
                    type="radio"
                    name="roleFormateur"
                    value={option}
                    checked={form.roleFormateur === option}
                    onChange={(event) => updateField('roleFormateur', event.target.value as MedicalFollowUpFormData['roleFormateur'])}
                    required={index === 0}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="3" title="Conditions du brûlage" />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Conditions météo</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEDICAL_FOLLOWUP_OPTIONS.conditionsMeteo.map((option, index) => (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                    <input
                      type="radio"
                      name="conditionsMeteo"
                      value={option}
                      checked={form.conditionsMeteo === option}
                      onChange={(event) => updateField('conditionsMeteo', event.target.value as MedicalFollowUpFormData['conditionsMeteo'])}
                      required={index === 0}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel optional>Température</FieldLabel>
              <input
                className={inputClasses}
                value={form.temperature}
                onChange={(event) => updateField('temperature', event.target.value)}
                inputMode="decimal"
                placeholder="Ex. 18"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Hydratation avant brûlage</FieldLabel>
              <select className={inputClasses} value={form.hydratationAvantBrulage} onChange={(event) => updateField('hydratationAvantBrulage', event.target.value as MedicalFollowUpFormData['hydratationAvantBrulage'])} required>
                <option value="">Sélectionner</option>
                {MEDICAL_FOLLOWUP_OPTIONS.hydratation.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Hydratation après brûlage</FieldLabel>
              <select className={inputClasses} value={form.hydratationApresBrulage} onChange={(event) => updateField('hydratationApresBrulage', event.target.value as MedicalFollowUpFormData['hydratationApresBrulage'])} required>
                <option value="">Sélectionner</option>
                {MEDICAL_FOLLOWUP_OPTIONS.hydratation.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Type de brûlage</FieldLabel>
              <select className={inputClasses} value={form.typeBrulage} onChange={(event) => updateField('typeBrulage', event.target.value as MedicalFollowUpFormData['typeBrulage'])} required>
                <option value="">Sélectionner</option>
                {MEDICAL_FOLLOWUP_OPTIONS.typeBrulage.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {form.typeBrulage === 'Feux réels' ? (
                <input
                  className={`${inputClasses} mt-3`}
                  value={form.typeBrulageAutre}
                  onChange={(event) => updateField('typeBrulageAutre', event.target.value)}
                  inputMode="numeric"
                  placeholder="Nombre de mises à feu"
                  required
                />
              ) : null}
            </div>
            <div>
              <FieldLabel>Durée sous ARI en minutes (1 bouteille = 30 min)</FieldLabel>
              <select className={inputClasses} value={form.tempsAri} onChange={(event) => updateField('tempsAri', event.target.value as MedicalFollowUpFormData['tempsAri'])} required>
                <option value="">Sélectionner</option>
                {MEDICAL_FOLLOWUP_OPTIONS.tempsAri.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="4" title="Après le brûlage" />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Décontamination post-brûlage</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEDICAL_FOLLOWUP_OPTIONS.decontamination.map((option, index) => (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                    <input
                      type="radio"
                      name="decontaminationPostBrulage"
                      value={option}
                      checked={form.decontaminationPostBrulage === option}
                      onChange={(event) => updateField('decontaminationPostBrulage', event.target.value as MedicalFollowUpFormData['decontaminationPostBrulage'])}
                      required={index === 0}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Douche dans l’heure suivant le brûlage</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEDICAL_FOLLOWUP_OPTIONS.douche.map((option, index) => (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                    <input
                      type="radio"
                      name="doucheDansHeure"
                      value={option}
                      checked={form.doucheDansHeure === option}
                      onChange={(event) => updateField('doucheDansHeure', event.target.value as MedicalFollowUpFormData['doucheDansHeure'])}
                      required={index === 0}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Observations post-brûlage</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MEDICAL_FOLLOWUP_OPTIONS.observationsPostBrulage.map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition hover:bg-surface-container-high">
                  <input
                    type="checkbox"
                    value={option}
                    checked={form.observationsPostBrulage.includes(option)}
                    onChange={() => toggleObservation(option)}
                    className="h-4 w-4 rounded accent-[var(--primary)]"
                  />
                  {option}
                </label>
              ))}
            </div>
            {form.observationsPostBrulage.includes('Autre :') ? (
              <input
                className={`${inputClasses} mt-3`}
                value={form.observationsPostBrulageAutre}
                onChange={(event) => updateField('observationsPostBrulageAutre', event.target.value)}
                placeholder="Précisez l’observation"
                required
              />
            ) : null}
          </div>

          <div>
            <FieldLabel optional>Observations</FieldLabel>
            <textarea
              className={`${inputClasses} min-h-32 resize-y`}
              value={form.observations}
              onChange={(event) => updateField('observations', event.target.value)}
              placeholder="Ajoutez une observation complémentaire"
            />
          </div>
        </section>

        <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <p className="text-body-md font-semibold text-on-surface">Vérifiez les réponses avant validation.</p>
            <p className="mt-1 text-body-md text-on-surface-variant">La fiche sera générée au format PDF à partir du modèle fourni et ouverte dans un nouvel onglet.</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !user}
            className="btn-primary-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-squircle-sm px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={19} />
            {submitting ? 'Enregistrement...' : 'Valider le suivi'}
          </button>
        </div>
      </form>

      {result ? (
        <section className="surface-card space-y-4 border border-emerald-500/25 p-5 md:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={23} />
            <div>
              <h2 className="text-headline-md text-on-surface">
                {isEvolution ? 'Evolution Suivi médical enregistrée' : 'Suivi enregistré'}
              </h2>
              {result.deliveryStatus === 'sent' ? (
                <p className="mt-1 text-body-md text-on-surface-variant">
                  La fiche a été envoyée à {form.emailFormateur} et à {MEDICAL_FOLLOWUP_ADMIN_EMAIL}.
                </p>
              ) : (
                <p className="mt-1 text-body-md text-on-surface-variant">
                  L’enregistrement est conservé. Le PDF a été ouvert dans un nouvel onglet. L’envoi automatique n’est pas disponible pour le moment ; vous pouvez le télécharger ou le partager avec votre messagerie.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => openMedicalFollowUpPdf(result.document, result.filename)}
              className="btn-primary-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold"
            >
              <FileText size={18} />
              Ouvrir le PDF
            </button>
            <button
              type="button"
              onClick={() => downloadMedicalFollowUp(result.document, result.filename)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm bg-surface-container-high px-4 py-2.5 text-body-md font-semibold text-on-surface transition hover:bg-surface-container-highest"
            >
              <Download size={18} />
              Télécharger la fiche
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm border border-primary/30 px-4 py-2.5 text-body-md font-semibold text-primary transition hover:bg-primary/5"
            >
              {typeof navigator.share === 'function' ? <Share2 size={18} /> : <Mail size={18} />}
              Partager avec ma messagerie
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold text-on-surface-variant transition hover:bg-surface-container"
            >
              <RotateCcw size={17} />
              Nouveau suivi
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
