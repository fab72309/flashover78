import { useEffect, useState } from 'react';
import { listEvents, listResources } from '../services/supabaseService';
import { getUserFacingError } from '../utils/userFacingError';
import { logClientFailure } from '../utils/clientDiagnostics';

async function resolveCollection<T>(collectionName: string): Promise<T[]> {
  switch (collectionName) {
    case 'events':
      return (await listEvents()) as T[];
    case 'resources':
      return (await listResources()) as T[];
    default:
      throw new Error(`Collection non supportée: ${collectionName}`);
  }
}

export function useCollection<T>(collectionName: string) {
  const [documents, setDocuments] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await resolveCollection<T>(collectionName);
        if (isMounted) {
          setDocuments(results);
        }
      } catch (err) {
        logClientFailure('Chargement d’une collection impossible');
        if (isMounted) {
          setError(getUserFacingError(err, 'Impossible de charger les données.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [collectionName]);

  return { documents, loading, error };
}
