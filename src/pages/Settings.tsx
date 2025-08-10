import { Link } from 'react-router-dom';
import { User, Bell, Shield, Moon, LogOut } from 'lucide-react';

export default function Settings() {
  const settingsCategories = [
    {
      id: 'account',
      title: 'Compte',
      description: 'Gérez vos informations personnelles et options de connexion',
      icon: <User size={24} className="text-blue-500" />,
      path: '/app/account'
    },
    {
      id: 'appearance',
      title: 'Apparence',
      description: 'Personnalisez l\'apparence de l\'application',
      icon: <Moon size={24} className="text-indigo-500" />,
      path: '/app/settings'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configurez vos préférences de notifications',
      icon: <Bell size={24} className="text-amber-500" />,
      path: '/app/settings'
    },
    {
      id: 'security',
      title: 'Sécurité',
      description: 'Gérez la sécurité de votre compte',
      icon: <Shield size={24} className="text-green-500" />,
      path: '/app/settings'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Paramètres</h1>
      <p className="text-gray-600 mb-8">Gérez vos préférences et paramètres de compte</p>
      
      <div className="grid gap-6 md:grid-cols-2">
        {settingsCategories.map((category) => (
          <Link 
            key={category.id}
            to={category.path}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow flex items-start gap-4"
          >
            <div className="p-3 rounded-full bg-gray-50">
              {category.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">{category.title}</h2>
              <p className="text-gray-600">{category.description}</p>
              {category.id === 'account' && (
                <div className="mt-3 text-sm text-[#FF4500] flex items-center gap-1">
                  <LogOut size={14} />
                  <span>Options de déconnexion disponibles</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      <div className="mt-12 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">À propos</h2>
        <p className="text-gray-600">Version de l'application: v0.1.3-alpha</p>
        <p className="text-gray-600 mt-2">© 2025 Flashover78. Tous droits réservés.</p>
      </div>
    </div>
  );
}
