import { ReactNode } from 'react';

interface MenuCardProps {
  title: string;
  subtitle?: string;
  bgColor?: string;
  textColor?: string;
  onClick?: () => void;
  logo?: string;
  className?: string;
  icon?: ReactNode;
  variant?: 'primary' | 'surface' | 'tonal';
  layout?: 'row' | 'tile';
}

export default function MenuCard({
  title,
  subtitle,
  bgColor,
  textColor,
  onClick,
  logo,
  className = '',
  icon,
  variant = 'primary',
  layout = 'row'
}: MenuCardProps) {
  const variantStyles = {
    primary: 'btn-primary-gradient text-white',
    surface: 'bg-surface-container-lowest text-on-surface shadow-ambient-sm hover:shadow-ambient',
    tonal: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  };

  const resolvedStyle = bgColor
    ? `${bgColor} ${textColor || 'text-white'}`
    : variantStyles[variant];

  const isTile = layout === 'tile';
  const buttonLayoutClass = isTile
    ? 'aspect-[0.96] min-h-[10.5rem] flex-col items-start justify-between gap-4 px-4 py-4 text-left sm:px-5 sm:py-5'
    : 'items-center px-5 py-6';
  const iconClass = isTile
    ? 'flex h-11 w-11 items-center justify-center rounded-squircle-sm bg-black/10 opacity-100'
    : 'mr-4 opacity-80';
  const titleClass = isTile
    ? 'text-base font-bold tracking-tight leading-tight'
    : 'text-lg font-bold tracking-tight';
  const subtitleClass = isTile
    ? 'mt-2 text-[0.8rem] leading-snug opacity-75'
    : 'text-sm opacity-75 mt-0.5';

  return (
    <button
      onClick={onClick}
      className={`relative flex w-full rounded-squircle transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 ${buttonLayoutClass} ${resolvedStyle} ${className}`}
    >
      {icon && (
        <span className={iconClass}>{icon}</span>
      )}
      <div className={`text-left ${isTile ? 'w-full' : 'flex-1'}`}>
        <h2 className={titleClass}>{title}</h2>
        {subtitle && (
          <p className={subtitleClass}>{subtitle}</p>
        )}
      </div>
      {logo && (
        <img
          src={logo}
          alt=""
          className="w-10 h-10 rounded-full ml-3 opacity-60"
        />
      )}
    </button>
  );
}
