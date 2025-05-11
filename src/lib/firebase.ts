import { initializeApp, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: "AIzaSyDtaPNLilgxXDtymBvBocuXFMJpPzoOUxk",
  authDomain: "flashover78-32b2a.firebaseapp.com",
  projectId: "flashover78-32b2a",
  storageBucket: "flashover78-32b2a.firebasestorage.app",
  messagingSenderId: "113516891661",
  appId: "1:113516891661:web:c73a030a33c145e6d80f44",
  measurementId: "G-1LM0K600XM"
};

// Prevent multiple initializations
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialisé avec succès");
  console.log("Domaine actuel:", window.location.hostname);
} catch (error) {
  console.error("Erreur lors de l'initialisation de Firebase:", error);
  app = getApp();
}

// Initialize Firestore and Storage
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Auth with persistence
const auth = getAuth(app);
auth.useDeviceLanguage(); // Use device language for UI
setPersistence(auth, browserLocalPersistence); // Set persistence to LOCAL

export { auth };

// Conditionally initialize analytics (only in browser environment)
let analytics;
try {
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.error("Analytics couldn't be initialized:", error);
}
export { analytics };

// Export the Firebase app instance
export default app;