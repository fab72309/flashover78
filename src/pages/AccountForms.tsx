import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword, User } from 'firebase/auth';

// Formulaire de modification de l'email
export function EmailUpdateForm() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (!user) throw new Error('Utilisateur non authentifié');
      // Re-authentification requise par Firebase
      const cred = EmailAuthProvider.credential(
        user.email || '',
        password
      );
      await reauthenticateWithCredential(user as User, cred);
      await updateEmail(user as User, email);
      setSuccess('Email mis à jour avec succès.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour de l\'email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Nouvel email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Mot de passe actuel</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>
      <button
        type="submit"
        className="bg-[#FF4500] text-white px-4 py-2 rounded hover:bg-[#FF4500]/90"
        disabled={loading}
      >
        {loading ? 'Mise à jour...' : 'Mettre à jour l\'email'}
      </button>
      {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
    </form>
  );
}

// Formulaire de modification du mot de passe
export function PasswordUpdateForm() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
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
      if (!user) throw new Error('Utilisateur non authentifié');
      // Re-authentification requise par Firebase
      const cred = EmailAuthProvider.credential(
        user.email || '',
        currentPassword
      );
      await reauthenticateWithCredential(user as User, cred);
      await updatePassword(user as User, newPassword);
      setSuccess('Mot de passe mis à jour avec succès.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Mot de passe actuel</label>
        <input
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
          minLength={6}
        />
      </div>
      <button
        type="submit"
        className="bg-[#FF4500] text-white px-4 py-2 rounded hover:bg-[#FF4500]/90"
        disabled={loading}
      >
        {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
      </button>
      {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
    </form>
  );
}
