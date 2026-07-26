/**
 * Hook personnalisé pour récupérer la version de l'application
 * @returns La version de l'application (ex: "v1.0.0" ou "dev" en local)
 */
export const useAppVersion = (): string => {
  const version = import.meta.env.VITE_APP_VERSION;

  if (!version) {
    return 'dev';
  }

  return version.startsWith('v') ? version : `v${version}`;
};

export default useAppVersion;
