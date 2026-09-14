import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutGrid,
  List,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import DocumentUploadPanel from './DocumentUploadPanel';
import { useAuth } from '../contexts/AuthContext';
import { searchDocuments } from '../services/supabaseService';
import type { Resource, ResourceCategory } from '../types';
import { APP_ROUTES } from '../utils/constants';
import { formatFileSize } from '../utils/documents';
import { canContribute } from '../utils/permissions';
import {
  BRULAGE_DOCUMENT_SECTIONS,
  groupBrulageDocuments,
  type BrulageDocumentSectionId,
} from '../utils/brulageDocuments';

type DocumentViewMode = 'list' | 'grid';

interface BrulageDocumentHubProps {
  category: Extract<ResourceCategory, 'BRULAGE_MAF' | 'BRULAGE_TDL_FO'>;
  title: string;
  description: string;
  uploadLabel: string;
}

const SECTION_ICONS: Record<BrulageDocumentSectionId, typeof FileText> = {
  roles: UsersRound,
  checklists: CheckSquare,
  references: BookOpen,
};

export default function BrulageDocumentHub({
  category,
  title,
  description,
  uploadLabel,
}: BrulageDocumentHubProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DocumentViewMode>('list');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const files = await searchDocuments({ category });
      setDocuments(files);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError('Erreur lors du chargement des documents.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const groupedDocuments = useMemo(
    () => groupBrulageDocuments(documents),
    [documents]
  );

  return (
    <div className="space-y-5 fade-in">
      <header className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.BRULAGE)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-body-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <ArrowLeft size={19} aria-hidden="true" />
          Retour au brûlage
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-label-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Brûlage
            </p>
            <h1 className="mt-2 text-display-sm text-on-surface">{title}</h1>
            <p className="mt-2 max-w-2xl text-body-lg text-on-surface-variant">
              {description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-surface-container px-3 py-2 text-label-sm font-semibold text-on-surface-variant">
              {documents.length} document{documents.length > 1 ? 's' : ''}
            </span>
            <div
              className="inline-flex rounded-lg bg-surface-container p-1"
              role="group"
              aria-label="Mode d’affichage des documents"
            >
              <ViewModeButton
                mode="list"
                currentMode={viewMode}
                label="Liste compacte"
                onClick={() => setViewMode('list')}
              />
              <ViewModeButton
                mode="grid"
                currentMode={viewMode}
                label="Grille"
                onClick={() => setViewMode('grid')}
              />
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center rounded-squircle bg-surface-container-low">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <section className="surface-card p-5" role="alert">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-headline-md text-on-surface">Documents indisponibles</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface"
              aria-label="Réessayer de charger les documents"
              title="Réessayer"
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-3" aria-label={`Sections documentaires ${title}`}>
          {BRULAGE_DOCUMENT_SECTIONS.map((section) => (
            <DocumentSection
              key={section.id}
              section={section}
              documents={groupedDocuments[section.id]}
              viewMode={viewMode}
              onOpen={(document) =>
                navigate(`${APP_ROUTES.RESOURCE_DETAIL}/${document.id}`)
              }
            />
          ))}
        </div>
      )}

      {canContribute(user) ? (
        <DocumentUploadPanel
          label={uploadLabel}
          defaultCategory={category}
          lockCategory
          onUploaded={loadDocuments}
        />
      ) : null}
    </div>
  );
}

function ViewModeButton({
  mode,
  currentMode,
  label,
  onClick,
}: {
  mode: DocumentViewMode;
  currentMode: DocumentViewMode;
  label: string;
  onClick: () => void;
}) {
  const Icon = mode === 'list' ? List : LayoutGrid;
  const isActive = mode === currentMode;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      className={[
        'flex h-10 items-center gap-2 rounded-md px-3 text-label-sm font-semibold transition-colors',
        isActive
          ? 'bg-surface-container-lowest text-primary shadow-ambient-sm'
          : 'text-on-surface-variant hover:text-on-surface',
      ].join(' ')}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function DocumentSection({
  section,
  documents,
  viewMode,
  onOpen,
}: {
  section: (typeof BRULAGE_DOCUMENT_SECTIONS)[number];
  documents: Resource[];
  viewMode: DocumentViewMode;
  onOpen: (document: Resource) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = SECTION_ICONS[section.id];

  return (
    <section className="overflow-hidden rounded-squircle bg-surface-container-lowest shadow-ambient-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low sm:px-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-lg font-semibold text-on-surface">{section.label}</span>
          <span className="mt-0.5 block truncate text-label-sm text-on-surface-variant">
            {section.description}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm font-semibold text-on-surface-variant">
            {documents.length}
          </span>
          <ChevronDown
            size={19}
            aria-hidden="true"
            className={`text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-outline-variant">
          {documents.length === 0 ? (
            <p className="px-5 py-5 text-body-md text-on-surface-variant">
              Aucun document dans cette section pour le moment.
            </p>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-outline-variant">
              {documents.map((document) => (
                <CompactDocumentRow
                  key={document.id}
                  document={document}
                  onOpen={() => onOpen(document)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
              {documents.map((document) => (
                <CompactDocumentCard
                  key={document.id}
                  document={document}
                  onOpen={() => onOpen(document)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function CompactDocumentRow({
  document,
  onOpen,
}: {
  document: Resource;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low sm:px-5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md font-semibold text-on-surface">
          {document.title}
        </span>
        <span className="mt-0.5 block truncate text-label-sm text-on-surface-variant">
          Version {document.versionLabel}
          {document.authorName ? ` · ${document.authorName}` : ''}
          {document.fileSize ? ` · ${formatFileSize(document.fileSize)}` : ''}
        </span>
      </span>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </button>
  );
}

function CompactDocumentCard({
  document,
  onOpen,
}: {
  document: Resource;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-32 w-full flex-col items-start rounded-lg bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText size={17} aria-hidden="true" />
      </span>
      <span className="mt-3 line-clamp-2 text-body-md font-semibold text-on-surface">
        {document.title}
      </span>
      <span className="mt-1 flex w-full items-center justify-between gap-2 text-label-sm text-on-surface-variant">
        <span className="truncate">
          Version {document.versionLabel}
          {document.authorName ? ` · ${document.authorName}` : ''}
        </span>
        <ChevronRight
          size={17}
          aria-hidden="true"
          className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </span>
    </button>
  );
}
