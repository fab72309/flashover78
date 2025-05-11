import { ReactNode } from 'react';

interface MenuCardProps {
  title: string;
  bgColor?: string;
  textColor?: string;
  onClick?: () => void;
  logo?: string;
  className?: string;
  icon?: ReactNode;
}

export default function MenuCard({ 
  title, 
  bgColor = 'bg-[#FF4500]', 
  textColor = 'text-white', 
  onClick, 
  logo,
  className = 'py-8',
  icon
}: MenuCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full ${bgColor} rounded-lg ${className} flex items-center justify-center relative shadow-md transition-all hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#FF4500] focus:ring-opacity-50`}
    >
      {icon && <span className="absolute left-4 opacity-80">{icon}</span>}
      <h2 className={`text-xl font-bold ${textColor}`}>{title}</h2>
      {logo && (
        <img 
          src={logo} 
          alt="" 
          className="w-10 h-10 absolute right-4 rounded-full" 
        />
      )}
    </button>
  );
}