import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowLeft } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { NewsPost } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';

function News() {
  const navigate = useNavigate();
  const { documents: posts, loading } = useCollection<NewsPost>('news');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSearchBar, setShowSearchBar] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen space-y-2 relative pb-20 bg-gray-50 -mx-4 px-4">
      {isMobile && showSearchBar ? (
        <div className="relative -mx-4 -mt-6 px-4 pt-4 pb-2 bg-white shadow-sm flex items-center">
          <button
            onClick={() => setShowSearchBar(false)}
            className="p-1 hover:bg-gray-100 rounded-full mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <input
            type="text"
            placeholder="Recherche"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 pl-2 bg-gray-50 rounded-lg text-sm"
            autoFocus
          />
        </div>
      ) : (
        <div className="relative -mx-4 -mt-6 px-4 pt-4 pb-2 bg-white shadow-sm">
          <input
            type="text"
            placeholder="Recherche"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 pl-9 bg-gray-50 rounded-lg text-sm"
            onFocus={() => setShowSearchBar(true)}
          />
          <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-4 max-w-4xl mx-auto"}>
          {filteredPosts.map((post) => (
            <a 
              key={post.id}
              href={`/news/${post.id}`}
              className="block w-full text-left bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer no-underline text-inherit"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/news/${post.id}`);
              }}
            >
              {post.imageUrl && (
                <div className="relative pb-[50%]">
                  <img 
                    src={post.imageUrl} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-3">
                <h3 className="text-base font-semibold">{post.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">{post.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {format(
                    post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt),
                    "d MMMM yyyy 'à' HH:mm",
                    { locale: fr }
                  )}
                </p>
              </div>
            </a>
          ))}
          {filteredPosts.length === 0 && (
            <div className="text-center py-8 text-gray-500 col-span-2">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      )}

      {/* Return to Home Button */}
      <button
        onClick={() => navigate('/')}
        className="w-full bg-white text-[#FF4500] py-4 rounded-lg mt-6 mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>

      {/* Floating Action Button */}
      <button 
        onClick={() => navigate('/news/add')}
        className="fixed right-4 bottom-20 w-14 h-14 bg-[#FF4500] rounded-full flex items-center justify-center shadow-lg hover:bg-[#FF4500]/90 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF4500]"
        aria-label="Ajouter une news"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}

export default News;