import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrulageInterior from './BrulageInterior';
import { useState } from 'react';

export default function BrulageMlb() {
  const navigate = useNavigate();
  const [showInterior, setShowInterior] = useState(false);

  if (showInterior) {
    return <BrulageInterior onBack={() => setShowInterior(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/brulage')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold ml-2 dark:text-white">Brûlage MLB</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => setShowInterior(true)}
          className="w-full bg-[#FF4500] text-white py-4 rounded-lg flex items-center justify-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] font-bold text-lg"
        >
          BRULAGE OBSERVATION ATTAQUE DE L'INTÉRIEUR
        </button>
        
        <button
          className="w-full bg-[#FF4500] text-white py-4 rounded-lg flex items-center justify-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] font-bold text-lg"
        >
          BRULAGE OBSERVATION ATTAQUE DE L'EXTÉRIEUR
        </button>
      </div>

      <button
        onClick={() => navigate('/brulage')}
        className="w-full bg-white dark:bg-gray-800 text-[#FF4500] py-4 rounded-lg mt-auto mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white dark:hover:bg-[#FF4500] transition-colors shadow-lg"
      >
        Retour au brûlage
      </button>
    </div>
  );
}