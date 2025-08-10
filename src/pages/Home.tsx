// Page d'accueil

import { useNavigate } from 'react-router-dom';
import MenuCard from '../components/MenuCard';
import { LOGO_PATHS } from '../utils/constants';
import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

function Home() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className={`relative w-40 h-40 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl shadow-lg flex items-center justify-center`}>
          <img
            src={LOGO_PATHS.default}
            alt="Logo Sapeurs-Pompiers"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className={`text-2xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Flashover78
        </h1>
      </div>
      
      <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-3 gap-4"}>
        <MenuCard
          onClick={() => navigate('/brulage')}
          title="BRULAGE"
          bgColor="bg-[#FF4500]"
          textColor="text-white"
          className={isMobile ? "py-4" : "py-6"}
        />
        
        <MenuCard
          onClick={() => navigate('/news')}
          title="NEWS"
          bgColor="bg-[#FF4500]"
          textColor="text-white"
          className={isMobile ? "py-4" : "py-6"}
        />
        
        <MenuCard
          onClick={() => navigate('/calendar')}
          title="CALENDRIER"
          bgColor="bg-[#FF4500]"
          textColor="text-white"
          className={isMobile ? "py-4" : "py-6"}
        />
      </div>
      
      <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-3 gap-4"}>
        <MenuCard
          onClick={() => navigate('/resources')}
          title="RESSOURCES"
          bgColor="bg-[#FF4500]"
          textColor="text-white"
          className={isMobile ? "py-4" : "py-6"}
        />
        
        <MenuCard
          onClick={() => navigate('/dashboard')}
          title="TABLEAU DE BORD"
          bgColor="bg-[#FF4500]"
          textColor="text-white"
          className={isMobile ? "py-4" : "py-6"}
        />
        
        {isMobile ? null : (
          <MenuCard
            onClick={() => navigate('/settings')}
            title="PARAMÈTRES"
            bgColor="bg-gray-700"
            textColor="text-white"
            className="py-6"
          />
        )}
      </div>
      {/* Numéro de version */}
      <div className="w-full flex justify-center mt-10">
        <span className="text-xs text-gray-400 text-center">v0.1.5-alpha</span>
      </div>
    </div>
  );
}

export default Home;
