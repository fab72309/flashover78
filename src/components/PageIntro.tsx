import type { ReactNode } from 'react';

interface PageIntroProps {
  title: string;
  subtitle?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export default function PageIntro({ title, subtitle, eyebrow, actions }: PageIntroProps) {
  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
          <h1 className="text-display-sm text-on-surface">{title}</h1>
          {subtitle ? (
            <p className="text-body-lg text-on-surface-variant mt-2 max-w-3xl">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
