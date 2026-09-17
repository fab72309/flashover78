import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '../components/AdminPageHeader';
import { supabase } from '../lib/supabase';
import { isDevAuthBypassEnabled } from '../utils/devAuth';

type AuthEvent = {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  action: string;
  ip_address: string | null;
};
const actionLabels: Record<string, string> = {
  login: 'Connexion', logout: 'Déconnexion',
  factor_in_progress: 'Configuration TOTP commencée',
  factor_unenrolled: 'Facteur retiré', factor_deleted: 'Facteur supprimé',
  challenge_created: 'Vérification demandée', verification_attempted: 'Tentative de vérification',
  mfa_code_login: 'Connexion avec second facteur', token_refreshed: 'Session renouvelée',
  token_revoked: 'Session révoquée', user_updated_password: 'Mot de passe modifié',
  user_recovery_requested: 'Récupération demandée',
};

export default function AdminSecurityLog() {
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const load = useCallback(async (before?: AuthEvent) => {
    setLoading(true);
    setError('');
    try {
      if (isDevAuthBypassEnabled) {
        setEvents([]);
        setHasMore(false);
        return;
      }
      const { data, error: queryError } = await supabase.rpc('list_admin_auth_events', {
        p_before: before?.created_at ?? null,
        p_before_id: before?.id ?? null,
      });
      if (queryError) throw queryError;
      const rows = (data ?? []) as AuthEvent[];
      setEvents((previous) => before ? [...previous, ...rows] : rows);
      setHasMore(rows.length === 100);
    } catch {
      setError('Le journal est indisponible. Vérifiez votre session TOTP et la configuration serveur.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Journal de sécurité" subtitle="Événements d’authentification des administrateurs actuels, sur les 90 derniers jours." />
      <section className="surface-card space-y-4 p-5">
        <p className="text-sm text-on-surface-variant">Les IP proviennent du service d’authentification. Une IP absente est signalée comme indisponible. Ce journal ne constitue pas un historique des modifications de données.</p>
        {isDevAuthBypassEnabled && <p role="status">Mode démonstration : aucun événement réel n’est chargé.</p>}
        <button type="button" className="min-h-11 rounded-xl bg-surface-container px-4 py-3 font-semibold text-on-surface disabled:opacity-50" disabled={loading} onClick={() => void load()}>Actualiser</button>
        {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
        {!loading && !error && events.length === 0 && <p>Aucun événement disponible. Le stockage des journaux d’authentification en base doit être activé dans Supabase pour alimenter cette page.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-3">Date</th><th className="p-3">Administrateur</th><th className="p-3">Événement</th><th className="p-3">Adresse IP</th></tr></thead>
            <tbody>{events.map((event) => (
              <tr key={event.id} className="border-t border-outline-variant">
                <td className="whitespace-nowrap p-3">{new Date(event.created_at).toLocaleString('fr-FR')}</td>
                <td className="p-3">{event.actor_name || event.actor_id}</td>
                <td className="p-3">{actionLabels[event.action] || event.action}</td>
                <td className="p-3 font-mono">{event.ip_address || 'Indisponible'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {loading && <p role="status">Chargement du journal…</p>}
        {hasMore && <button type="button" className="min-h-11 rounded-xl bg-surface-container px-4 py-3 font-semibold text-on-surface disabled:opacity-50" disabled={loading} onClick={() => void load(events[events.length - 1])}>Afficher les événements précédents</button>}
      </section>
    </div>
  );
}
