import { useState } from 'react';
import { createEvent } from '../services/supabaseService';
import { DEFAULT_FORMATEUR_OPTIONS, DEFAULT_LOCATION_OPTIONS } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';

interface AddEventFormProps {
  onSuccess?: () => void;
}

export default function AddEventForm({ onSuccess }: AddEventFormProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [observations, setObservations] = useState('');
  const [formateurs, setFormateurs] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const getDefaultTime = () => {
    const now = new Date();
    const userTimezoneOffset = now.getTimezoneOffset() * 60000;
    now.setHours(8, 0, 0, 0);
    return new Date(now.getTime() - userTimezoneOffset);
  };

  const formattedDefaultTime = getDefaultTime().toISOString().slice(0, 16);
  const [date, setDate] = useState(formattedDefaultTime);

  const handleFormateurChange = (index: number, value: string) => {
    const newFormateurs = [...formateurs];
    newFormateurs[index] = value;
    setFormateurs(newFormateurs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createEvent({
        title,
        description,
        location,
        observations,
        date: new Date(date),
        formateurs: formateurs.filter(f => f !== ''),
        capacity: 12,
        registrationClosesAt: null,
      });
      setTitle('');
      setDate(getDefaultTime().toISOString().slice(0, 16));
      setDescription('');
      setLocation('');
      setObservations('');
      setFormateurs(['', '', '', '', '']);
      showToast('Événement ajouté au calendrier.', 'success');
      onSuccess?.();
    } catch (error) {
      console.error('Error adding event:', error);
      showToast(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'événement", 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all";
  const selectClasses = "block w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 surface-card p-5">
      <div>
        <label htmlFor="title" className="block text-label-lg text-on-surface">Titre</label>
        <input
          type="text" id="title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClasses}
          required
          placeholder="TdL-FO | Progression PSY | Feu réel | TdL | FO"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-label-lg text-on-surface">Date et heure</label>
        <input
          type="datetime-local" id="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClasses}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-label-lg text-on-surface">Description</label>
        <textarea
          id="description" value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClasses}
          required
          placeholder="FI SPP | FI SPV | FAE CE | FF | FMPA GPT | VIP"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-label-lg text-on-surface">Lieu de formation</label>
        <select
          id="location" value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={selectClasses}
        >
          <option value="">Sélectionner un lieu</option>
          {DEFAULT_LOCATION_OPTIONS.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="observations" className="block text-label-lg text-on-surface">Observations</label>
        <textarea
          id="observations" value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={3}
          className={inputClasses}
          placeholder="Observations supplémentaires..."
        />
      </div>

      <div className="space-y-3">
        <label className="block text-label-lg text-on-surface mb-2">Formateurs</label>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => (
            <select
              key={i}
              value={formateurs[i]}
              onChange={(e) => handleFormateurChange(i, e.target.value)}
              className={selectClasses}
            >
              <option value="">Formateur {i + 1}</option>
              {DEFAULT_FORMATEUR_OPTIONS.map((formateur) => (
                <option key={formateur} value={formateur}>{formateur}</option>
              ))}
            </select>
          ))}
        </div>
        <div className="mt-3 flex justify-center">
          <select
            value={formateurs[4]}
            onChange={(e) => handleFormateurChange(4, e.target.value)}
            className={`${selectClasses} w-1/2`}
          >
            <option value="">Formateur 5</option>
            {DEFAULT_FORMATEUR_OPTIONS.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary-gradient py-3 rounded-squircle-sm disabled:opacity-50 text-body-lg"
      >
        {loading ? 'Ajout en cours...' : "Ajouter l'événement"}
      </button>
    </form>
  );
}
