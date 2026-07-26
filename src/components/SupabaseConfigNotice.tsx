import { AlertTriangle, Database } from 'lucide-react';

export default function SupabaseConfigNotice() {
  return (
    <div className="min-h-screen bg-surface px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl surface-card p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-label-lg">
          <AlertTriangle size={16} />
          Configuration requise
        </div>

        <h1 className="text-display-sm text-on-surface mt-4">Supabase n’est pas configuré</h1>
        <p className="text-body-lg text-on-surface-variant mt-3">
          L’application a bien été migrée vers Supabase, mais elle ne peut pas fonctionner sans les variables d’environnement du projet.
        </p>

        <div className="mt-6 rounded-squircle bg-surface-container p-5">
          <div className="flex items-center gap-2 text-primary text-label-lg">
            <Database size={18} />
            Variables attendues
          </div>
          <pre className="mt-4 text-body-md text-on-surface overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>

        <p className="text-body-md text-on-surface-variant mt-5">
          Créez un fichier `.env` à la racine en vous basant sur `.env.example`, puis relancez le serveur Vite.
        </p>
      </div>
    </div>
  );
}
