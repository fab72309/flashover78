import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword } from '../services/supabaseService';

export function EmailUpdateForm() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
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

      await updateUserEmail(email);
      await refreshUser();
      setSuccess('Email mis à jour. Vérifiez votre boîte mail si une confirmation est demandée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour de l'email");
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
  const [newPassword, setNewPassword] = useState('');
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

      await updateUserPassword(newPassword);
      setSuccess('Mot de passe mis à jour avec succès.');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full rounded-squircle-sm bg-surface-container-highest px-4 py-3 text-body-lg text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all';

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
      <div>
        <label className="block text-label-lg text-on-surface mb-1.5">Nouveau mot de passe</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClasses}
          required
          minLength={6}
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
