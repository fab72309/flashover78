import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, AlertCircle, User } from 'lucide-react';
import { useAppVersion } from '../hooks/useAppVersion';
import { LOGO_PATHS } from '../utils/constants';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signInWithEmail, signUpWithEmail } = useAuth();
  const appVersion = useAppVersion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (isSignUp && (!firstName.trim() || !lastName.trim())) {
      setError('Veuillez remplir tous les champs');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, firstName, lastName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-3 py-3 bg-surface-container-highest rounded-squircle-sm text-body-lg text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all";

  return (
    <div className="w-full max-w-md mx-auto surface-card p-8">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <img
          src={LOGO_PATHS.default}
          alt="Logo"
          className="w-16 h-16 rounded-full object-contain mb-3"
        />
        <h2 className="text-headline-lg text-on-surface">
          {isSignUp ? 'Créer un compte' : 'Se connecter'}
        </h2>
        <p className="text-body-md text-on-surface-variant mt-1">Flashover 78</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-squircle-sm flex items-start gap-2 text-red-700">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <span className="text-body-md">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-label-lg text-on-surface mb-1.5">Prénom</label>
              <div className="relative">
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} required={isSignUp} />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              </div>
            </div>
            <div>
              <label className="block text-label-lg text-on-surface mb-1.5">Nom</label>
              <div className="relative">
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses} required={isSignUp} />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-label-lg text-on-surface mb-1.5">Email</label>
          <div className="relative">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} required />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          </div>
        </div>

        <div>
          <label className="block text-label-lg text-on-surface mb-1.5">Mot de passe</label>
          <div className="relative">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} required minLength={6} />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          </div>
        </div>

        {isSignUp && (
          <div>
            <label className="block text-label-lg text-on-surface mb-1.5">Confirmer le mot de passe</label>
            <div className="relative">
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClasses} required={isSignUp} minLength={6} />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary-gradient py-3 rounded-squircle-sm disabled:opacity-50 text-body-lg"
        >
          {loading ? 'Chargement...' : isSignUp ? 'Créer un compte' : 'Se connecter'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-body-md text-primary hover:underline"
        >
          {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
        </button>
      </div>

      <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
        <span className="text-label-sm text-on-surface-variant uppercase">Version {appVersion}</span>
      </div>
    </div>
  );
}
