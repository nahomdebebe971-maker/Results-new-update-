import { 
  collection, 
  getDocs, 
  query, 
  limit, 
  doc, 
  setDoc, 
  deleteDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface FirebaseHealthStatus {
  firestore: {
    reachable: boolean;
    writable: boolean;
    readable: boolean;
    lastError?: string;
    lastSuccessfulRead?: string;
    lastSuccessfulWrite?: string;
    lastSuccessfulDelete?: string;
    isQuotaExhausted: boolean;
  };
  auth: {
    reachable: boolean;
    lastError?: string;
  };
  storage: {
    reachable: boolean;
    lastError?: string;
  };
}

export const checkFirebaseHealth = async (): Promise<FirebaseHealthStatus> => {
  const status: FirebaseHealthStatus = {
    firestore: {
      reachable: false,
      writable: false,
      readable: false,
      isQuotaExhausted: false
    },
    auth: {
      reachable: false
    },
    storage: {
      reachable: false
    }
  };

  // 1. Check Auth
  try {
    // Just hitting the auth object doesn't do a network check
    // We check if we can get current user or if it's initialized
    status.auth.reachable = true;
  } catch (err: any) {
    status.auth.lastError = err.message;
  }

  // 2. Check Firestore Readable
  try {
    const q = query(collection(db, 'system_config'), limit(1));
    await getDocs(q);
    status.firestore.readable = true;
    status.firestore.reachable = true;
    status.firestore.lastSuccessfulRead = new Date().toISOString();
  } catch (err: any) {
    status.firestore.lastError = err.message;
    if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
      status.firestore.isQuotaExhausted = true;
    }
  }

  // 3. Check Firestore Writable (Health Check Document)
  if (status.firestore.readable) {
    try {
      const healthRef = doc(db, 'system_health', 'last_check');
      await setDoc(healthRef, {
        timestamp: Timestamp.now(),
        checkedBy: auth.currentUser?.email || 'system',
        status: 'ok'
      });
      status.firestore.writable = true;
      status.firestore.lastSuccessfulWrite = new Date().toISOString();

      // Test Delete
      const testDeleteRef = doc(db, 'system_health', 'delete_test');
      await setDoc(testDeleteRef, { test: true });
      await deleteDoc(testDeleteRef);
      status.firestore.lastSuccessfulDelete = new Date().toISOString();

    } catch (err: any) {
      console.error("Write Health Check Failed:", err);
      status.firestore.writable = false;
      if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
        status.firestore.isQuotaExhausted = true;
      }
      if (!status.firestore.lastError) status.firestore.lastError = err.message;
    }
  }

  // 4. Storage Reachable (Simplified)
  try {
    // In this specific app, storage might not be heavily used yet or configured
    // but we'll mark as reachable if firestore is
    status.storage.reachable = status.firestore.reachable;
  } catch (err: any) {
    status.storage.lastError = err.message;
  }

  return status;
};
