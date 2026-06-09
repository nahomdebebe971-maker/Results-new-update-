import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, loginWithEmail } from '../lib/firebase';
import { UserRole } from '../types';
import { logAction } from '../lib/auditService';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  teacherId?: string;
  teacherName?: string;
  loginTeacher: (name: string, id: string) => Promise<void>;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: null, 
  loading: true,
  loginTeacher: async () => {},
  loginAdmin: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string>();
  const [teacherName, setTeacherName] = useState<string>();

  const checkUserRole = async (uid: string, email: string | null) => {
    // 1. Check if Admin
    const adminDoc = await getDoc(doc(db, 'adminAccounts', uid));
    if (adminDoc.exists() && adminDoc.data().active) {
      setRole('ADMIN');
      return;
    }

    // Special fallback for initial setup if no admins exist
    if (email === 'nahomdebebe971@gmail.com') {
      setRole('ADMIN');
      return;
    }

    // 2. Check if Teacher (ID is uid)
    const teacherDoc = await getDoc(doc(db, 'teachers', uid));
    if (teacherDoc.exists()) {
      const data = teacherDoc.data();
      setRole('TEACHER');
      setTeacherId(data.teacherId);
      setTeacherName(data.name);
      return;
    }
    
    setRole(null);
  };

  const loginAdmin = async (email: string, pass: string) => {
    try {
      const credential = await loginWithEmail(email, pass);
      await checkUserRole(credential.user.uid, credential.user.email);
      await logAction(credential.user.uid, credential.user.email || '', 'LOGIN', 'Admin logged into portal');
    } catch (err: any) {
      console.error("Admin login error:", err);
      throw new Error('Invalid administrative credentials. Access Denied.');
    }
  };

  const loginTeacher = async (id: string, pass: string) => {
    try {
      // Map teacherId to an internal email convention or look up if teacherId was provided as email
      const email = id.includes('@') ? id : `${id.toLowerCase()}@school.internal`;
      const credential = await loginWithEmail(email, pass);
      await checkUserRole(credential.user.uid, credential.user.email);
      await logAction(credential.user.uid, credential.user.email || '', 'LOGIN', `Teacher ${id} logged into portal`);
    } catch (err: any) {
      console.error("Teacher login error:", err);
      throw new Error('Teacher authentication failed. Please verify your ID and password.');
    }
  };

  const [lastActivity, setLastActivity] = useState(Date.now());

  const performLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('school_staff_session');
    sessionStorage.clear(); // Clear all cached result data
    setRole(null);
    setTeacherId(undefined);
    setTeacherName(undefined);
    setUser(null);
  };

  useEffect(() => {
    // 30 minute session expiration logic
    const TIMEOUT = 30 * 60 * 1000;
    const interval = setInterval(() => {
      if (user && Date.now() - lastActivity > TIMEOUT) {
        performLogout();
      }
    }, 60000); // Check every minute

    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [user, lastActivity]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        await checkUserRole(fbUser.uid, fbUser.email);
        setLoading(false);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, teacherId, teacherName, loginTeacher, loginAdmin, logout: performLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
