import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  CloudOff,
  ExternalLink,
  FileClock,
  FileText,
  History,
  Pencil,
  RefreshCw,
  Star,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  cacheDocumentForOffline,
  getCachedDocumentUrl,
  getDocumentById,
  getDocumentDownloadUrl,
  getDocumentVersionDownloadUrl,
  listDocumentVersions,
  removeDocumentFromOffline,
  replaceDocumentVersion,
  toggleDocumentFavorite,
  updateDocumentMetadata,
} from '../services/supabaseService';
import type {
  Resource,
  ResourceCategory,
  ResourceVersion,
} from '../types';
import {
  APP_ROUTES,
  RESOURCE_CATEGORY_LABELS,
} from '../utils/constants';
import {
  formatFileSize,
  getDocumentExpirationLabel,
  getDocumentExpirationState,
  getResourceCategoryLabel,
} from '../utils/documents';
import { canContribute } from '../utils/permissions';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [document, setDocument] = useState<Resource | null>(null);
  const [versions, setVersions] = useState<ResourceVersion[]>([]);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [referenceDate] = useState(() => new Date());

  const prepareUrls = useCallback(async (resource: Resource) => {
    const cachedUrl = resource.isOfflineSelected
      ? await getCachedDocumentUrl(resource)
      : null;
    const nextOpenUrl = cachedUrl ?? await getDocumentDownloadUrl(resource);
    setOpenUrl(nextOpenUrl);
    setDownloadUrl(await getDocumentDownloadUrl(resource, true));
  }, []);

  const loadDocument = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextDocument = await getDocumentById(id);
      if (!nextDocument) {
        setDocument(null);
        setError('Ce document est introuvable.');
        return;
      }

      setDocument(nextDocument);
      const [nextVersions] = await Promise.all([
        listDocumentVersions(id),
        prepareUrls(nextDocument),
      ]);
      setVersions(nextVersions);
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger ce document.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, prepareUrls]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleFavorite = async () => {
    if (!document) {
      return;
    }

    setActionBusy(true);
    try {
      const isFavorite = await toggleDocumentFavorite(document.id);
      setDocument({ ...document, isFavorite });
    } catch (favoriteError) {
      showToast(
        favoriteError instanceof Error
          ? favoriteError.message
          : 'Impossible de modifier le favori.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleOffline = async () => {
    if (!document) {
      return;
    }

    setActionBusy(true);
    try {
      if (document.isOfflineSelected) {
        await removeDocumentFromOffline(document);
        const nextDocument = { ...document, isOfflineSelected: false };
        setDocument(nextDocument);
        await prepareUrls(nextDocument);
        showToast('Document retiré du stockage hors ligne.', 'success');
      } else {
        await cacheDocumentForOffline(document);
        const nextDocument = { ...document, isOfflineSelected: true };
        setDocument(nextDocument);
        await prepareUrls(nextDocument);
        showToast('Document disponible hors ligne.', 'success');
      }
    } catch (offlineError) {
      showToast(
        offlineError instanceof Error
          ? offlineError.message
          : 'Impossible de modifier la disponibilité hors ligne.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const openVersion = async (version: ResourceVersion) => {
    try {
      const url = await getDocumentVersionDownloadUrl(version);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (versionError) {
      showToast(
        versionError instanceof Error
          ? versionError.message
          : 'Impossible d’ouvrir cette version.',
        'error'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => navigate(APP_ROUTES.RESOURCES)} />
        <section className="surface-card p-5" role="alert">
          <h1 className="text-headline-md text-on-surface">Document indisponible</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {error ?? 'Le document demandé n’est pas disponible.'}
          </p>
          <button
            type="button"
            onClick={loadDocument}
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
          >
            <RefreshCw size={18} />
            Réessayer
          </button>
        </section>
      </div>
    );
  }

  const expirationState = getDocumentExpirationState(
    document.expiresAt,
    referenceDate
  );
  const expirationClass = expirationState === 'expired'
    ? 'bg-red-100 text-red-800'
    : expirationState === 'expiring'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-800';

  return (
    <div className="space-y-6 fade-in">
      <BackButton onClick={() => navigate(APP_ROUTES.RESOURCES)} />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-outline-variant p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-sm font-semibold text-primary">
                  {getResourceCategoryLabel(document.category)}
                </span>
                <span className={`rounded-full px-3 py-1 text-label-sm ${expirationClass}`}>
                  {getDocumentExpirationLabel(expirationState)}
                </span>
                {document.isOfflineSelected ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
                    Disponible hors ligne
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-display-sm text-on-surface">{document.title}</h1>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Version {document.versionLabel}
                {document.authorName ? ` · ${document.authorName}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleFavorite}
                disabled={actionBusy}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50',
                  document.isFavorite
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant',
                ].join(' ')}
                aria-label={document.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                title={document.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star size={19} fill={document.isFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={handleOffline}
                disabled={actionBusy}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50',
                  document.isOfflineSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant',
                ].join(' ')}
                aria-label={
                  document.isOfflineSelected
                    ? 'Retirer du stockage hors ligne'
                    : 'Rendre disponible hors ligne'
                }
                title={
                  document.isOfflineSelected
                    ? 'Retirer du stockage hors ligne'
                    : 'Rendre disponible hors ligne'
                }
              >
                {document.isOfflineSelected ? <CloudOff size={19} /> : <Download size={19} />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-6">
          <div className="space-y-4">
            <MetadataRow
              icon={<FileText size={19} />}
              label="Fichier"
              value={`${document.originalFilename} · ${formatFileSize(document.fileSize)}`}
            />
            <MetadataRow
              icon={<UserRound size={19} />}
              label="Auteur"
              value={document.authorName || 'Non renseigné'}
            />
            <MetadataRow
              icon={<CalendarDays size={19} />}
              label="Date d’effet"
              value={
                document.effectiveAt
                  ? format(document.effectiveAt, 'd MMMM yyyy', { locale: fr })
                  : 'Non renseignée'
              }
            />
            <MetadataRow
              icon={<FileClock size={19} />}
              label="Date d’expiration"
              value={
                document.expiresAt
                  ? format(document.expiresAt, 'd MMMM yyyy', { locale: fr })
                  : 'Sans échéance'
              }
            />

            {document.tags.length ? (
              <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-4">
                {document.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-container px-3 py-1 text-label-sm text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <a
              href={openUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!openUrl}
              className={[
                'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white',
                !openUrl ? 'pointer-events-none opacity-50' : '',
              ].join(' ')}
            >
              <ExternalLink size={18} />
              Ouvrir le document
            </a>
            <a
              href={downloadUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!downloadUrl}
              className={[
                'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-on-surface px-4 font-semibold text-white',
                !downloadUrl ? 'pointer-events-none opacity-50' : '',
              ].join(' ')}
            >
              <Download size={18} />
              Télécharger
            </a>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-outline-variant pt-6">
        <div className="flex items-center gap-3">
          <History size={21} className="text-primary" />
          <div>
            <h2 className="text-headline-lg text-on-surface">Historique des versions</h2>
            <p className="text-body-md text-on-surface-variant">
              {versions.length} version{versions.length > 1 ? 's' : ''} conservée{versions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-on-surface">
                  Version {version.versionLabel}
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  {version.originalFilename} · {formatFileSize(version.fileSize)}
                  {` · ${format(version.createdAt, 'd MMM yyyy', { locale: fr })}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openVersion(version)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-container px-3 font-semibold text-primary"
              >
                <ExternalLink size={16} />
                Consulter
              </button>
            </div>
          ))}
        </div>
      </section>

      {canContribute(user) ? (
        <section className="space-y-4 border-t border-outline-variant pt-6">
          <div>
            <p className="text-label-sm uppercase text-primary">Gestion responsable</p>
            <h2 className="mt-1 text-headline-lg text-on-surface">Mettre à jour le document</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <MetadataEditor
              document={document}
              onUpdated={async (updatedDocument) => {
                if (updatedDocument) {
                  setDocument(updatedDocument);
                  await prepareUrls(updatedDocument);
                }
                showToast('Métadonnées mises à jour.', 'success');
              }}
            />
            <VersionUploader
              document={document}
              onUploaded={async () => {
                await loadDocument();
                showToast('Nouvelle version publiée.', 'success');
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
    >
      <ArrowLeft size={19} />
      Retour aux documents
    </button>
  );
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <p className="text-label-sm text-on-surface-variant">{label}</p>
        <p className="mt-1 text-body-md font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function MetadataEditor({
  document,
  onUpdated,
}: {
  document: Resource;
  onUpdated: (document: Resource | null) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState<ResourceCategory>(document.category);
  const [authorName, setAuthorName] = useState(document.authorName);
  const [tags, setTags] = useState(document.tags.join(', '));
  const [effectiveAt, setEffectiveAt] = useState(toDateInput(document.effectiveAt));
  const [expiresAt, setExpiresAt] = useState(toDateInput(document.expiresAt));
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const updatedDocument = await updateDocumentMetadata(document.id, {
        title,
        category,
        authorName,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        effectiveAt: effectiveAt ? new Date(`${effectiveAt}T12:00:00`) : null,
        expiresAt: expiresAt ? new Date(`${expiresAt}T12:00:00`) : null,
      });
      await onUpdated(updatedDocument);
    } catch (metadataError) {
      showToast(
        metadataError instanceof Error
          ? metadataError.message
          : 'Impossible de mettre à jour les métadonnées.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-outline-variant p-4">
      <div className="flex items-center gap-2">
        <Pencil size={18} className="text-primary" />
        <h3 className="text-headline-md text-on-surface">Métadonnées</h3>
      </div>
      <div className="mt-4 space-y-3">
        <FormInput label="Titre" value={title} onChange={setTitle} required />
        <label className="block">
          <span className="text-label-lg text-on-surface">Catégorie</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ResourceCategory)}
            className="mt-1 min-h-11 w-full rounded-lg bg-surface-container-highest px-3 text-on-surface"
          >
            {Object.entries(RESOURCE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <FormInput label="Auteur" value={authorName} onChange={setAuthorName} />
        <FormInput label="Tags" value={tags} onChange={setTags} />
        <div className="grid grid-cols-2 gap-3">
          <FormInput label="Date d’effet" type="date" value={effectiveAt} onChange={setEffectiveAt} />
          <FormInput label="Expiration" type="date" value={expiresAt} onChange={setExpiresAt} min={effectiveAt} />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="mt-4 min-h-11 w-full rounded-lg bg-surface-container-high px-4 font-semibold text-on-surface disabled:opacity-50"
      >
        {busy ? 'Enregistrement...' : 'Enregistrer les métadonnées'}
      </button>
    </form>
  );
}

function VersionUploader({
  document,
  onUploaded,
}: {
  document: Resource;
  onUploaded: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [authorName, setAuthorName] = useState(document.authorName);
  const [effectiveAt, setEffectiveAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    setBusy(true);
    try {
      await replaceDocumentVersion({
        resource: document,
        file,
        versionLabel,
        authorName,
        effectiveAt: effectiveAt ? new Date(`${effectiveAt}T12:00:00`) : null,
        expiresAt: expiresAt ? new Date(`${expiresAt}T12:00:00`) : null,
      });
      setFile(null);
      setVersionLabel('');
      await onUploaded();
    } catch (versionError) {
      showToast(
        versionError instanceof Error
          ? versionError.message
          : 'Impossible de publier cette version.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-outline-variant p-4">
      <div className="flex items-center gap-2">
        <UploadCloud size={18} className="text-primary" />
        <h3 className="text-headline-md text-on-surface">Nouvelle version</h3>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-label-lg text-on-surface">Fichier</span>
          <input
            type="file"
            accept=".pdf,.odt,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-lg bg-surface-container-highest px-3 py-3 text-on-surface"
            required
          />
        </label>
        <FormInput label="Version" value={versionLabel} onChange={setVersionLabel} required />
        <FormInput label="Auteur" value={authorName} onChange={setAuthorName} />
        <div className="grid grid-cols-2 gap-3">
          <FormInput label="Date d’effet" type="date" value={effectiveAt} onChange={setEffectiveAt} />
          <FormInput label="Expiration" type="date" value={expiresAt} onChange={setExpiresAt} min={effectiveAt} />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy || !file || !versionLabel.trim()}
        className="mt-4 min-h-11 w-full rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Publication...' : 'Publier la nouvelle version'}
      </button>
    </form>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="text-label-lg text-on-surface">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg bg-surface-container-highest px-3 text-on-surface"
        required={required}
      />
    </label>
  );
}

function toDateInput(date: Date | null | undefined) {
  return date ? format(date, 'yyyy-MM-dd') : '';
}
