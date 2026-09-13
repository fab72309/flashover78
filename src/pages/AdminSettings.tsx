import {
  ArrowRight,
  Mail,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageIntro from '../components/PageIntro';
import { APP_ROUTES } from '../utils/constants';

const adminShortcuts = [
  {
    to: APP_ROUTES.ADMIN_USERS,
    title: 'Utilisateurs',
    description: 'Invitez des personnes et ajustez leurs rôles et fonctions formateur.',
    action: 'Gérer les utilisateurs',
    icon: UsersRound,
  },
  {
    to: APP_ROUTES.ADMIN_EMAIL_DESTINATIONS,
    title: 'Destinataires des formulaires',
    description: 'Choisissez les adresses utilisées pour les envois de la main courante et du suivi médical.',
    action: 'Gérer les destinataires',
    icon: Mail,
  },
  {
    to: APP_ROUTES.ADMIN_REGISTERED_ACCOUNTS,
    title: 'Comptes enregistrés',
    description: 'Consultez les comptes connus par Supabase Auth et supprimez un compte avec confirmation.',
    action: 'Gérer les comptes',
    icon: UserRoundCheck,
  },
] as const;

export default function AdminSettings() {
  return (
    <div className="space-y-6 fade-in">
      <PageIntro
        eyebrow={(
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-label-sm font-semibold text-primary">
            <ShieldCheck size={15} aria-hidden="true" />
            Accès administrateur
          </span>
        )}
        title="Paramètres administrateurs"
        subtitle="Retrouvez chaque fonction de gestion dans une page dédiée, réservée aux administrateurs."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Fonctions administrateur">
        {adminShortcuts.map(({ to, title, description, action, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group surface-card flex min-h-48 flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-ambient-lg"
          >
            <div>
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={23} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-headline-md text-on-surface">{title}</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">{description}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-2 text-label-lg font-semibold text-primary">
              {action}
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
