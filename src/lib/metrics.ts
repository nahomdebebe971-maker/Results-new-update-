import { 
  doc, 
  updateDoc, 
  increment, 
  setDoc, 
  getDoc,
  collection,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface SystemMetrics {
  totalWrites: number;
  totalReads: number;
  totalDeletes: number;
  studentsCount: number;
  teachersCount: number;
  resultsCount: number;
  sectionsCount: number;
  lastUpdated: string;
  quotaExhausted?: boolean;
  exhaustedAt?: string | null;
  lastError?: string | null;
  moduleActivity?: Record<string, number>;
}

const getDailyDocId = () => {
  return new Date().toISOString().split('T')[0];
};

export const trackError = async (error: any) => {
  try {
    const isQuota = error?.code === 'resource-exhausted' || error?.message?.includes('Quota exceeded');
    const docId = getDailyDocId();
    const metricsRef = doc(db, 'system_metrics', docId);
    
    // Also update a global safety flag for quicker lookups
    const globalRef = doc(db, 'system_metrics', 'global_status');
    
    const updateData = {
      quotaExhausted: isQuota,
      exhaustedAt: isQuota ? new Date().toISOString() : null,
      lastError: error?.message || 'Unknown error',
      lastUpdated: new Date().toISOString()
    };

    try {
      await updateDoc(metricsRef, updateData);
    } catch (e) {
      // If daily doc doesn't exist yet, we don't necessarily want to create it just for an error
      // but we'll try to keep global status updated
    }
    
    await setDoc(globalRef, updateData, { merge: true });
  } catch (err) {
    console.error('Failed to track error:', err);
  }
};

export const clearQuotaError = async () => {
  try {
    const docId = getDailyDocId();
    const metricsRef = doc(db, 'system_metrics', docId);
    const globalRef = doc(db, 'system_metrics', 'global_status');

    const clearData = {
      quotaExhausted: false,
      exhaustedAt: null,
      lastError: null,
      lastUpdated: new Date().toISOString()
    };

    try {
      await updateDoc(metricsRef, clearData);
    } catch (e) {}
    await setDoc(globalRef, clearData, { merge: true });
  } catch (err) {
    console.error('Failed to clear quota error:', err);
  }
};

export const trackMetrics = async (updates: Partial<Record<keyof SystemMetrics, number>>) => {
  try {
    const docId = getDailyDocId();
    const metricsRef = doc(db, 'system_metrics', docId);
    const docSnap = await getDoc(metricsRef);

    const firestoreUpdates: any = {
      lastUpdated: new Date().toISOString(),
      date: docId
    };

    // Prepare increment updates
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'number') {
        firestoreUpdates[key] = increment(value);
      }
    }

    if (!docSnap.exists()) {
      // Initialize if doesn't exist
      const initial: any = {
        totalWrites: 0,
        totalReads: 0,
        totalDeletes: 0,
        studentsCount: 0,
        teachersCount: 0,
        resultsCount: 0,
        sectionsCount: 0,
        moduleActivity: {},
        date: docId,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      await setDoc(metricsRef, initial);
    } else {
      await updateDoc(metricsRef, firestoreUpdates);
    }
  } catch (err) {
    console.error('Failed to track metrics:', err);
  }
};

export type OperationModule = 
  | 'STUDENT_MGT' | 'TEACHER_MGT' | 'GRADE_MGT' | 'SUBJECT_ASSIGN' 
  | 'MARK_ENTRY' | 'RESULT_PUB' | 'VERIFICATION' | 'PORTAL_ACCESS' 
  | 'BULK_IMPORT' | 'BULK_EXPORT' | 'ANA_GEN' | 'REPORT_GEN' | 'SYSTEM';

export const trackOperation = async (
  module: OperationModule, 
  action: string, 
  stats: { writes?: number; reads?: number; deletes?: number }
) => {
  try {
    const docId = getDailyDocId();
    const metricsRef = doc(db, 'system_metrics', docId);
    
    // 1. Update Metrics Document
    const updates: any = {
      lastUpdated: new Date().toISOString(),
      [`moduleActivity.${module}`]: increment(1)
    };
    
    if (stats.writes) updates.totalWrites = increment(stats.writes);
    if (stats.reads) updates.totalReads = increment(stats.reads);
    if (stats.deletes) updates.totalDeletes = increment(stats.deletes);

    await setDoc(metricsRef, updates, { merge: true });

    // 2. Log Recent Operation
    await addDoc(collection(db, 'system_operations'), {
      module,
      action,
      ...stats,
      timestamp: new Date().toISOString(),
      date: docId
    });
  } catch (err) {
    console.error('Failed to track operation:', err);
  }
};

export const logGenerationReport = async (report: any) => {
  try {
    await addDoc(collection(db, 'system_reports'), {
      ...report,
      timestamp: new Date().toISOString()
    });
    
    // Also update global metrics summary
    await trackMetrics({
      totalWrites: report.writes || 0,
      studentsCount: report.students || 0,
      teachersCount: report.teachers || 0,
      sectionsCount: report.sections || 0,
      resultsCount: report.marks || 0
    });
  } catch (err) {
    console.error('Failed to log generation report:', err);
  }
};
