import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DocumentUploadPanel from '../components/DocumentUploadPanel';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../contexts/AuthContext';
import { APP_ROUTES } from '../utils/constants';

export default function AddResource() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return (
      <section className="surface-card p-5" role="alert">
        <h1 className="text-headline-md text-on-surface">Accès restreint</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Seuls les administrateurs peuvent ajouter des documents.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <PageIntro
        title="Ajouter un document"
        subtitle="Sélectionnez un fichier sur votre appareil, puis complétez les informations utiles au catalogue."
      />

      <button
        type="button"
        onClick={() => navigate(APP_ROUTES.RESOURCES)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-primary hover:bg-surface-container"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Retour aux documents
      </button>

      <DocumentUploadPanel
        label="un document"
        initiallyOpen
        showTrigger={false}
        onUploaded={() => navigate(APP_ROUTES.RESOURCES)}
      />
    </div>
  );
}
