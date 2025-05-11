import { useNavigate } from 'react-router-dom';
import MenuCard from '../components/MenuCard';

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
      
      <div className="grid gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Statistiques</h2>
          <p className="text-gray-600">Fonctionnalité à venir</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Activité récente</h2>
          <p className="text-gray-600">Fonctionnalité à venir</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="w-full bg-white text-[#FF4500] py-4 rounded-lg mt-auto mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}

export default Dashboard;