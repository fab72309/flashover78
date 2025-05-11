import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useCollection<T>(collectionName: string) {
  const [documents, setDocuments] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const results: T[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            // Convert Firestore Timestamp to Date
            if (data.createdAt && data.createdAt instanceof Timestamp) {
              data.createdAt = data.createdAt.toDate();
            }
            if (data.date && data.date instanceof Timestamp) {
              data.date = data.date.toDate();
            }
            results.push({ id: doc.id, ...data } as T);
          });
          setDocuments(results);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching collection:', error);
          setError(error.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up Firebase listener:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [collectionName]);

  return { documents, loading, error };
}