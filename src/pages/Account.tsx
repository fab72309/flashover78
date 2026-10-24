import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, Shield } from 'lucide-react';
import { EmailUpdateForm, PasswordUpdateForm } from './AccountForms';
import { APP_ROUTES } from '../utils/constants';
import PageIntro from '../components/PageIntro';
import { useToast } from '../contexts/ToastContext';
import TrainingHistoryPanel from '../components/TrainingHistoryPanel';
import MedicalFollowUpHistoryPanel from '../components/MedicalFollowUpHistoryPanel';
import MainCouranteHistoryPanel from '../components/MainCouranteHistoryPanel';
import EquipmentRepairHistoryPanel from '../components/EquipmentRepairHistoryPanel';
import { logClientFailure } from '../utils/clientDiagnostics';

export default function Account() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate(APP_ROUTES.LOGIN);
    } catch {
      logClientFailure('Déconnexion impossible');
      showToast('Une erreur est survenue lors de la déconnexion. Veuillez réessayer.', 'error');
    }
  };

  return (
    <div className="container mx-auto py-4 fade-in">
      <PageIntro
        title="Mon compte"
        subtitle="Retrouvez vos informations personnelles, vos paramètres de connexion et les actions de sécurité."
      />

      <div className="surface-card p-5 mb-6 mt-6">
        <h2 className="text-headline-md text-on-surface mb-4">Informations personnelles</h2>

        <div className="space-y-5">
          {/* Avatar section */}
          <div className="flex items-center gap-4 p-4 bg-surface-container rounded-squircle">
            <div className="flex-shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Photo de profil" className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg text-on-surface">{user?.displayName || 'Utilisateur'}</h3>
              <p className="text-body-md text-on-surface-variant">{user?.email}</p>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-4 bg-surface-container rounded-squircle-sm">
              <div className="flex items-center gap-2 mb-2">
                <User size={18} className="text-primary" />
                <h3 className="font-medium text-on-surface">Nom d'utilisateur</h3>
              </div>
              <p className="text-body-md text-on-surface-variant">{user?.displayName || 'Non défini'}</p>
            </div>

            <div className="p-4 bg-surface-container rounded-squircle-sm">
              <div className="flex items-center gap-2 mb-2">
                <Mail size={18} className="text-primary" />
                <h3 className="font-medium text-on-surface">Email</h3>
              </div>
              <p className="text-body-md text-on-surface-variant">{user?.email}</p>
            </div>

            <div className="p-4 bg-surface-container rounded-squircle-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={18} className="text-primary" />
                <h3 className="font-medium text-on-surface">Méthode de connexion</h3>
              </div>
              <p className="text-body-md text-on-surface-variant">
                {user?.provider === 'google' ? 'Google' : 'Email/Mot de passe'}
              </p>
            </div>
          </div>

          {/* Email form */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
            <h3 className="font-semibold text-on-surface mb-4">Modifier l'email</h3>
            <EmailUpdateForm />
          </div>

          {/* Password form */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
            <h3 className="font-semibold text-on-surface mb-4">Modifier le mot de passe</h3>
            <PasswordUpdateForm />
          </div>

          {/* Logout */}
          <div className="pt-5 mt-5" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
            <h3 className="font-semibold text-on-surface mb-4">Actions du compte</h3>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-squircle-sm hover:bg-red-600 transition-colors"
            >
              <LogOut size={18} />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>

      {user ? <TrainingHistoryPanel userId={user.id} /> : null}
      {user ? <MedicalFollowUpHistoryPanel userId={user.id} /> : null}
      {user ? <MainCouranteHistoryPanel userId={user.id} /> : null}
      {user ? <EquipmentRepairHistoryPanel userId={user.id} /> : null}

    </div>
  );
}
