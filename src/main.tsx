import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Avoid stale PWA caches during local development.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  });
}

// Register service worker for PWA support in production only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

const rootElement = document.getElementById('root');
const bootStatus = document.getElementById('boot-status');

function showBootError(message: string) {
  if (!bootStatus) {
    return;
  }

  const card = document.createElement('div');
  card.className = 'boot-card';

  const title = document.createElement('h1');
  title.className = 'boot-title';
  title.textContent = 'Erreur de démarrage';

  const copy = document.createElement('p');
  copy.className = 'boot-copy';
  copy.textContent = 'Le chargement du module principal a échoué.';

  const details = document.createElement('div');
  details.className = 'boot-error';
  details.textContent = message;

  card.append(title, copy, details);
  bootStatus.replaceChildren(card);
}

async function startApp() {
  if (!rootElement) {
    showBootError('Root element introuvable.');
    return;
  }

  try {
    const { default: App } = await import('./App.tsx');
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    if (bootStatus) {
      bootStatus.remove();
    }
  } catch (error) {
    console.error('Application bootstrap failed:', error);
    showBootError(error instanceof Error ? error.message : String(error));
  }
}

startApp();
