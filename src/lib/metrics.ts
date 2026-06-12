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
  // Generated specifically today
  genStudents?: number;
  genTeachers?: number;
  genMarks?: number;
  genRecords?: number;
  lastUpdated: string;
  quotaExhausted?: boolean;
  exhaustedAt?: string | null;
  lastError?: string | null;
  resetTimestamp?: string;
  moduleActivity?: Record<string, number>;
}

export const getDailyDocId = () => {
  // Authoritative Reset Point: 10:00 AM UTC
  const now = new Date();
  const d = new Date(now);
  
  // If before 10 AM UTC, we are still in yesterday's quota cycle
  if (now.getUTCHours() < 10) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  
  // Return YYYY-MM-DD which represents the START date of the 24h quota cycle
  return d.toISOString().split('T')[0];
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
      await setDoc(metricsRef, updateData, { merge: true });
    } catch (e) {}
    
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

    await setDoc(metricsRef, firestoreUpdates, { merge: true });

    // Also update global status for real-time synchronization across panels
    const globalRef = doc(db, 'system_metrics', 'global_status');
    await setDoc(globalRef, firestoreUpdates, { merge: true });
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
  stats: { writes?: number; reads?: number; deletes?: number },
  metadata?: { userRole?: string; collection?: string }
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

    // 1.5 Update Global Totals (Only if not resetting)
    const globalRef = doc(db, 'system_metrics', 'global_status');
    const globalSnap = await getDoc(globalRef);
    const globalData = globalSnap.data();
    
    // Check if global status is stale (from previous cycle)
    const lastGlobalUpdate = globalData?.lastUpdated ? new Date(globalData.lastUpdated) : null;
    const now = new Date();
    const cycleStart = new Date(now);
    cycleStart.setUTCHours(10, 0, 0, 0);
    if (now.getUTCHours() < 10) cycleStart.setUTCDate(cycleStart.getUTCDate() - 1);

    if (!globalData || (lastGlobalUpdate && lastGlobalUpdate < cycleStart)) {
      // Hard Reset Global Status for new cycle
      await setDoc(globalRef, {
        totalReads: stats.reads || 0,
        totalWrites: stats.writes || 0,
        totalDeletes: stats.deletes || 0,
        lastUpdated: new Date().toISOString(),
        resetTimestamp: cycleStart.toISOString()
      });
    } else {
      await setDoc(globalRef, updates, { merge: true });
    }

    // 2. Log Recent Operation
    await addDoc(collection(db, 'system_operations'), {
      module,
      action,
      ...stats,
      ...metadata,
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
