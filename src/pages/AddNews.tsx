import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AddNewsForm from '../components/AddNewsForm';

export default function AddNews() {
  const navigate = useNavigate();

  return (
    <div className="space-y-2 -mx-4 px-4">
      <div className="flex items-center mb-2">
        <button
          onClick={() => navigate('/news')}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold ml-1.5">Ajouter une news</h1>
      </div>

      <div className="-mx-4">
        <AddNewsForm
          onSuccess={() => {
            navigate('/news');
          }}
        />
      </div>
    </div>
  );
}