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
  orderBy, limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { checkFirebaseHealth, FirebaseHealthStatus } from '../lib/firebaseHealth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';

export const DatabaseStatus: React.FC = () => {
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
    storageUsed: 0, // MB
    bandwidthUsed: 0, // MB
    lastUpdated: '',
    date: '',
    moduleActivity: {} as Record<string, number>
  });

  const [globalMetrics, setGlobalMetrics] = useState<any>(null);
  const [countdown, setCountdown] = useState('');
  const [resetTimeLocal, setResetTimeLocal] = useState('');

  const refreshHealth = async () => {
    setHealthLoading(true);
    try {
      const status = await checkFirebaseHealth();
      setHealthStatus(status);
    } catch (err) {
      console.error("Health Check failed:", err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const reset = new Date();
      reset.setUTCHours(7, 0, 0, 0); 
      if (now.getUTCHours() >= 7) {
        reset.setUTCDate(reset.getUTCDate() + 1);
      }
      
      const diff = reset.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      setResetTimeLocal(reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    refreshHealth();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const sSnap = await getDocs(collection(db, 'students'));
        const tSnap = await getDocs(collection(db, 'teachers'));
        const gSnap = await getDocs(collection(db, 'grades'));
        const pSnap = await getDocs(collection(db, 'publishedResults'));
        const vSnap = await getDocs(collection(db, 'verificationCache'));
        const aSnap = await getDocs(collection(db, 'analyticsCache'));

        setStats({
          students: sSnap.size,
          teachers: tSnap.size,
          grades: gSnap.size,
          sections: gSnap.docs.reduce((acc, doc) => acc + (doc.data().section ? 1 : 0), 0),
          publishedResults: pSnap.size,
          verificationRecords: vSnap.size,
          analyticsCount: aSnap.size
        });

        const todayId = new Date().toISOString().split('T')[0];
        
        // Fetch All Daily Metrics
        const mSnap = await getDocs(query(collection(db, 'system_metrics'), orderBy('date', 'desc')));
        const historyData: any[] = [];
        let todayData: any = null;
        let globStatus: any = null;

        mSnap.forEach(doc => {
          const data = doc.data();
          if (doc.id === 'global_status') {
            globStatus = data;
          } else {
            if (data.date === todayId) {
              todayData = data;
            }
            historyData.push(data);
          }
        });

        // Fetch Recent Ops
        const opSnap = await getDocs(query(collection(db, 'system_operations'), orderBy('timestamp', 'desc'), limit(10)));
        setRecentOps(opSnap.docs.map(d => d.data()));

        setHistory(historyData);
        setGlobalMetrics(globStatus);

        if (todayData) {
          setUsage({
            todayReads: todayData.totalReads || 0,
            todayWrites: todayData.totalWrites || 0,
            todayDeletes: todayData.totalDeletes || 0,
            storageUsed: Math.round((sSnap.size * 0.5 + pSnap.size * 1.2) / 1024 * 10) / 10,
            bandwidthUsed: Math.round((todayData.totalReads || 0) * 0.05),
            lastUpdated: todayData.lastUpdated,
            date: todayData.date,
            moduleActivity: todayData.moduleActivity || {}
          });
        } else {
          setUsage(prev => ({
            ...prev,
            date: todayId,
            storageUsed: Math.round((sSnap.size * 0.5 + pSnap.size * 1.2) / 1024 * 10) / 10,
          }));
        }

      } catch (err) {
        console.error("Health Audit Failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getHealthScore = () => {
    if (globalMetrics?.quotaExhausted || healthStatus?.firestore.isQuotaExhausted) return 0;
    let score = 95;
    if (usage.todayReads > 45000) score -= 15;
    if (healthStatus && !healthStatus.firestore.writable) score -= 40;
    return Math.max(score, 0);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('School Result System - Health Audit Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    const rows = [
      ['Metric', 'Current Period Value', 'Limit (Spark)'],
      ['Tracking Day', usage.date, '-'],
      ['Total Students', stats.students.toString(), '-'],
      ['Today Reads', usage.todayReads.toLocaleString(), '50,000'],
      ['Today Writes', usage.todayWrites.toLocaleString(), '20,000'],
      ['Storage Used', `${usage.storageUsed} MB`, '1,024 MB'],
      ['System Health', `${getHealthScore()}/100`, 'Target 95+']
    ];

    autoTable(doc, {
      startY: 40,
      head: [rows[0]],
      body: rows.slice(1),
    });

    doc.save(`health-report-${usage.date}.pdf`);
    toast.success('System report exported as PDF');
  };

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
            <Database className="w-8 h-8 text-indigo-600" /> Database Status Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Monitoring real-time Firebase activity and estimated system growth.</p>
          <div className="flex items-center gap-2 mt-2">
             <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-black uppercase tracking-widest">Period: {usage.date}</div>
             <div className="px-2 py-0.5 bg-gray-50 dark:bg-gray-850 text-gray-400 rounded text-[10px] font-black uppercase tracking-widest">Reset: {resetTimeLocal}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={refreshHealth}
            disabled={healthLoading}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-850 transition-all"
          >
            {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <FileDown className="w-4 h-4" /> Download Audit
          </button>
        </div>
      </div>

      {/* Tracking Debug Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl">
            <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Last Tracking Read</p>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">+{recentOps[0]?.reads || 0}</p>
         </div>
         <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-2xl">
            <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Last Tracking Write</p>
            <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">+{recentOps[0]?.writes || 0}</p>
         </div>
         <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-4 rounded-2xl">
            <p className="text-[8px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Last Tracking Delete</p>
            <p className="text-lg font-black text-rose-700 dark:text-rose-300">+{recentOps[0]?.deletes || 0}</p>
         </div>
         <div className="bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Last Sync Epoch</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
               {recentOps[0]?.timestamp ? new Date(recentOps[0].timestamp).toLocaleTimeString() : 'Waiting for sync...'}
            </p>
         </div>
      </div>

      {/* TODAY PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today's Reads</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{usage.todayReads.toLocaleString()}</p>
         </div>
         <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today's Writes</p>
            <p className="text-3xl font-black text-indigo-600">{usage.todayWrites.toLocaleString()}</p>
         </div>
         <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today's Deletes</p>
            <p className="text-3xl font-black text-rose-500">{usage.todayDeletes.toLocaleString()}</p>
         </div>
         <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estimated Growth</p>
            <p className="text-xl font-black text-emerald-600">+{Math.round(usage.todayWrites * 0.05 / 1024 * 100)/100} MB</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Growth Today</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 1: SYSTEM ESTIMATES */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> System Tracking Estimates
              </h2>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 rounded">Source: System Tracking (Estimated)</span>
           </div>

           <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-8">
             <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tracking Reads</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{usage.todayReads.toLocaleString()}</p>
                   </div>
                   <p className="text-[10px] font-bold text-gray-400">Quota usage: {Math.round((usage.todayReads/50000)*100)}%</p>
                </div>
                <div className="h-2 w-full bg-gray-50 dark:bg-gray-950 rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((usage.todayReads/50000)*100, 100)}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                   />
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tracking Writes</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{usage.todayWrites.toLocaleString()}</p>
                   </div>
                   <p className="text-[10px] font-bold text-gray-400">Quota usage: {Math.round((usage.todayWrites/20000)*100)}%</p>
                </div>
                <div className="h-2 w-full bg-gray-50 dark:bg-gray-950 rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((usage.todayWrites/20000)*100, 100)}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-850">
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Students</p>
                   <p className="text-xl font-black">{stats.students.toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Storage</p>
                   <p className="text-xl font-black text-amber-600">{usage.storageUsed} MB</p>
                </div>
             </div>
           </div>
        </div>

        {/* SECTION 2: FIREBASE STATUS */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Actual Firebase Status
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 rounded">Live Feedback</span>
           </div>

           <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Globe className="w-48 h-48 group-hover:scale-110 transition-transform duration-1000" />
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-8">
                 <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Connection Status</p>
                    <div className="flex items-center gap-2">
                       <div className={`w-3 h-3 rounded-full ${healthStatus?.firestore.reachable ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'} animate-pulse`} />
                       <span className="text-xl font-black uppercase tracking-tight">{healthStatus?.firestore.reachable ? 'Operational' : 'Impacted'}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Firestore Health</p>
                    <div className="flex items-center gap-2">
                       <ShieldCheck className={`w-5 h-5 ${healthStatus?.firestore.writable ? 'text-emerald-400' : 'text-rose-400'}`} />
                       <span className="text-xl font-black uppercase tracking-tight">{healthStatus?.firestore.writable ? 'Healthy' : 'Restricted'}</span>
                    </div>
                 </div>
              </div>

              <div className="relative z-10 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 grid grid-cols-3 gap-6">
                  <div className="text-center">
                     <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Reads</p>
                     <p className={`text-sm font-bold ${healthStatus?.firestore.readable ? 'text-emerald-400' : 'text-rose-400'}`}>{healthStatus?.firestore.readable ? 'OK' : 'FAIL'}</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Writes</p>
                     <p className={`text-sm font-bold ${healthStatus?.firestore.writable ? 'text-emerald-400' : 'text-rose-400'}`}>{healthStatus?.firestore.writable ? 'OK' : 'FAIL'}</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Quota</p>
                     <p className={`text-sm font-bold ${healthStatus?.firestore.isQuotaExhausted ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {healthStatus?.firestore.isQuotaExhausted ? 'EXHAUSTED' : 'NORMAL'}
                     </p>
                  </div>
              </div>
              
              <div className="relative z-10">
                 <button 
                  onClick={refreshHealth}
                  disabled={healthLoading}
                  className="w-full py-4 bg-white/10 hover:bg-white/20 transition-all rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10"
                 >
                    {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh Actual Status
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
               <TrendingUp className="w-4 h-4 text-purple-600" /> Module Resource Usage
            </h3>
            <div className="space-y-5">
               {Object.entries(usage.moduleActivity).length === 0 ? (
                 <p className="text-xs font-bold text-gray-400 py-8 text-center italic">No complex operations recorded for this period yet.</p>
               ) : (
                 Object.entries(usage.moduleActivity)
                 .sort(([, a], [, b]) => (b as number) - (a as number))
                 .slice(0, 6)
                 .map(([mod, count]) => (
                   <div key={mod} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                         <span className="text-gray-500">{mod.replace(/_/g, ' ')}</span>
                         <span className="text-gray-900 dark:text-white">{count} Hits</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 dark:bg-gray-950 rounded-full overflow-hidden">
                         <motion.div 
                          className="h-full bg-purple-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(((count as number) / 100) * 100, 100)}%` }}
                         />
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>

         <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
               <Activity className="w-4 h-4 text-rose-500" /> Recent Operations
            </h3>
            <div className="space-y-4">
               {recentOps.length === 0 ? (
                 <p className="text-xs font-bold text-gray-400 py-8 text-center italic">No operations logged recently.</p>
               ) : (
                 recentOps.map((op: any, i: number) => (
                   <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-50 dark:border-gray-850 last:border-0 last:pb-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        (op.writes || 0) > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                         {(op.writes || 0) > 0 ? <Plus className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-grow">
                         <p className="text-[11px] font-black text-gray-900 dark:text-white leading-tight">{op.action}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">{op.module}</span>
                            <span className="text-[8px] font-bold text-gray-400">
                               {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                         </div>
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                 <Clock className="w-6 h-6 text-indigo-500" /> Usage History
               </h3>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Audit of previous tracking periods</p>
            </div>
            <Activity className="w-10 h-10 text-gray-50 opacity-10" />
         </div>

         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-left border-b border-gray-50 dark:border-gray-850">
                     <th className="pb-4 px-4">Period (UTC)</th>
                     <th className="pb-4 px-4">Reads</th>
                     <th className="pb-4 px-4">Writes</th>
                     <th className="pb-4 px-4">Deletes</th>
                     <th className="pb-4 px-4">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-gray-850">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs font-bold text-gray-400 italic">No historical tracking records found.</td>
                    </tr>
                  ) : history.map((record, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-all group">
                       <td className="py-5 px-4">
                          <span className="text-sm font-black text-gray-900 dark:text-white">{record.date}</span>
                          {record.date === usage.date && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-bold uppercase">Current</span>}
                       </td>
                       <td className="py-5 px-4">
                          <div className="space-y-1">
                             <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{(record.totalReads || 0).toLocaleString()}</p>
                             <div className="w-24 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(((record.totalReads || 0) / 50000) * 100, 100)}%` }} />
                             </div>
                          </div>
                       </td>
                       <td className="py-5 px-4">
                          <div className="space-y-1">
                             <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{(record.totalWrites || 0).toLocaleString()}</p>
                             <div className="w-24 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(((record.totalWrites || 0) / 20000) * 100, 100)}%` }} />
                             </div>
                          </div>
                       </td>
                       <td className="py-5 px-4">
                          <p className="text-sm font-bold text-gray-500">{(record.totalDeletes || 0).toLocaleString()}</p>
                       </td>
                       <td className="py-5 px-4">
                          <div className={`px-2 py-0.5 rounded-full inline-block text-[8px] font-black uppercase tracking-widest ${record.quotaExhausted || record.isQuotaExhausted ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                             {record.quotaExhausted || record.isQuotaExhausted ? 'Quota Exhausted' : 'Operational'}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
