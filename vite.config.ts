import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    // DEV/PROD follow NODE_ENV, not the Vite command. Never bundle the bypass,
    // even when a deployment build inherits NODE_ENV=development.
    ...(command === 'build'
      ? { 'import.meta.env.VITE_DEV_AUTH_BYPASS': JSON.stringify('false') }
      : {}),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
