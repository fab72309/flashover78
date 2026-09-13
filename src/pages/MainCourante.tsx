import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Download, FileText, Mail, RotateCcw, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createMainCourante,
  getFormEmailDestinations,
  type MainCouranteSubmissionResult,
} from '../services/supabaseService';
import type {
  MainCouranteFormData,
  MainCouranteSite,
  MainCouranteTraining,
} from '../types';
import {
  createInitialMainCouranteForm,
  downloadMainCourantePdf,
  formatMainCouranteDate,
  getMainCouranteFilename,
  getMainCouranteFormationOptions,
  getMainCouranteRoute,
  getMainCouranteTypeSessionOptions,
  MAIN_COURANTE_CART_STATES,
  MAIN_COURANTE_FORMATEUR_OPTIONS,
  MAIN_COURANTE_QUANTITIES,
  MAIN_COURANTE_SITES,
  MAIN_COURANTE_WASTE_LEVELS,
  MAIN_COURANTE_WEATHER,
  MAIN_COURANTE_WIND_DIRECTIONS,
  MAIN_COURANTE_WIND_STRENGTHS,
  openMainCourantePdf,
  shareMainCourantePdf,
  validateMainCouranteForm,
} from '../utils/mainCourante';
import { APP_ROUTES } from '../utils/constants';
import {
  createDefaultFormEmailDestinations,
  formatEmailRecipients,
  mergeEmailRecipients,
} from '../utils/emailDestinations';
import { renderMainCourantePdf } from '../utils/mainCourantePdf';

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

function FieldLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <span className="mb-1.5 block text-label-lg text-on-surface">
      {children}
      {optional ? <span className="ml-1 font-normal text-on-surface-variant">(facultatif)</span> : null}
    </span>
  );
}

interface ChoiceGridProps {
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  columns?: string;
  disabled?: boolean;
  required?: boolean;
}

