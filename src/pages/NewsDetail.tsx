import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NewsPost } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function NewsDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) {
        setError("ID de l'article non fourni");
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching post with ID:', id);
        const docRef = doc(db, 'news', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Convert Firestore Timestamp to Date
          let createdAt = data.createdAt;
          if (createdAt && typeof createdAt.toDate === 'function') {
            createdAt = createdAt.toDate();
          } else if (createdAt) {
            createdAt = new Date(createdAt);
          } else {
            createdAt = new Date();
          }

          setPost({
            id: docSnap.id,
            title: data.title || '',
            content: data.content || '',
            imageUrl: data.imageUrl || '',
            readBy: data.readBy || [],
            createdAt
          });
        } else {
          console.log('Post not found');
          setError("Article introuvable");
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError("Erreur lors du chargement de l'article");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  useEffect(() => {
    const markAsRead = async () => {
      if (user && id && post && (!post.readBy || !post.readBy.includes(user.uid))) {
        try {
          const newsRef = doc(db, 'news', id);
          await updateDoc(newsRef, {
            readBy: arrayUnion(user.uid)
          });
        } catch (err) {
          console.error('Error marking news as read:', err);
        }
      }
    };

    markAsRead();
  }, [user, id, post]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{error || "Article introuvable"}</p>
        <button
          onClick={() => navigate('/news')}
          className="mt-4 text-[#FF4500] hover:underline"
        >
          Retour aux news
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto -mt-6">
      <div className="sticky top-0 bg-white -mx-4 px-4 py-2 flex items-center border-b mb-4 z-10">
        <button
          onClick={() => navigate('/news')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold ml-2">Article</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {post.imageUrl && (
          <div className="relative pb-[56.25%]">
            <img
              src={post.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-4">{post.title}</h2>
          <p className="text-gray-600 whitespace-pre-wrap mb-4">{post.content}</p>
          <p className="text-sm text-gray-400">
            Publié le {format(
              post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt),
              "d MMMM yyyy 'à' HH:mm",
              { locale: fr }
            )}
          </p>
        </div>
      </div>
    </div>
  );
}