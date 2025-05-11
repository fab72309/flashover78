import { useState } from 'react';
import { addEvent } from '../services/firebaseService';
import type { CalendarEvent } from '../types';

interface AddEventFormProps {
  onSuccess?: () => void;
}

export default function AddEventForm({ onSuccess }: AddEventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [observations, setObservations] = useState('');
  const [formateurs, setFormateurs] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  
  // Définir la date par défaut à aujourd'hui à 08:00
  const getDefaultTime = () => {
    const now = new Date();
    const userTimezoneOffset = now.getTimezoneOffset() * 60000;
    now.setHours(8, 0, 0, 0);
    return new Date(now.getTime() - userTimezoneOffset);
  };
  
  // Format the date for the input's default value
  const formattedDefaultTime = getDefaultTime().toISOString().slice(0, 16);
  
  // Initialize date state with the formatted default time
  const [date, setDate] = useState(formattedDefaultTime);

  const formateurOptions = [
    'Formateur A',
    'Formateur B',
    'Formateur C',
    'Formateur D',
    'Formateur E',
    'Formateur F',
    'Formateur G',
  ];

  const locationOptions = [
    'Plateau technique Caissons',
    'Plateau technique MaF',
    'Salle de cours MLB',
    'Salle de cours CFD',
    'Friche batimentaire (Préciser le lieux)',
    'Autre',
  ];

  const handleFormateurChange = (index: number, value: string) => {
    const newFormateurs = [...formateurs];
    newFormateurs[index] = value;
    setFormateurs(newFormateurs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addEvent({
        title,
        description,
        location,
        observations,
        date: new Date(date),
        formateurs: formateurs.filter(f => f !== ''),
        createdAt: new Date()
      });
      setTitle('');
      setDate(getDefaultTime().toISOString().slice(0, 16)); // Reset to default time with correct timezone
      setDescription('');
      setLocation('');
      setObservations('');
      setFormateurs(['', '', '', '', '']);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Erreur lors de l\'ajout de l\'événement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          required
          placeholder="TdL-FO | Progression PSY | Feu réel | TdL | FO"
        />
      </div>
      
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date et heure</label>
        <input
          type="datetime-local"
          id="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          required
        />
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          required
          placeholder="FI SPP | FI SPV | FAE CE | FF | FMPA GPT | VIP"
        />
      </div>
      
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">Lieu de formation</label>
        <select
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
        >
          <option value="">Sélectionner un lieu</option>
          {locationOptions.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observations</label>
        <textarea
          id="observations"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          placeholder="Observations supplémentaires..."
        />
      </div>
      
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">Formateurs</label>
        <div className="grid grid-cols-2 gap-3">
          {/* First row */}
          <select
            value={formateurs[0]}
            onChange={(e) => handleFormateurChange(0, e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          >
            <option value="">Formateur 1</option>
            {formateurOptions.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
          <select
            value={formateurs[1]}
            onChange={(e) => handleFormateurChange(1, e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          >
            <option value="">Formateur 2</option>
            {formateurOptions.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
          
          {/* Second row */}
          <select
            value={formateurs[2]}
            onChange={(e) => handleFormateurChange(2, e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          >
            <option value="">Formateur 3</option>
            {formateurOptions.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
          <select
            value={formateurs[3]}
            onChange={(e) => handleFormateurChange(3, e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          >
            <option value="">Formateur 4</option>
            {formateurOptions.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
        </div>
        
        {/* Last formateur centered */}
        <div className="mt-3 flex justify-center">
          <select
            value={formateurs[4]}
            onChange={(e) => handleFormateurChange(4, e.target.value)}
            className="block w-1/2 rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50"
          >
            <option value="">Formateur 5</option>
            {formateurOptions.map((formateur) => (
              <option key={formateur} value={formateur}>{formateur}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#FF4500] text-white py-2 px-4 rounded-md hover:bg-[#FF4500]/90 disabled:opacity-50"
      >
        {loading ? 'Ajout en cours...' : 'Ajouter l\'événement'}
      </button>
    </form>
  );
}