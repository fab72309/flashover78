import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageIntro from './PageIntro';
import { APP_ROUTES } from '../utils/constants';

interface AdminPageHeaderProps {
  title: string;
  subtitle: string;
}

export default function AdminPageHeader({ title, subtitle }: AdminPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      <PageIntro title={title} subtitle={subtitle} />
      <button
        type="button"
        onClick={() => navigate(APP_ROUTES.ADMIN_SETTINGS)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-primary transition hover:bg-surface-container"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Paramètres administrateurs
      </button>
    </>
  );
}
