import { useNavigate } from 'react-router-dom';
import MenuCard from '../components/MenuCard';

function Brulage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <a
        href="https://forms.gle/UkR2NHodKJHswmAV6"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-[#FF4500] text-white py-8 rounded-lg flex items-center justify-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] font-bold text-xl"
      >
        MAIN COURANTE
      </a>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="https://forms.gle/4os4pqSkmowsZuJ58"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#FF4500] text-white py-8 rounded-lg flex items-center justify-center text-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] font-bold text-xl"
        >
          DEMANDE DE REPARATION
        </a>
        <a
          href="https://docs.google.com/forms/d/1I2Jt9WSavYKhifDfZa7-DpHyclvl1fW7NgH3AbT-Zks/prefill"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#FF4500] text-white py-8 rounded-lg flex items-center justify-center text-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] font-bold text-xl"
        >
          SUIVI MEDICAL
        </a>
      </div>
      
      <MenuCard
        title="BRULAGE MLB" 
        bgColor="bg-[#FF4500]"
        textColor="text-white"
        className="py-6"
        onClick={() => navigate('/brulage/mlb')}
      />

      <button
        onClick={() => navigate('/')}
        className="w-full bg-white text-[#FF4500] py-4 rounded-lg mt-auto mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}

export default Brulage;