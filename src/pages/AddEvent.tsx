import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AddEventForm from '../components/AddEventForm';

export default function AddEvent() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/calendar')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold ml-2">Ajouter un événement</h1>
      </div>

      <AddEventForm
        onSuccess={() => {
          navigate('/calendar');
        }}
      />
    </div>
  );
}