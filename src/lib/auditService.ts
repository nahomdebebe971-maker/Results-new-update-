import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type AuditAction = 
  | 'LOGIN' 
  | 'PUBLICATION' 
  | 'GRADE_EDIT' 
  | 'TEACHER_EDIT' 
  | 'STUDENT_EDIT' 
  | 'SETTINGS_CHANGE';

export const logAction = async (
  userId: string, 
  userEmail: string, 
  action: AuditAction, 
  details: string,
  targetId?: string
) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      userEmail,
      action,
      details,
      targetId: targetId || '',
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      ip: 'masked' // Client side cannot easily get IP without external service
    });
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
};
