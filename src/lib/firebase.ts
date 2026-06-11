import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent cache for better resilience
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

export const loginWithEmail = (email: string, pass: string) => 
  signInWithEmailAndPassword(auth, email, pass);

export const registerAdmin = (email: string, pass: string) =>
  createUserWithEmailAndPassword(auth, email, pass);

export const logout = () => signOut(auth);

async function testConnection() {
  try {
    // Attempting to read a dummy doc from server to verify live backend connection
    await getDocFromServer(doc(db, '_system_', 'health_probe'));
  } catch (error: any) {
    // If it's a connection error, we log it and operate in offline/cached mode
    if (error?.code === 'unavailable') {
      console.warn("Firestore backend currently unreachable. Operating in Offline Persistence mode.");
    } else {
      console.error("Firestore initialization probe failed:", error?.message || error);
    }
  }
}

testConnection();
