import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  teacherId?: string;
  teacherName?: string;
  loginTeacher: (name: string, id: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: null, 
  loading: true,
  loginTeacher: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string>();
  const [teacherName, setTeacherName] = useState<string>();

  const checkStaffSession = async () => {
    const session = localStorage.getItem('school_staff_session');
    if (session) {
      const { type, name, id } = JSON.parse(session);
      if (type === 'TEACHER') {
        const q = query(collection(db, 'teachers'), where('name', '==', name), where('teacherId', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRole('TEACHER');
          setTeacherId(id);
          setTeacherName(name);
          setLoading(false);
          return true;
        }
      }
    }
    return false;
  };

  const loginTeacher = async (name: string, id: string) => {
    const q = query(collection(db, 'teachers'), where('name', '==', name), where('teacherId', '==', id));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Teacher record not found. Please check your Name and ID.');
    
    setRole('TEACHER');
    setTeacherId(id);
    setTeacherName(name);
    localStorage.setItem('school_staff_session', JSON.stringify({ type: 'TEACHER', name, id }));
  };

  const performLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('school_staff_session');
    setRole(null);
    setTeacherId(undefined);
    setTeacherName(undefined);
    setUser(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        // Only Admin uses Firebase Auth in this setup
        setRole('ADMIN');
        setLoading(false);
      } else {
        const hasSession = await checkStaffSession();
        if (!hasSession) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, teacherId, teacherName, loginTeacher, logout: performLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
