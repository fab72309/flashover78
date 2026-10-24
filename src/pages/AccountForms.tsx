import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword } from '../services/supabaseService';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
} from '../utils/authRecovery';
import { getUserFacingError } from '../utils/userFacingError';

export function EmailUpdateForm() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      await updateUserEmail(email, currentPassword);
      await refreshUser();
      setSuccess('Email mis à jour. Vérifiez votre boîte mail si une confirmation est demandée.');
      setCurrentPassword('');
    } catch (err) {
      setError(getUserFacingError(err, "Erreur lors de la mise à jour de l'email"));
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-lg text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all';

  return (
    <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Nouvel email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} required />
      </div>
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Mot de passe actuel</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          className={inputClasses}
          required
        />
      </div>
      <button type="submit" className="btn-primary-gradient px-5 py-2.5 rounded-squircle-sm disabled:opacity-50" disabled={loading}>
        {loading ? 'Mise à jour...' : "Mettre à jour l'email"}
      </button>
      {success && <div className="text-green-600 text-body-md mt-2">{success}</div>}
      {error && <div className="text-red-600 text-body-md mt-2">{error}</div>}
    </form>
  );
}

export function PasswordUpdateForm() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const validationError = validateNewPassword(newPassword, confirmation);
      if (validationError) {
        throw new Error(validationError);
      }

      await updateUserPassword(newPassword, currentPassword);
      setSuccess('Mot de passe mis à jour avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (err) {
      setError(getUserFacingError(err, 'Erreur lors de la mise à jour du mot de passe'));
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-lg text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all';

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Mot de passe actuel</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          className={inputClasses}
          required
        />
      </div>
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Nouveau mot de passe</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClasses}
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
        />
      </div>
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Confirmer le nouveau mot de passe</label>
        <input
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          className={inputClasses}
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
        />
      </div>
      <button type="submit" className="btn-primary-gradient px-5 py-2.5 rounded-squircle-sm disabled:opacity-50" disabled={loading}>
        {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
      </button>
      {success && <div className="text-green-600 text-body-md mt-2">{success}</div>}
      {error && <div className="text-red-600 text-body-md mt-2">{error}</div>}
    </form>
  );
}
