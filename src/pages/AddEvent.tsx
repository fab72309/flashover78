import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AddEventForm from '../components/AddEventForm';
import { APP_ROUTES } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import PageIntro from '../components/PageIntro';
import { canContribute } from '../utils/permissions';

export default function AddEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!canContribute(user)) {
    return (
      <div className="surface-card p-5">
        <h1 className="text-headline-md text-on-surface">Accès restreint</h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Cette action est réservée aux contributeurs et administrateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <PageIntro
        title="Ajouter un événement"
        subtitle="Ajoutez une formation au calendrier avec sa date, son lieu et les informations utiles à la venue sur site."
      />

      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate(APP_ROUTES.CALENDAR)}
          className="p-2 hover:bg-surface-container rounded-squircle-sm transition-colors"
        >
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <h1 className="text-headline-md text-on-surface ml-2">Ajouter un événement</h1>
      </div>

      <AddEventForm
        onSuccess={() => {
          navigate(APP_ROUTES.CALENDAR);
        }}
      />

    </div>
  );
}
