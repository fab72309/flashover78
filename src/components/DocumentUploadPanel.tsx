import { useState } from 'react';
import { FolderOpen, Plus, UploadCloud, X } from 'lucide-react';
import { createCatalogDocument } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import type { ResourceCategory } from '../types';
import { RESOURCE_CATEGORY_LABELS } from '../utils/constants';

const HIDDEN_GENERAL_UPLOAD_CATEGORIES = new Set<ResourceCategory>([
  'BRULAGE_TDL_FO',
  'BRULAGE_MAF',
]);

interface DocumentUploadPanelProps {
  label: string;
  defaultCategory?: ResourceCategory;
  lockCategory?: boolean;
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  onUploaded: () => Promise<void> | void;
}

export default function DocumentUploadPanel({
  label,
  defaultCategory = 'SDIS78',
  lockCategory = false,
  initiallyOpen = false,
  showTrigger = true,
  onUploaded,
}: DocumentUploadPanelProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(initiallyOpen);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ResourceCategory>(defaultCategory);
  const [tags, setTags] = useState('');
  const [versionLabel, setVersionLabel] = useState('1.0');
  const [authorName, setAuthorName] = useState(user?.displayName ?? '');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      return;
    }

    setLoading(true);
    try {
      await createCatalogDocument({
        file,
        metadata: {
          title,
          category,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          versionLabel,
          authorName,
          effectiveAt: effectiveAt ? new Date(`${effectiveAt}T12:00:00`) : null,
          expiresAt: expiresAt ? new Date(`${expiresAt}T12:00:00`) : null,
        },
      });
      setFile(null);
      setTitle('');
      setTags('');
      setVersionLabel('1.0');
      setEffectiveAt('');
      setExpiresAt('');
      setOpen(false);
      await onUploaded();
      showToast('Document ajouté au catalogue.', 'success');
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'Erreur lors de l’ajout du document', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {showTrigger && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="w-14 h-14 btn-primary-gradient rounded-full flex items-center justify-center shadow-ambient-lg"
            aria-label={`Ajouter ${label}`}
          >
            {open ? <X size={24} className="text-white" /> : <Plus size={24} className="text-white" />}
          </button>
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="surface-card p-5 space-y-4">
          <div>
            <h2 className="text-headline-md text-on-surface">Ajouter {label}</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Renseignez les informations nécessaires pour retrouver et suivre ce document.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Titre</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              />
            </label>

            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Catégorie</span>
              <select
                value={category}
                disabled={lockCategory}
                onChange={(event) => setCategory(event.target.value as ResourceCategory)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface disabled:opacity-70"
              >
                {Object.entries(RESOURCE_CATEGORY_LABELS)
                  .filter(([value]) =>
                    lockCategory
                      ? value === defaultCategory
                      : !HIDDEN_GENERAL_UPLOAD_CATEGORIES.has(value as ResourceCategory)
                  )
                  .map(([value, categoryLabel]) => (
                  <option key={value} value={value}>{categoryLabel}</option>
                  ))}
              </select>
            </label>
          </div>

          <div>
            <span className="block text-label-lg text-on-surface mb-1.5">Fichier</span>
            <input
              id="document-file"
              type="file"
              accept=".pdf,.odt,.doc,.docx,.ppt,.pptx,.txt"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                if (nextFile && !title) {
                  setTitle(nextFile.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              className="sr-only"
              required
            />
            <label
              htmlFor="document-file"
              className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 font-semibold text-on-surface hover:bg-surface-container-highest"
            >
              <FolderOpen size={18} aria-hidden="true" />
              Parcourir…
            </label>
            <p className="mt-2 text-body-md text-on-surface-variant">
              {file ? `${file.name} · ${Math.ceil(file.size / 1024)} Ko` : 'Aucun fichier sélectionné'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Version</span>
              <input
                type="text"
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                placeholder="1.0"
                required
              />
            </label>

            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">Auteur</span>
              <input
                type="text"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-label-lg text-on-surface mb-1.5">
              Tags
            </span>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              placeholder="caisson, sécurité, référentiel"
            />
            <span className="mt-1 block text-label-sm text-on-surface-variant">
              Séparez les tags par des virgules.
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">
                Date d’effet <span className="text-label-sm text-on-surface-variant">(facultative)</span>
              </span>
              <input
                type="date"
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              />
            </label>

            <label className="block">
              <span className="block text-label-lg text-on-surface mb-1.5">
                Date d’expiration <span className="text-label-sm text-on-surface-variant">(facultative)</span>
              </span>
              <input
                type="date"
                value={expiresAt}
                min={effectiveAt || undefined}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface"
              />
            </label>
          </div>
          <p className="-mt-2 text-label-sm text-on-surface-variant">
            Laissez ces champs vides si le document n’a pas de date d’effet ou d’échéance.
          </p>

          <button
            type="submit"
            disabled={!file || !title.trim() || !versionLabel.trim() || loading}
            className="w-full btn-primary-gradient py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UploadCloud size={18} className="text-white" />
            {loading ? 'Envoi...' : 'Envoyer le document'}
          </button>
        </form>
      )}
    </div>
  );
}
