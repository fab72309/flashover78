import { LOGO_PATHS } from '../utils/constants';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <img
        src={LOGO_PATHS.default}
        alt="Chargement..."
        className="w-16 h-16 animate-pulse"
      />
      <div className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</div>
    </div>
  );
}