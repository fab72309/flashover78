import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Download,
  CloudOff,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  cacheDocumentForOffline,
  removeDocumentFromOffline,
  searchDocuments,
  toggleDocumentFavorite,
} from '../services/supabaseService';
import type {
  DocumentExpirationState,
  Resource,
  ResourceCategory,
} from '../types';
import {
  APP_ROUTES,
  RESOURCE_CATEGORY_LABELS,
} from '../utils/constants';
import { getUserFacingError } from '../utils/userFacingError';
import { logClientFailure } from '../utils/clientDiagnostics';
import {
  formatFileSize,
  getDocumentExpirationLabel,
  getDocumentExpirationState,
  getResourceCategoryLabel,
} from '../utils/documents';
import { canContribute } from '../utils/permissions';

const categoryOptions = Object.entries(RESOURCE_CATEGORY_LABELS) as Array<
  [ResourceCategory, string]
>;

export default function Resources() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<Resource[]>([]);
  const [catalog, setCatalog] = useState<Resource[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [tag, setTag] = useState('');
  const [expirationState, setExpirationState] =
    useState<DocumentExpirationState>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineBusy, setOfflineBusy] = useState<string | null>(null);
  const [referenceDate] = useState(() => new Date());

  const loadCatalog = useCallback(async () => {
    try {
      const allDocuments = await searchDocuments();
      setCatalog(allDocuments);
    } catch {
      logClientFailure('Chargement du catalogue documentaire impossible');
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchDocuments({
        query,
        category: category || undefined,
        tag: tag || undefined,
        favoritesOnly,
        expirationState,
      });
      setDocuments(results);
    } catch (loadError) {
      logClientFailure('Chargement des documents impossible');
      setError(getUserFacingError(loadError, 'Impossible de charger les documents.'));
    } finally {
      setLoading(false);
    }
  }, [category, expirationState, favoritesOnly, query, tag]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const timer = window.setTimeout(loadDocuments, 250);
    return () => window.clearTimeout(timer);
  }, [loadDocuments]);

  const availableTags = useMemo(
    () =>
      Array.from(new Set(catalog.flatMap((document) => document.tags))).sort(
        (first, second) => first.localeCompare(second, 'fr')
      ),
    [catalog]
  );

  const expiringCount = catalog.filter(
    (document) =>
      getDocumentExpirationState(document.expiresAt, referenceDate) === 'expiring'
  ).length;
  const expiredCount = catalog.filter(
    (document) =>
      getDocumentExpirationState(document.expiresAt, referenceDate) === 'expired'
  ).length;
  const offlineCount = catalog.filter(
    (document) => document.isOfflineSelected
  ).length;

  const updateDocumentState = (
    id: string,
    update: (document: Resource) => Resource
  ) => {
    setDocuments((current) =>
      current.map((document) => (document.id === id ? update(document) : document))
    );
    setCatalog((current) =>
      current.map((document) => (document.id === id ? update(document) : document))
    );
  };

  const handleFavorite = async (document: Resource) => {
    try {
      const isFavorite = await toggleDocumentFavorite(document.id);
      updateDocumentState(document.id, (candidate) => ({
        ...candidate,
        isFavorite,
      }));
    } catch (favoriteError) {
      showToast(
        getUserFacingError(favoriteError, 'Impossible de modifier le favori.'),
        'error'
      );
    }
  };

  const handleOffline = async (document: Resource) => {
    setOfflineBusy(document.id);
    try {
      if (document.isOfflineSelected) {
        await removeDocumentFromOffline(document);
        updateDocumentState(document.id, (candidate) => ({
          ...candidate,
          isOfflineSelected: false,
        }));
        showToast('Document retiré du stockage hors ligne.', 'success');
      } else {
        await cacheDocumentForOffline(document);
        updateDocumentState(document.id, (candidate) => ({
          ...candidate,
          isOfflineSelected: true,
        }));
        showToast('Document disponible hors ligne.', 'success');
      }
    } catch (offlineError) {
      showToast(
        getUserFacingError(offlineError, 'Impossible de modifier la disponibilité hors ligne.'),
        'error'
      );
    } finally {
      setOfflineBusy(null);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('');
    setTag('');
    setExpirationState('all');
    setFavoritesOnly(false);
  };

  return (
    <div className="space-y-6 fade-in">
      <PageIntro
        title="Documents"
        subtitle="Référentiels, supports de formation et ressources opérationnelles à jour."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="État documentaire">
        <CatalogMetric icon={<BookOpen size={19} />} value={catalog.length} label="Documents" />
        <CatalogMetric icon={<CalendarClock size={19} />} value={expiringCount} label="À échéance" />
        <CatalogMetric icon={<AlertTriangle size={19} />} value={expiredCount} label="Expirés" tone="danger" />
        <CatalogMetric icon={<Download size={19} />} value={offlineCount} label="Hors ligne" />
      </section>

      <section className="surface-card p-4 lg:p-5" aria-label="Filtres documentaires">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(14rem,1fr)_12rem_11rem_11rem_auto]">
          <label className="relative block md:col-span-2 2xl:col-span-1">
            <span className="sr-only">Rechercher</span>
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titre, auteur, tag ou fichier"
              className="min-h-12 w-full rounded-lg bg-surface-container-highest pl-11 pr-4 text-on-surface"
            />
          </label>

          <label>
            <span className="sr-only">Catégorie</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ResourceCategory | '')
              }
              className="min-h-12 w-full rounded-lg bg-surface-container-highest px-3 text-on-surface"
            >
              <option value="">Toutes les catégories</option>
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Tag</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="min-h-12 w-full rounded-lg bg-surface-container-highest px-3 text-on-surface"
            >
              <option value="">Tous les tags</option>
              {availableTags.map((availableTag) => (
                <option key={availableTag} value={availableTag}>{availableTag}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Échéance</span>
            <select
              value={expirationState}
              onChange={(event) =>
                setExpirationState(event.target.value as DocumentExpirationState)
              }
              className="min-h-12 w-full rounded-lg bg-surface-container-highest px-3 text-on-surface"
            >
              <option value="all">Toutes les échéances</option>
              <option value="valid">À jour</option>
              <option value="expiring">Expire bientôt</option>
              <option value="expired">Expiré</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            aria-pressed={favoritesOnly}
            className={[
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-semibold',
              favoritesOnly
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-on-surface',
            ].join(' ')}
          >
            <Star size={18} fill={favoritesOnly ? 'currentColor' : 'none'} />
            Favoris
          </button>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-headline-md text-on-surface">Catalogue</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {loading
              ? 'Actualisation...'
              : `${documents.length} document${documents.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container text-on-surface"
          aria-label="Actualiser les documents"
          title="Actualiser"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loading ? (
        <DocumentSkeletons />
      ) : error ? (
        <section className="surface-card p-5" role="alert">
          <p className="font-semibold text-red-700">Catalogue indisponible</p>
          <p className="mt-2 text-body-md text-on-surface-variant">{error}</p>
          <button type="button" onClick={loadDocuments} className="mt-4 font-semibold text-primary">
            Réessayer
          </button>
        </section>
      ) : documents.length === 0 ? (
        <section className="rounded-lg border border-dashed border-outline p-7 text-center">
          <Filter className="mx-auto text-on-surface-variant" size={25} />
          <h2 className="mt-3 text-headline-md text-on-surface">Aucun document trouvé</h2>
          <button type="button" onClick={resetFilters} className="mt-3 font-semibold text-primary">
            Réinitialiser les filtres
          </button>
        </section>
      ) : (
        <section className="grid gap-3 xl:grid-cols-2" aria-label="Documents">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              referenceDate={referenceDate}
              offlineBusy={offlineBusy === document.id}
              onOpen={() =>
                navigate(`${APP_ROUTES.RESOURCE_DETAIL}/${document.id}`)
              }
              onFavorite={() => handleFavorite(document)}
              onOffline={() => handleOffline(document)}
            />
          ))}
        </section>
      )}

      {canContribute(user) ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.RESOURCE_ADD)}
            className="w-14 h-14 btn-primary-gradient rounded-full flex items-center justify-center shadow-ambient-lg"
            aria-label="Ajouter un document"
            title="Ajouter un document"
          >
            <Plus size={24} className="text-white" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CatalogMetric({
  icon,
  value,
  label,
  tone = 'default',
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="surface-card min-h-24 p-4">
      <div className={tone === 'danger' ? 'text-red-700' : 'text-primary'}>{icon}</div>
      <div className="mt-3 text-2xl font-bold text-on-surface">{value}</div>
      <div className="mt-1 text-label-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

function DocumentCard({
  document,
  referenceDate,
  offlineBusy,
  onOpen,
  onFavorite,
  onOffline,
}: {
  document: Resource;
  referenceDate: Date;
  offlineBusy: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onOffline: () => void;
}) {
  const expirationState = getDocumentExpirationState(
    document.expiresAt,
    referenceDate
  );
  const expirationTone = expirationState === 'expired'
    ? 'bg-red-100 text-red-800'
    : expirationState === 'expiring'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-800';

  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-sm font-semibold text-primary">
              {getResourceCategoryLabel(document.category)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-label-sm ${expirationTone}`}>
              {getDocumentExpirationLabel(expirationState)}
            </span>
          </div>
          <h3 className="mt-2 text-headline-md text-on-surface">{document.title}</h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Version {document.versionLabel}
            {document.authorName ? ` · ${document.authorName}` : ''}
            {` · ${formatFileSize(document.fileSize)}`}
          </p>
          {document.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {document.tags.slice(0, 4).map((documentTag) => (
                <span
                  key={documentTag}
                  className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant"
                >
                  {documentTag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onFavorite}
            className={[
              'flex h-10 w-10 items-center justify-center rounded-full',
              document.isFavorite
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container',
            ].join(' ')}
            aria-label={document.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={document.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star size={18} fill={document.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={onOffline}
            disabled={offlineBusy}
            className={[
              'flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-50',
              document.isOfflineSelected
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container',
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
            {document.isOfflineSelected ? <CloudOff size={18} /> : <Download size={18} />}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-on-surface px-4 font-semibold text-white"
        >
          Ouvrir
          <ChevronRight size={17} />
        </button>
      </div>
    </article>
  );
}

function DocumentSkeletons() {
  return (
    <div className="grid gap-3 xl:grid-cols-2" aria-label="Chargement des documents">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-lg bg-surface-container" />
      ))}
    </div>
  );
}
