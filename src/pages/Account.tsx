import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, Shield } from 'lucide-react';

import { EmailUpdateForm, PasswordUpdateForm } from './AccountForms';

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logout();
      // Redirection vers la page de connexion après déconnexion
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      alert('Une erreur est survenue lors de la déconnexion. Veuillez réessayer.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Mon Compte</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Informations personnelles</h2>
        
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Photo de profil" className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500] text-2xl font-bold">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-lg">{user?.displayName || 'Utilisateur'}</h3>
              <p className="text-gray-500 text-sm">{user?.email}</p>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User size={18} className="text-blue-500" />
                <h3 className="font-medium">Nom d'utilisateur</h3>
              </div>
              <p className="text-gray-700">{user?.displayName || 'Non défini'}</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail size={18} className="text-blue-500" />
                <h3 className="font-medium">Email</h3>
              </div>
              <p className="text-gray-700">{user?.email}</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={18} className="text-blue-500" />
                <h3 className="font-medium">Méthode de connexion</h3>
              </div>
              <p className="text-gray-700">
                {user?.providerData[0]?.providerId === 'google.com' 
                  ? 'Google' 
                  : 'Email/Mot de passe'}
              </p>
            </div>
          </div>
          
          {/* Formulaire de modification de l'email */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-medium mb-4">Modifier l'email</h3>
            <EmailUpdateForm />
          </div>

          {/* Formulaire de modification du mot de passe */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-medium mb-4">Modifier le mot de passe</h3>
            <PasswordUpdateForm />
          </div>

          <div className="pt-6 mt-6 border-t">
            <h3 className="font-medium mb-4">Actions du compte</h3>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <LogOut size={18} />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