function ChoiceGrid({ name, value, options, onChange, columns = 'sm:grid-cols-2', disabled = false, required = false }: ChoiceGridProps) {
  return (
    <div className={`grid gap-2 ${columns}`} role="radiogroup" aria-label={name}>
      {options.map((option, index) => (
        <label
          key={option}
          className={`flex items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-container-high'}`}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={(event) => onChange(event.target.value)}
            required={!disabled && required && index === 0}
            disabled={disabled}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

interface CheckboxGridProps {
  name: string;
  values: string[];
  options: readonly string[];
  onToggle: (value: string) => void;
  columns?: string;
  disabled?: boolean;
}

function CheckboxGrid({ name, values, options, onToggle, columns = 'sm:grid-cols-2', disabled = false }: CheckboxGridProps) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {options.map((option) => (
        <label
          key={option}
          className={`flex items-center gap-3 rounded-squircle-sm bg-surface-container px-3 py-3 text-body-md text-on-surface transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-container-high'}`}
        >
          <input
            type="checkbox"
            name={name}
            value={option}
            checked={values.includes(option)}
            onChange={() => onToggle(option)}
            disabled={disabled}
            className="h-4 w-4 rounded accent-[var(--primary)]"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

interface ScaleFieldProps {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  required?: boolean;
}

function ScaleField({
  name,
  label,
  value,
  options,
  onChange,
  startLabel,
  endLabel,
  disabled = false,
  required = false,
}: ScaleFieldProps) {
  return (
    <div>
      <FieldLabel optional>{label}</FieldLabel>
      <div className={`flex items-center gap-2 rounded-squircle-sm bg-surface-container px-3 py-3 ${disabled ? 'opacity-60' : ''}`}>
        {startLabel ? <span className="w-16 shrink-0 text-center text-label-sm text-on-surface-variant">{startLabel}</span> : null}
        <div
          className="grid flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
          role="radiogroup"
          aria-label={label}
        >
          {options.map((option, index) => (
            <label
              key={option}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-label-sm text-on-surface transition hover:bg-surface-container-high"
            >
              <span>{option}</span>
              <input
                type="radio"
                name={name}
                value={option}
                checked={value === option}
                onChange={(event) => onChange(event.target.value)}
                required={!disabled && required && index === 0}
                disabled={disabled}
                className="h-4 w-4 accent-[var(--primary)]"
              />
            </label>
          ))}
        </div>
        {endLabel ? <span className="w-16 shrink-0 text-center text-label-sm text-on-surface-variant">{endLabel}</span> : null}
      </div>
    </div>
  );
}

function MainCouranteSiteSection({
  site,
  form,
  updateField,
  toggleCartState,
}: {
  site: MainCouranteSite;
  form: MainCouranteFormData;
  updateField: <K extends keyof MainCouranteFormData>(field: K, value: MainCouranteFormData[K]) => void;
  toggleCartState: (value: string) => void;
}) {
  const sessionOptions = getMainCouranteTypeSessionOptions(site);
  const formationOptions = getMainCouranteFormationOptions(site);
  const isFriche = site === 'Feux réels en friche bâtimentaire';

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>Type de session</FieldLabel>
          <ChoiceGrid
            name="typeSession"
            value={form.typeSession}
            options={sessionOptions}
            onChange={(value) => updateField('typeSession', value as MainCouranteFormData['typeSession'])}
            columns="sm:grid-cols-1"
            required
          />
          {isFriche ? (
            <p className="mt-2 text-label-sm text-on-surface-variant">
              Ces choix sont conservés depuis la branche « Feu réel en friche bâtimentaire » du formulaire d’origine.
            </p>
          ) : null}
        </div>
        {formationOptions.length > 0 ? (
          <div>
            <FieldLabel>Formation</FieldLabel>
            <ChoiceGrid
              name="formation"
              value={form.formation}
              options={formationOptions}
              onChange={(value) => updateField('formation', value as MainCouranteTraining)}
              columns="sm:grid-cols-2"
              required
            />
          </div>
        ) : null}
      </div>

      {site === 'Montigny le Bretonneux' ? (
        <div className="space-y-4">
          <ScaleField
            name="citerneGaz"
            label="Citerne de gaz :"
            value={form.citerneGaz}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('citerneGaz', value as MainCouranteFormData['citerneGaz'])}
            startLabel="0%"
            endLabel="100%"
          />
          <ScaleField
            name="panneauxBois"
            label="Panneaux de bois"
            value={form.panneauxBois}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('panneauxBois', value as MainCouranteFormData['panneauxBois'])}
            startLabel="1 brulage"
            endLabel="10 brulages"
          />
          <ScaleField
            name="palettes"
            label="Palettes"
            value={form.palettes}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('palettes', value as MainCouranteFormData['palettes'])}
            startLabel="1 brulage"
            endLabel="10 brulages"
          />
          <ScaleField
            name="masquesFfp3"
            label="Masques FFP3"
            value={form.masquesFfp3}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('masquesFfp3', value as MainCouranteFormData['masquesFfp3'])}
          />
          <ScaleField
            name="gantsNitrile"
            label="Gants Nitrile"
            value={form.gantsNitrile}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('gantsNitrile', value as MainCouranteFormData['gantsNitrile'])}
          />
          <ScaleField
            name="benneDechet"
            label="Benne à déchet"
            value={form.benneDechet}
            options={MAIN_COURANTE_WASTE_LEVELS}
            onChange={(value) => updateField('benneDechet', value as MainCouranteFormData['benneDechet'])}
            startLabel="Vide"
            endLabel="Pleine"
          />
          <div>
            <FieldLabel optional>Chariot foyer de démarrage</FieldLabel>
            <CheckboxGrid
              name="chariotFoyerDemarrage"
              values={form.chariotFoyerDemarrage}
              options={MAIN_COURANTE_CART_STATES}
              onToggle={toggleCartState}
              columns="sm:grid-cols-2"
            />
          </div>
        </div>
      ) : null}

      {site === 'Poissy' ? (
        <div className="space-y-4">
          <ScaleField
            name="masquesFfp3"
            label="Masques FFP3"
            value={form.masquesFfp3}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('masquesFfp3', value as MainCouranteFormData['masquesFfp3'])}
          />
          <ScaleField
            name="gantsNitrile"
            label="Gants Nitrile"
            value={form.gantsNitrile}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('gantsNitrile', value as MainCouranteFormData['gantsNitrile'])}
          />
          <ScaleField
            name="benneDechet"
            label="Benne à déchet"
            value={form.benneDechet}
            options={MAIN_COURANTE_WASTE_LEVELS}
            onChange={(value) => updateField('benneDechet', value as MainCouranteFormData['benneDechet'])}
            startLabel="Vide"
            endLabel="Pleine"
          />
          <ScaleField
            name="panneauxBois"
            label="Panneaux de bois"
            value={form.panneauxBois}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('panneauxBois', value as MainCouranteFormData['panneauxBois'])}
            startLabel="1 brulage"
            endLabel="10 brulages"
          />
          <ScaleField
            name="palettes"
            label="Palettes"
            value={form.palettes}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('palettes', value as MainCouranteFormData['palettes'])}
            startLabel="1 brulage"
            endLabel="10 brulages"
          />
          <div>
            <FieldLabel optional>Chariot foyer de démarrage</FieldLabel>
            <CheckboxGrid
              name="chariotFoyerDemarrage"
              values={form.chariotFoyerDemarrage}
              options={MAIN_COURANTE_CART_STATES}
              onToggle={toggleCartState}
              columns="sm:grid-cols-2"
            />
          </div>
        </div>
      ) : null}

      {isFriche ? (
        <div className="space-y-4">
          <ScaleField
            name="masquesFfp3"
            label="Masques FFP3"
            value={form.masquesFfp3}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('masquesFfp3', value as MainCouranteFormData['masquesFfp3'])}
          />
          <ScaleField
            name="gantsNitrile"
            label="Gants Nitrile"
            value={form.gantsNitrile}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('gantsNitrile', value as MainCouranteFormData['gantsNitrile'])}
          />
          <ScaleField
            name="palettes"
            label="Palettes"
            value={form.palettes}
            options={MAIN_COURANTE_QUANTITIES}
            onChange={(value) => updateField('palettes', value as MainCouranteFormData['palettes'])}
            startLabel="1 brulage"
            endLabel="10 brulages"
          />
          <p className="text-label-sm text-on-surface-variant">
            Le formulaire d’origine affichait ces éléments désactivés ; ils sont disponibles ici pour permettre de renseigner la main courante.
          </p>
        </div>
      ) : null}
    </>
  );
}

