import { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  User,
  AuthError,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // TODO: Ajouter signInWithGoogleRedirect ici lors de la réintégration de Google Auth
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const createUserDocument = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      try {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      } catch (error) {
        console.error('Error creating user document:', error);
      }
    } else {
      // Update last login
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    }
  };

  useEffect(() => {
    // Gestion de l'état d'authentification utilisateur
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && !user.isAnonymous) {
        createUserDocument(user);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // TODO: Ajouter ici la logique Google Auth lors de la réintégration future.

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      alert('Erreur de déconnexion. Veuillez réessayer.');
    }
  };

  const signUpWithEmail = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        // Mettre à jour le profil de l'utilisateur avec son nom complet
        await updateProfile(result.user, {
          displayName: `${firstName} ${lastName}`
        });
        
        // Créer le document utilisateur avec les informations supplémentaires
        await createUserDocument(result.user);
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: `${firstName} ${lastName}`,
          firstName,
          lastName,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      }
    } catch (error) {
      const authError = error as AuthError;
      console.error('Erreur d\'inscription:', authError.code, authError.message);
      
      switch (authError.code) {
        case 'auth/email-already-in-use':
          throw new Error('Cette adresse email est déjà utilisée');
        case 'auth/invalid-email':
          throw new Error('Adresse email invalide');
        case 'auth/weak-password':
          throw new Error('Le mot de passe doit contenir au moins 6 caractères');
        case 'auth/operation-not-allowed':
          throw new Error('La création de compte est désactivée');
        case 'auth/network-request-failed':
          throw new Error('Problème de connexion réseau');
        default:
          throw new Error('Erreur lors de la création du compte');
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await createUserDocument(result.user);
      }
    } catch (error) {
      const authError = error as AuthError;
      console.error('Erreur de connexion:', authError.code, authError.message);
      
      switch (authError.code) {
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          throw new Error('Email ou mot de passe incorrect');
        case 'auth/invalid-email':
          throw new Error('Format d\'email invalide');
        case 'auth/user-disabled':
          throw new Error('Ce compte a été désactivé');
        case 'auth/too-many-requests':
          throw new Error('Trop de tentatives, veuillez réessayer plus tard');
        case 'auth/network-request-failed':
          throw new Error('Problème de connexion réseau');
        default:
          throw new Error('Erreur de connexion');
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUpWithEmail,
      signInWithEmail,
      logout 
      // TODO: Ajouter signInWithGoogleRedirect ici lors de la réintégration future
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}