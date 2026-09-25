import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { logClientFailure } from './utils/clientDiagnostics';

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
      void registration;
    }).catch(() => {
      logClientFailure('Enregistrement du Service Worker impossible');
    });
  });
}

const rootElement = document.getElementById('root');
const bootStatus = document.getElementById('boot-status');

function showBootError() {
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

  card.append(title, copy);
  bootStatus.replaceChildren(card);
}

async function startApp() {
  if (!rootElement) {
    console.error('Application bootstrap failed: root element missing');
    showBootError();
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
  } catch {
    logClientFailure('Initialisation de l’application impossible');
    showBootError();
  }
}

startApp();