export default function MainCourante() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<MainCouranteFormData>(() => createInitialMainCouranteForm(user));
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<MainCouranteSubmissionResult | null>(null);
  const [emailDestinations, setEmailDestinations] = useState(createDefaultFormEmailDestinations);

  useEffect(() => {
    let isMounted = true;
    getFormEmailDestinations().then((destinations) => {
      if (isMounted) setEmailDestinations(destinations);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = <K extends keyof MainCouranteFormData>(
    field: K,
    value: MainCouranteFormData[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSiteChange = (site: MainCouranteFormData['siteFormation']) => {
    setForm((current) => ({
      ...current,
      siteFormation: site,
      typeSession: '',
      formation: '',
      citerneGaz: '',
      panneauxBois: '',
      palettes: '',
      masquesFfp3: '',
      gantsNitrile: '',
      benneDechet: '',
      chariotFoyerDemarrage: [],
    }));
  };

  const toggleWeather = (weather: string) => {
    setForm((current) => ({
      ...current,
      meteo: current.meteo.includes(weather as MainCouranteFormData['meteo'][number])
        ? current.meteo.filter((value) => value !== weather)
        : [...current.meteo, weather as MainCouranteFormData['meteo'][number]],
    }));
  };

  const toggleCartState = (state: string) => {
    setForm((current) => ({
      ...current,
      chariotFoyerDemarrage: current.chariotFoyerDemarrage.includes(state as MainCouranteFormData['chariotFoyerDemarrage'][number])
        ? current.chariotFoyerDemarrage.filter((value) => value !== state)
        : [...current.chariotFoyerDemarrage, state as MainCouranteFormData['chariotFoyerDemarrage'][number]],
    }));
  };

  const updateFormateur = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      formateurs: current.formateurs.map((candidate, candidateIndex) => (
        candidateIndex === index ? value : candidate
      )),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateMainCouranteForm(form);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    setSubmitting(true);
    let pdfOpened = false;
    try {
      const document = await renderMainCourantePdf(form);
      const filename = getMainCouranteFilename(form);
      if (previewWindow && !previewWindow.closed) {
        pdfOpened = openMainCourantePdf(document, filename, previewWindow);
      }
      const result = await createMainCourante(form, document, filename);
      setSubmission(result);
      if (!pdfOpened) {
        openMainCourantePdf(document, filename);
      }
      showToast('La main courante et son PDF ont été enregistrés.', 'success');
    } catch (error) {
      console.error(error);
      previewWindow?.close();
      showToast(
        error instanceof Error ? error.message : 'Impossible de générer et d’enregistrer la main courante.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(createInitialMainCouranteForm(user));
    setSubmission(null);
    navigate(getMainCouranteRoute(), { replace: true });
  };

  const handleShare = async () => {
    if (!submission) return;

    const repairRecipientEmails = submission.record.reparationsMateriel.trim()
      ? emailDestinations.demandeReparation
      : [];
    const recipientEmails = mergeEmailRecipients(emailDestinations.mainCourante, repairRecipientEmails);

    try {
      const outcome = await shareMainCourantePdf(
        submission.document,
        submission.filename,
        emailDestinations.mainCourante,
        repairRecipientEmails,
      );
      if (outcome === 'downloaded') {
        showToast(`Le PDF a été téléchargé et un message pour ${formatEmailRecipients(recipientEmails)} a été préparé.`, 'info');
      } else {
        showToast('Le PDF est prêt dans le partage de votre appareil.', 'info');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('Le partage de la main courante n’a pas abouti.', 'error');
    }
  };

  const submissionRecipientEmails = submission
    ? mergeEmailRecipients(
      emailDestinations.mainCourante,
      submission.record.reparationsMateriel.trim()
        ? emailDestinations.demandeReparation
        : [],
    )
    : emailDestinations.mainCourante;

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
        title="Main courante"
        subtitle="Renseignez les éléments de la main courante du groupe de formateurs incendie de structure. Votre adresse email est reprise depuis le compte connecté."
        eyebrow={(
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary">
            <ClipboardList size={16} />
            Formulaire terrain
          </span>
        )}
      />

      <div className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
        Les éléments renseignés sont enregistrés dans votre espace. Les champs matériels et les observations restent facultatifs, comme dans le formulaire d’origine.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className={sectionClasses}>
          <SectionTitle number="1" title="Formateur et date" description="L’adresse email provient de l’utilisateur actuellement connecté." />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Adresse email du formateur (SDIS78.FR)</FieldLabel>
              <input className={readOnlyInputClasses} type="email" value={form.emailFormateur} readOnly aria-readonly="true" />
            </div>
            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                className={inputClasses}
                type="date"
                value={form.dateMainCourante}
                onChange={(event) => updateField('dateMainCourante', event.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="2" title="Conditions extérieures" />
          <ScaleField
            name="vent"
            label="Vent"
            value={form.vent}
            options={MAIN_COURANTE_WIND_STRENGTHS}
            onChange={(value) => updateField('vent', value as MainCouranteFormData['vent'])}
            startLabel="Faible"
            endLabel="Fort"
          />
          <div>
            <FieldLabel optional>Sens du vent</FieldLabel>
            <ChoiceGrid
              name="sensDuVent"
              value={form.sensDuVent}
              options={MAIN_COURANTE_WIND_DIRECTIONS}
              onChange={(value) => updateField('sensDuVent', value as MainCouranteFormData['sensDuVent'])}
              columns="sm:grid-cols-3"
            />
          </div>
          <div>
            <FieldLabel optional>Météo</FieldLabel>
            <CheckboxGrid
              name="meteo"
              values={form.meteo}
              options={MAIN_COURANTE_WEATHER}
              onToggle={toggleWeather}
              columns="sm:grid-cols-2"
            />
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="3" title="Formateurs" description="Les cinq emplacements du Google Form sont conservés ; les sélections restent facultatives." />
          <div className="grid gap-4 md:grid-cols-2">
            {form.formateurs.map((value, index) => (
              <div key={`formateur-${index}`}>
                <FieldLabel>Formateur N°{index + 1}</FieldLabel>
                <select
                  className={inputClasses}
                  value={value}
                  onChange={(event) => updateFormateur(index, event.target.value)}
                >
                  <option value="">Sélectionner</option>
                  {MAIN_COURANTE_FORMATEUR_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionTitle number="4" title="Site de formation" />
          <ChoiceGrid
            name="siteFormation"
            value={form.siteFormation}
            options={MAIN_COURANTE_SITES}
            onChange={(value) => handleSiteChange(value as MainCouranteSite)}
            columns="sm:grid-cols-1"
            required
          />
        </section>

        {form.siteFormation ? (
          <section className={sectionClasses}>
            <SectionTitle number="5" title={form.siteFormation === 'Feux réels en friche bâtimentaire' ? 'Feu réel en friche bâtimentaire' : form.siteFormation} description="Les questions affichées correspondent au site sélectionné dans le formulaire d’origine." />
            <MainCouranteSiteSection
              site={form.siteFormation}
              form={form}
              updateField={updateField}
              toggleCartState={toggleCartState}
            />
          </section>
        ) : (
          <section className={sectionClasses}>
            <SectionTitle number="5" title="Éléments du site" />
            <p className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
              Sélectionnez un site pour afficher les éléments de la seconde étape du formulaire.
            </p>
          </section>
        )}

        <section className={sectionClasses}>
          <SectionTitle number="6" title="Observations et réparations" />
          <div>
            <FieldLabel optional>Observations, difficultés rencontrées</FieldLabel>
            <textarea
              className={`${inputClasses} min-h-32 resize-y`}
              value={form.observationsDifficultes}
              onChange={(event) => updateField('observationsDifficultes', event.target.value)}
              placeholder="Votre réponse"
            />
          </div>
          <div>
            <FieldLabel optional>Réparations, remplacement de matériel à prévoir</FieldLabel>
            <textarea
              className={`${inputClasses} min-h-32 resize-y`}
              value={form.reparationsMateriel}
              onChange={(event) => updateField('reparationsMateriel', event.target.value)}
              placeholder="Votre réponse"
            />
          </div>
        </section>

        <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <p className="text-body-md font-semibold text-on-surface">Vérifiez les réponses avant validation.</p>
            <p className="mt-1 text-body-md text-on-surface-variant">La main courante sera enregistrée dans votre espace.</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !user}
            className="btn-primary-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-squircle-sm px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={19} />
            {submitting ? 'Enregistrement...' : 'Valider la main courante'}
          </button>
        </div>
      </form>

      {submission ? (
        <section className="surface-card space-y-4 border border-emerald-500/25 p-5 md:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={23} />
            <div>
              <h2 className="text-headline-md text-on-surface">Main courante enregistrée</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                La main courante du {formatMainCouranteDate(submission.record.dateMainCourante)} pour {submission.record.siteFormation} est conservée dans votre espace. Le PDF a été ouvert dans un nouvel onglet.
              </p>
            </div>
          </div>
          <p className="rounded-squircle-sm bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
            Pour l’envoyer à {formatEmailRecipients(submissionRecipientEmails)}, utilisez le partage natif de l’appareil lorsque celui-ci permet de joindre le PDF. Sinon, le fichier est téléchargé et un message prérempli s’ouvre ; ajoutez le fichier avant l’envoi.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => openMainCourantePdf(submission.document, submission.filename)}
              className="btn-primary-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold"
            >
              <FileText size={18} />
              Ouvrir le PDF
            </button>
            <button
              type="button"
              onClick={() => downloadMainCourantePdf(submission.document, submission.filename)}
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
              Envoyer à {formatEmailRecipients(submissionRecipientEmails)}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-squircle-sm px-4 py-2.5 text-body-md font-semibold text-on-surface-variant transition hover:bg-surface-container"
            >
              <RotateCcw size={17} />
              Nouvelle main courante
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
