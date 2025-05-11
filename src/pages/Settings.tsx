import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold ml-2 dark:text-white">Paramètres</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Apparence</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isDarkMode ? (
                <Moon className="text-gray-600 dark:text-gray-300" size={20} />
              ) : (
                <Sun className="text-gray-600 dark:text-gray-300" size={20} />
              )}
              <span className="text-gray-700 dark:text-gray-200">Mode sombre</span>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDarkMode ? 'bg-[#FF4500]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Compte</h2>
          
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-2">
                <img
                  src={user.photoURL || ''}
                  alt={user.displayName || 'Profile'}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <button
                  className="w-full flex items-center px-4 py-2 text-sm text-white bg-[#FF4500] hover:bg-[#FF4500]/90 rounded-lg transition-colors justify-center"
                  onClick={async () => { if (window.confirm('Voulez-vous vous déconnecter ?')) await logout(); }}
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Connectez-vous pour gérer votre compte
            </p>
          )}
        </div>
      </div>
      
      <button
        onClick={() => navigate('/')}
        className="w-full bg-white dark:bg-gray-800 text-[#FF4500] py-4 rounded-lg mt-6 mb-4 flex items-center justify-center font-semibold border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white dark:hover:bg-[#FF4500] transition-colors shadow-lg"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}