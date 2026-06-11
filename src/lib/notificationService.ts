import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'MARK_UPDATE' | 'FINALIZATION' | 'CONDUCT_UPDATE' | 'SYSTEM';

export interface SystemNotification {
  id?: string;
  type: NotificationType;
  title: string;
  message: string;
  moduleId: string; // e.g. "Grade 9A - Math"
  updatedBy: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

export const createNotification = async (notif: Omit<SystemNotification, 'id' | 'timestamp' | 'isRead'>) => {
  try {
    await addDoc(collection(db, 'system_notifications'), {
      ...notif,
      timestamp: new Date().toISOString(),
      isRead: false
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export const getUnreadCount = (callback: (count: number) => void) => {
  const q = query(
    collection(db, 'system_notifications'),
    where('isRead', '==', false)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.size);
  });
};

export const subscribeToNotifications = (callback: (notifications: SystemNotification[]) => void) => {
  const q = query(
    collection(db, 'system_notifications'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemNotification)));
  });
};

export const markAsRead = async (id: string) => {
  try {
    await updateDoc(doc(db, 'system_notifications', id), { isRead: true });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
  }
};

export const markAllUnreadAsRead = async () => {
    try {
        const q = query(collection(db, 'system_notifications'), where('isRead', '==', false));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
            batch.update(d.ref, { isRead: true });
        });
        await batch.commit();
    } catch (err) {
        console.error('Failed to clear notifications:', err);
    }
};
