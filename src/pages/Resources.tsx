import { useNavigate } from 'react-router-dom';
import { useCollection } from '../hooks/useFirestore';
import { Resource } from '../types';
import MenuCard from '../components/MenuCard';
import Sdis78Documents from './Sdis78Documents';
import LecturesDocuments from './LecturesDocuments';
import LoadingSpinner from '../components/LoadingSpinner';
import { useState } from 'react';

function Resources() {
  const navigate = useNavigate();
  const [showSdis78Docs, setShowSdis78Docs] = useState(false);
  const [showLecturesDocs, setShowLecturesDocs] = useState(false);
  const { documents: resources, loading } = useCollection<Resource>('resources');

  const resourcesByCategory = {
    SDIS78: resources.filter(r => r.category === 'SDIS78'),
    GDO_GTO: resources.filter(r => r.category === 'GDO_GTO'),
    LECTURES: resources.filter(r => r.category === 'LECTURES'),
  };

  if (showSdis78Docs) {
    return <Sdis78Documents onBack={() => setShowSdis78Docs(false)} />;
  }
  
  if (showLecturesDocs) {
    return <LecturesDocuments onBack={() => setShowLecturesDocs(false)} />;
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <MenuCard
            title="DOCUMENTS SDIS 78"
            bgColor="bg-[#FF4500]"
            textColor="text-white"
            onClick={() => setShowSdis78Docs(true)}
          />
          <MenuCard
            title="LECTURES"
            bgColor="bg-[#FF4500]"
            textColor="text-white"
            onClick={() => setShowLecturesDocs(true)}
          />
        </>
      )}
      
      <button
        onClick={() => navigate('/')}
        className="w-full bg-white text-[#FF4500] py-4 rounded-lg mt-auto mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}

export default Resources;