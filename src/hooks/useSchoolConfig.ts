import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SchoolConfig } from '../types';
import { DEFAULT_SCHOOL_CONFIG } from '../config/schoolConfig';

export function useSchoolConfig() {
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'config', 'school');
    
    // Initial fetch and setup if doesn't exist
    const initializeConfig = async () => {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, DEFAULT_SCHOOL_CONFIG);
        setConfig(DEFAULT_SCHOOL_CONFIG);
      }
    };

    initializeConfig();

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as SchoolConfig);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching school config:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: Partial<SchoolConfig>) => {
    const docRef = doc(db, 'config', 'school');
    await setDoc(docRef, { ...config, ...newConfig }, { merge: true });
  };

  return { config, loading, updateConfig };
}
