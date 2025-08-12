/**
 * Hook personnalisé pour récupérer la version de l'application
 * @returns La version de l'application (ex: "v1.0.0" ou "dev" en local)
 */
export const useAppVersion = (): string => {
  // VITE_APP_VERSION est injecté au build via GitHub Actions
  return (import.meta as any).env?.VITE_APP_VERSION || 'dev';
};

export default useAppVersion;
