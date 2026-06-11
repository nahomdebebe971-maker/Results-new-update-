import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, loginWithEmail } from '../lib/firebase';
import { UserRole, Teacher } from '../types';
import { logAction } from '../lib/auditService';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  teacherId?: string;
  teacherName?: string;
  assignedSubjects?: string[];
  assignedClasses?: string[];
  homeroomTeacherFor?: { grade: string; section: string };
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
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [homeroomTeacherFor, setHomeroomTeacherFor] = useState<{ grade: string; section: string }>();

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

    // 2. Check if Teacher (ID is uid or matched by email)
    // First try by UID (for real auth accounts)
    const teacherDoc = await getDoc(doc(db, 'teachers', uid));
    if (teacherDoc.exists()) {
      const data = teacherDoc.data();
      setRole('TEACHER');
      setTeacherId(data.teacherId);
      setTeacherName(data.name);
      setAssignedSubjects(data.assignedSubjects || []);
      setAssignedClasses(data.assignedClasses || []);
      setHomeroomTeacherFor(data.homeroomTeacherFor);
      return;
    }
    
    // Then try by email if provided
    if (email) {
      const teacherIdFromEmail = email.split('@')[0].toUpperCase();
      const q = query(collection(db, 'teachers'), where('teacherId', '==', teacherIdFromEmail));
      const tSnap = await getDocs(q);
      if (!tSnap.empty) {
        const data = tSnap.docs[0].data();
        setRole('TEACHER');
        setTeacherId(data.teacherId);
        setTeacherName(data.name);
        setAssignedSubjects(data.assignedSubjects || []);
        setAssignedClasses(data.assignedClasses || []);
        setHomeroomTeacherFor(data.homeroomTeacherFor);
        return;
      }
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

  const loginTeacher = async (id: string, name: string) => {
    try {
      // 1. Check if Teacher exists in Firestore directly (Virtual Login)
      const cleanId = id.trim().toUpperCase();
      const cleanName = name.trim().toLowerCase();
      
      const q = query(collection(db, 'teachers'), where('teacherId', '==', cleanId));
      const tSnap = await getDocs(q);
      
      if (tSnap.empty) {
         throw new Error('Invalid Teacher ID');
      }

      const teacherDoc = tSnap.docs[0];
      const teacherData = teacherDoc.data();
      
      // 2. Validate Name (Case-insensitive)
      if (teacherData.name.trim().toLowerCase() !== cleanName) {
         throw new Error('Teacher Name Does Not Match');
      }

      // 3. Set Virtual Session
      const virtualUser = {
        uid: teacherDoc.id,
        email: `${cleanId.toLowerCase()}@school.internal`,
        displayName: teacherData.name
      } as any;

      setUser(virtualUser);
      setRole('TEACHER');
      setTeacherId(teacherData.teacherId);
      setTeacherName(teacherData.name);
      setAssignedSubjects(teacherData.assignedSubjects || []);
      setAssignedClasses(teacherData.assignedClasses || []);
      setHomeroomTeacherFor(teacherData.homeroomTeacherFor);

      // Persist in localStorage to survive refresh
      localStorage.setItem('school_staff_session', JSON.stringify({
        role: 'TEACHER',
        teacherId: teacherData.teacherId,
        teacherName: teacherData.name,
        assignedSubjects: teacherData.assignedSubjects || [],
        assignedClasses: teacherData.assignedClasses || [],
        homeroomTeacherFor: teacherData.homeroomTeacherFor || null,
        uid: teacherDoc.id,
        email: virtualUser.email,
        expires: Date.now() + 60 * 60 * 1000 // 60 min expiry
      }));

      await logAction(teacherDoc.id, virtualUser.email, 'LOGIN', `Teacher ${cleanId} (${teacherData.name}) logged into portal`);
    } catch (err: any) {
      console.error("Teacher login error:", err);
      throw new Error(err.message || 'Teacher authentication failed. Please check your credentials.');
    }
  };

  const [lastActivity, setLastActivity] = useState(Date.now());

  const performLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase signout failed (might be virtual session):", err);
    }
    localStorage.removeItem('school_staff_session');
    sessionStorage.clear();
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
        // Check for virtual session in localStorage
        const stored = localStorage.getItem('school_staff_session');
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (data.expires > Date.now()) {
              setUser({ uid: data.uid, email: data.email, displayName: data.teacherName } as any);
              setRole(data.role);
              setTeacherId(data.teacherId);
              setTeacherName(data.teacherName);
              setAssignedSubjects(data.assignedSubjects || []);
              setAssignedClasses(data.assignedClasses || []);
              setHomeroomTeacherFor(data.homeroomTeacherFor);
              setLoading(false);
              return;
            } else {
              localStorage.removeItem('school_staff_session');
            }
          } catch (e) {
            console.error("Session restore error:", e);
            localStorage.removeItem('school_staff_session');
          }
        }
        
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, role, loading, teacherId, teacherName, 
      assignedSubjects, assignedClasses, homeroomTeacherFor,
      loginTeacher, loginAdmin, logout: performLogout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
