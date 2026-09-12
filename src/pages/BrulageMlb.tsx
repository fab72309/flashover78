import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import DocumentUploadPanel from '../components/DocumentUploadPanel';
import { useAuth } from '../contexts/AuthContext';
import { searchDocuments } from '../services/supabaseService';
import { APP_ROUTES } from '../utils/constants';
import type { Resource } from '../types';
import { canContribute } from '../utils/permissions';

export default function BrulageMlb() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const filesList = await searchDocuments({ category: 'BRULAGE_TDL_FO' });
      setFiles(filesList);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des fichiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate(APP_ROUTES.BRULAGE)}
          className="p-2 hover:bg-surface-container rounded-squircle-sm transition-colors"
        >
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <h1 className="text-headline-md text-on-surface ml-2">Brûlage TDL / FO</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : (
        <div className="grid gap-3">
          {files.map((file) => (
            <button
              type="button"
              key={file.id}
              onClick={() => navigate(`${APP_ROUTES.RESOURCE_DETAIL}/${file.id}`)}
              className="flex w-full items-center p-4 text-left surface-card hover:shadow-ambient transition-shadow"
            >
              <FileText className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-body-lg font-semibold text-on-surface">
                  {file.title}
                </span>
                <span className="mt-1 block text-label-sm text-on-surface-variant">
                  Version {file.versionLabel}
                </span>
              </span>
              <ChevronRight size={18} className="text-on-surface-variant" />
            </button>
          ))}
          {files.length === 0 && (
            <p className="text-center text-on-surface-variant py-8">
              Aucun fichier disponible
            </p>
          )}
        </div>
      )}

      {canContribute(user) && (
        <DocumentUploadPanel
          label="un document TDL / FO"
          defaultCategory="BRULAGE_TDL_FO"
          lockCategory
          onUploaded={loadFiles}
        />
      )}

      <button
        onClick={() => navigate(APP_ROUTES.BRULAGE)}
        className="w-full bg-surface-container-lowest text-primary py-4 rounded-squircle mt-6 mb-4 flex items-center justify-center font-semibold hover:bg-surface-container transition-colors shadow-ambient-sm"
      >
        Retour au brûlage
      </button>
    </div>
  );
}
