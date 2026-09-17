import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type Factor = { id: string; friendly_name?: string; status: 'verified' | 'unverified' };
type GateState = { token: string; status: 'allowed' | 'challenge' | 'error'; factors: Factor[] };

/** UI convenience only: SQL and the admin API independently enforce TOTP. */
export default function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const token = session?.access_token ?? '';
  const [state, setState] = useState<GateState | null>(null);
  const [retry, setRetry] = useState(0);
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    const check = async () => {
      try {
        if (!token) throw new Error('Session absente');
        const { data: allowed, error: checkError } = await supabase.rpc('has_admin_mfa');
        if (checkError) throw checkError;
        if (allowed === true) {
          if (active) {
            setEnrollment(null);
            setCode('');
            setState({ token, status: 'allowed', factors: [] });
          }
          return;
        }
        const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        if (active) {
          const verifiedFactors = data.totp.filter((factor) => factor.status === 'verified');
          setFactorId(verifiedFactors[0]?.id ?? '');
          setEnrollment(null);
          setState({ token, status: 'challenge', factors: verifiedFactors });
        }
      } catch {
        if (active) setState({ token, status: 'error', factors: [] });
      }
    };
    void check();
    return () => { active = false; };
  }, [token, retry]);

  const enroll = async () => {
    setBusy(true);
    setError('');
    try {
      // Discard only incomplete setups; never remove a verified authenticator.
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified')) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp', friendlyName: 'Flashover78', issuer: 'Flashover78',
      });
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setEnrollment({ qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError('La configuration a échoué. Réessayez ou contactez le responsable de la plateforme.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || !factorId || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      setCode('');
      setEnrollment(null);
      // TOKEN_REFRESHED/MFA_CHALLENGE_VERIFIED updates the context. Never grant
      // access here: the effect must validate the new session against SQL.
      setState(null);
      setRetry((value) => value + 1);
    } catch {
      setCode('');
      setError('Code refusé ou expiré. Vérifiez l’heure de votre appareil et réessayez avec un nouveau code.');
    } finally {
      setBusy(false);
    }
  };

  if (!state || state.token !== token) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  }
  if (state.status === 'allowed') return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <section className="surface-card w-full max-w-lg space-y-5 p-6" aria-labelledby="mfa-title">
        <ShieldCheck size={32} className="text-primary" aria-hidden="true" />
        <h1 id="mfa-title" className="text-headline-md">Sécuriser votre accès administrateur</h1>
        <p>Un code de votre application d’authentification est obligatoire pour accéder à ce compte administrateur.</p>
        <p className="text-sm text-on-surface-variant">Les événements d’authentification et les adresses IP disponibles sont journalisés par le serveur.</p>
        {state.status === 'error' ? (
          <>
            <p role="alert">Impossible de vérifier la sécurité de cette session. L’accès reste verrouillé.</p>
            <button type="button" className="btn-primary-gradient min-h-11 rounded-xl px-4 py-3 disabled:opacity-50" onClick={() => { setState(null); setRetry((value) => value + 1); }}>Réessayer</button>
          </>
        ) : (
          <>
            {state.factors.length === 0 && !enrollment && (
              <button type="button" className="btn-primary-gradient min-h-11 rounded-xl px-4 py-3 disabled:opacity-50" disabled={busy} onClick={() => void enroll()}>
                {busy ? 'Configuration…' : 'Configurer mon application TOTP'}
              </button>
            )}
            {enrollment && (
              <div className="space-y-3">
                <p>Scannez ce QR code dans votre application d’authentification, puis saisissez le code à 6 chiffres.</p>
                <img className="mx-auto h-56 w-56 bg-white p-2" src={enrollment.qr} alt="QR code de configuration TOTP" />
                <details><summary className="cursor-pointer">Saisir la clé manuellement</summary><code className="block break-all p-2">{enrollment.secret}</code></details>
              </div>
            )}
            {factorId && (
              <form onSubmit={verify} className="space-y-4">
                {state.factors.length > 1 && (
                  <label className="block">Application d’authentification
                    <select className="min-h-12 rounded-xl bg-surface-container-low px-4 py-3 text-on-surface outline-none ring-primary focus:ring-2 mt-1" value={factorId} onChange={(event) => setFactorId(event.target.value)}>
                      {state.factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Application ${index + 1}`}</option>)}
                    </select>
                  </label>
                )}
                <label className="block" htmlFor="totp-code">Code à 6 chiffres</label>
                <input id="totp-code" className="min-h-12 rounded-xl bg-surface-container-low px-4 py-3 text-on-surface outline-none ring-primary focus:ring-2 w-full" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                <button className="btn-primary-gradient min-h-11 rounded-xl px-4 py-3 disabled:opacity-50 w-full" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Vérifier et continuer'}</button>
              </form>
            )}
          </>
        )}
        {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
        <p className="text-sm text-on-surface-variant">Application perdue ? Contactez le responsable de la plateforme pour une récupération après vérification de votre identité.</p>
        <button type="button" className="min-h-11 rounded-xl bg-surface-container px-4 py-3 font-semibold text-on-surface disabled:opacity-50" disabled={busy} onClick={() => void logout()}>Se déconnecter</button>
      </section>
    </main>
  );
}
