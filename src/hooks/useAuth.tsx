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
        const cleanName = name.trim().toLowerCase();
        const cleanId = id.trim().toLowerCase();
        
        const teachersRef = collection(db, 'teachers');
        const snap = await getDocs(teachersRef);
        
        const teacher = snap.docs.find(doc => {
          const data = doc.data();
          return (
            data.teacherId?.toString().trim().toLowerCase() === cleanId &&
            data.name?.toString().trim().toLowerCase() === cleanName
          );
        });

        if (teacher) {
          const teacherData = teacher.data();
          setRole('TEACHER');
          setTeacherId(teacherData.teacherId);
          setTeacherName(teacherData.name);
          setLoading(false);
          return true;
        }
      }
    }
    return false;
  };

  const loginTeacher = async (name: string, id: string) => {
    const cleanName = name.trim().toLowerCase();
    const cleanId = id.trim().toLowerCase();
    
    // Search by ID first (we'll fetch all teachers then filter locally for simplicity and robustness with case)
    const teachersRef = collection(db, 'teachers');
    const snap = await getDocs(teachersRef);
    
    const teacher = snap.docs.find(doc => {
      const data = doc.data();
      return (
        data.teacherId?.toString().trim().toLowerCase() === cleanId &&
        data.name?.toString().trim().toLowerCase() === cleanName
      );
    });
    
    if (!teacher) {
      console.warn(`Teacher login failed for: "${name}" with ID: "${id}"`);
      throw new Error('Teacher record not found. Please verify your Name and ID match exactly what the Admin registered.');
    }
    
    const teacherData = teacher.data();
    setRole('TEACHER');
    setTeacherId(teacherData.teacherId);
    setTeacherName(teacherData.name);
    localStorage.setItem('school_staff_session', JSON.stringify({ 
      type: 'TEACHER', 
      name: teacherData.name, 
      id: teacherData.teacherId 
    }));
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
        // Strict Admin Email Check
        if (fbUser.email?.toLowerCase() === 'nahomdebebe971@gmail.com') {
          setUser(fbUser);
          setRole('ADMIN');
          setLoading(false);
        } else {
          // If somehow another user logged in, log them out
          await signOut(auth);
          setUser(null);
          setRole(null);
          setLoading(false);
        }
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
