import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { getBrulageFoFiles } from '../services/firebaseService';
import LoadingSpinner from '../components/LoadingSpinner';

interface BrulageInteriorProps {
  onBack: () => void;
}

interface FileInfo {
  name: string;
  url: string;
  path: string;
}

export default function BrulageInterior({ onBack }: BrulageInteriorProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const filesList = await getBrulageFoFiles();
        setFiles(filesList);
      } catch (err) {
        setError("Erreur lors du chargement des fichiers");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold ml-2 dark:text-white">
          Brûlage Observation - Attaque de l'Intérieur
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          {error}
        </div>
      ) : (
        <div className="grid gap-4">
          {files.map((file) => (
            <a
              key={file.path}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <FileText className="w-6 h-6 text-[#FF4500] mr-3" />
              <span className="text-gray-700 dark:text-gray-200">{file.name}</span>
            </a>
          ))}
          {files.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Aucun fichier disponible
            </p>
          )}
        </div>
      )}
    </div>
  );
}