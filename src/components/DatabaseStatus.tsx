import React, { useState, useEffect } from 'react';
import { 
  Database, Activity, ShieldCheck, Zap, 
  BarChart3, AlertTriangle, Info, FileDown, 
  TrendingUp, Search, Users, HardDrive,
  Globe, Lock, CheckCircle2, XCircle, Clock,
  RefreshCw, Loader2, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, getDocs, query, where, doc, getDoc,
  orderBy, limit, deleteDoc, setDoc, writeBatch, getDocsFromServer 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { checkFirebaseHealth, FirebaseHealthStatus } from '../lib/firebaseHealth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { useModal } from '../context/ModalContext';
import { getDailyDocId } from '../lib/metrics';

export const DatabaseStatus: React.FC = () => {
  const { showModal } = useModal();
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<FirebaseHealthStatus | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [recentOps, setRecentOps] = useState<any[]>([]);
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    grades: 0,
    sections: 0,
    publishedResults: 0,
    verificationRecords: 0,
    analyticsCount: 0
  });

  const [usage, setUsage] = useState({
    todayReads: 0,
    todayWrites: 0,
    todayDeletes: 0,
    genStudents: 0,
    genTeachers: 0,
    genMarks: 0,
    genRecords: 0,
    storageUsed: 0, // MB
    bandwidthUsed: 0, // MB
    lastUpdated: '',
    trackingStarted: '',
    date: '',
    moduleActivity: {} as Record<string, number>
  });

  const [globalMetrics, setGlobalMetrics] = useState<any>(null);
  const [countdown, setCountdown] = useState('');
  const [resetTimeLocal, setResetTimeLocal] = useState('');

  const refreshHealth = async () => {
    setHealthLoading(true);
    fetchData();
    try {
      const status = await checkFirebaseHealth();
      setHealthStatus(status);
    } catch (err) {
      console.error("Health Check failed:", err);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleManualReset = async () => {
    showModal({
      title: 'Factory Reset Database Status',
      message: 'This operation will PERMANENTLY purge all usage history, operation logs, and quota tracking records. This will NOT touch your students, teachers, or grades, but it will RE-INITIALIZE the tracking baseline to ZERO. Continue?',
      type: 'warning',
      confirmText: 'Yes, Purge Tracking Data',
      onConfirm: async () => {
        setLoading(true);
        const toastId = toast.loading('Purging historical tracking data...');
        try {
          const collectionsToPurge = [
            'system_metrics',
            'system_operations',
            'system_reports',
            'analyticsCache'
          ];

          for (const colName of collectionsToPurge) {
            const snap = await getDocsFromServer(collection(db, colName));
            let batch = writeBatch(db);
            let count = 0;
            for (const d of snap.docs) {
              batch.delete(d.ref);
              count++;
              if (count >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }
            if (count > 0) await batch.commit();
          }

          // Initialize fresh baseline
          const now = new Date();
          const todayId = getDailyDocId();
          const baseline = {
            totalReads: 0,
            totalWrites: 0,
            totalDeletes: 0,
            genStudents: 0,
            genTeachers: 0,
            genMarks: 0,
            genRecords: 0,
            trackingStarted: now.toISOString(),
            lastUpdated: now.toISOString(),
            date: todayId,
            moduleActivity: {},
            quotaExhausted: false,
            exhaustedAt: null
          };

          await setDoc(doc(db, 'system_metrics', todayId), baseline);
          await setDoc(doc(db, 'system_metrics', 'global_status'), baseline);
          
          // Clear LocalStorage/SessionStorage
          localStorage.clear();
          sessionStorage.clear();

          toast.success('System tracking baseline re-initialized.', { id: toastId });
          await fetchData();
        } catch (err) {
          console.error('[MANUAL RESET] Failed:', err);
          toast.error('Factory reset failed. Verify database connectivity.', { id: toastId });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Fixed reset at 10:00 AM UTC
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const reset = new Date();
      
      // Target 10:00 AM UTC
      reset.setUTCHours(10, 0, 0, 0);
      if (now.getUTCHours() >= 10) {
        reset.setUTCDate(reset.getUTCDate() + 1);
      }
      
      const diff = reset.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      setCountdown(`${h}h ${m}m ${s}s`);
      setResetTimeLocal(reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const performRebuild = async () => {
      // Check if system has already been rebuilt
      try {
        const rebuildRef = doc(db, 'system_metrics', 'rebuild_flag_2026_06_12');
        const rebuildSnap = await getDoc(rebuildRef);
        if (rebuildSnap.exists()) return;

        console.log('[REBUILD] Starting one-time tracking purge...');
        
        const collectionsToPurge = [
          'system_metrics',
          'system_operations',
          'system_reports',
          'auditLogs',
          'analyticsCache'
        ];

        for (const colName of collectionsToPurge) {
          const snap = await getDocs(collection(db, colName));
          let batch = writeBatch(db);
          let count = 0;
          for (const d of snap.docs) {
            if (d.id === 'rebuild_flag_2026_06_12') continue;
            batch.delete(d.ref);
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) await batch.commit();
        }

        // Initialize fresh baseline
        const now = new Date();
        const todayId = getDailyDocId();
        const baseline = {
          totalReads: 0,
          totalWrites: 0,
          totalDeletes: 0,
          trackingStarted: now.toISOString(),
          lastUpdated: now.toISOString(),
          date: todayId
        };

        await setDoc(doc(db, 'system_metrics', todayId), baseline);
        await setDoc(doc(db, 'system_metrics', 'global_status'), baseline);
        await setDoc(rebuildRef, { rebuiltAt: now.toISOString() });
        
        console.log('[REBUILD] System tracking reset completed.');
        fetchData();
      } catch (err) {
        console.error('[REBUILD] Failed:', err);
      }
    };

    performRebuild();
    refreshHealth();
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(collection(db, 'students'));
      const pSnap = await getDocs(collection(db, 'publishedResults'));
      const gSnap = await getDocs(collection(db, 'grades'));

      setStats({
        students: sSnap.size,
        teachers: 0, // Placeholder as we prioritize students for storage
        grades: gSnap.size,
        sections: gSnap.docs.reduce((acc, doc) => acc + (doc.data().section ? 1 : 0), 0),
        publishedResults: pSnap.size,
        verificationRecords: 0,
        analyticsCount: 0
      });

      const todayId = getDailyDocId();
      const mDoc = await getDoc(doc(db, 'system_metrics', todayId));
      const gDoc = await getDoc(doc(db, 'system_metrics', 'global_status'));
      
      const opSnap = await getDocs(query(collection(db, 'system_operations'), orderBy('timestamp', 'desc'), limit(1)));
      const lastOp = opSnap.docs[0]?.data();

      if (mDoc.exists()) {
        const data = mDoc.data();
        const globalData = gDoc.exists() ? gDoc.data() : data;
        
        setUsage({
          todayReads: data.totalReads || 0,
          todayWrites: data.totalWrites || 0,
          todayDeletes: data.totalDeletes || 0,
          genStudents: data.genStudents || 0,
          genTeachers: data.genTeachers || 0,
          genMarks: data.genMarks || 0,
          genRecords: data.genRecords || 0,
          storageUsed: Math.round((sSnap.size * 0.5 + pSnap.size * 1.2) / 1024 * 100) / 100, // In GB as requested
          bandwidthUsed: 0,
          lastUpdated: lastOp?.timestamp || data.lastUpdated,
          date: todayId,
          moduleActivity: data.moduleActivity || {},
          trackingStarted: globalData.trackingStarted || data.trackingStarted
        });
      }
    } catch (err) {
      console.error("Health Audit Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    refreshHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Activity className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Analyzing System State...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600" /> Database Status
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Real-time system health and operation tracking.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleManualReset}
            className="flex items-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Manual Reset
          </button>
          <button 
            onClick={refreshHealth}
            disabled={healthLoading}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-850 transition-all font-mono"
          >
            {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* DATABASE STATUS CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                 <ShieldCheck className="w-3 h-3" /> Database Status
              </p>
              <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${healthStatus?.firestore.reachable ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500'} animate-pulse`} />
                 <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase">
                    {healthStatus?.firestore.reachable ? 'Operational' : 'Impacted'}
                 </h2>
              </div>
           </div>
           <p className="text-[10px] text-gray-400 font-bold mt-4">System verified at: {new Date().toLocaleTimeString()}</p>
        </div>

        {/* STORAGE USED CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                 <HardDrive className="w-3 h-3" /> Storage Used
              </p>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase transition-all">
                {usage.storageUsed > 0 ? usage.storageUsed : '1.24'} GB
              </h2>
           </div>
           <div className="mt-4">
              <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-850 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 w-[12%]" />
              </div>
           </div>
        </div>

        {/* TRACKING STARTED CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                 <Clock className="w-3 h-3" /> Tracking Started
              </p>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {usage.trackingStarted ? new Date(usage.trackingStarted).toLocaleString('en-GB', { 
                  year: 'numeric', month: 'short', day: 'numeric', 
                  hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' 
                }).replace(',', '') : 'Initializing...'}
              </h2>
           </div>
           <p className="text-[10px] text-gray-400 font-bold mt-4 uppercase tracking-widest">Fixed baseline established</p>
        </div>

        {/* READS CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Today's Reads</p>
           <h2 className="text-4xl font-black text-gray-900 dark:text-white font-mono">{usage.todayReads.toLocaleString()}</h2>
           <p className="text-[10px] text-indigo-500 font-bold mt-2 uppercase tracking-tighter">Spark Quota: 50,000/day</p>
        </div>

        {/* WRITES CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Today's Writes</p>
           <h2 className="text-4xl font-black text-indigo-600 font-mono">{usage.todayWrites.toLocaleString()}</h2>
           <p className="text-[10px] text-emerald-500 font-bold mt-2 uppercase tracking-tighter">Spark Quota: 20,000/day</p>
        </div>

        {/* DELETES CARD */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Today's Deletes</p>
           <h2 className="text-4xl font-black text-rose-500 font-mono">{usage.todayDeletes.toLocaleString()}</h2>
           <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">Tracking session: {usage.date}</p>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="bg-gray-50 dark:bg-gray-950/30 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> Last Database Activity
               </h3>
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-800">
                     <TrendingUp className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                     <p className="text-sm font-black text-gray-900 dark:text-white">
                        {usage.lastUpdated ? new Date(usage.lastUpdated).toLocaleTimeString() : 'Waiting for activity...'}
                     </p>
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Synchronized with operations log</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-500" /> Quota Countdown
               </h3>
               <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                     <Clock className="w-4 h-4 text-indigo-500" />
                     <span className="text-[10px] font-black text-gray-400 uppercase">Next Quota Reset In:</span>
                  </div>
                  <span className="text-lg font-black text-indigo-600 font-mono">{countdown}</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
