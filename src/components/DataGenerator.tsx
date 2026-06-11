import React, { useState, useEffect } from 'react';
import { 
  Database, Zap, AlertTriangle, CheckCircle2, 
  Loader2, Info, UserCheck, GraduationCap, Calculator,
  Activity, ShieldAlert, Settings, Trash2, 
  UserRound, BookOpen, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, writeBatch, doc, getDoc, getDocs, query, where, deleteDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logGenerationReport, trackMetrics, SystemMetrics } from '../lib/metrics';
import { checkFirebaseHealth } from '../lib/firebaseHealth';
import { toast } from 'react-hot-toast';
import { Grade, Subject, Student, Teacher, SubjectAssignment } from '../types';
import { useSchoolConfig } from '../hooks/useSchoolConfig';

const FIRST_NAMES = ['Abebe', 'Almaz', 'Bekele', 'Chala', 'Derartu', 'Elias', 'Fatuma', 'Girma', 'Haile', 'Ibsa', 'Jemal', 'Kebede', 'Lemi', 'Mulu', 'Nahom', 'Omer', 'Rahel', 'Saron', 'Tadesse', 'Urji', 'Yared', 'Zenebe', 'Solomon', 'Tsegaye', 'Meseret', 'Aster', 'Biniam', 'Desta', 'Eshhetu', 'Fikre', 'Getachew', 'Habtamu', 'Isayas', 'Kidus', 'Mersha', 'Nigist', 'Pawlos', 'Rediet', 'Senait', 'Tigist', 'Wondimu', 'Yeabsera', 'Zewdie'];
const LAST_NAMES = ['Tesfaye', 'Kebede', 'Girma', 'Bekele', 'Debebe', 'Tadesse', 'Mamo', 'Alemu', 'Berhanu', 'Dessalegn', 'Haile', 'Ibrahim', 'Kassa', 'Lemma', 'Mohammed', 'Negash', 'Oumer', 'Redwan', 'Sultan', 'Taye', 'Worku', 'Zewde', 'Adane', 'Belay', 'Cherinet', 'Dibaba', 'Estifanos', 'Feleke', 'Gebre', 'Hailu', 'Iyasu', 'Kifle', 'Lema', 'Mekonnen', 'Netsanet', 'Olani', 'Petros', 'Reta', 'Shemeles', 'Tilahun', 'Welde', 'Yonas', 'Zelalem'];

const SUBJECT_LISTS = {
  grade9_10: [
    'Amharic', 'English', 'A/Oromo', 'Chemistry', 'Physics', 'Biology', 
    'Mathematics', 'History', 'Geography', 'Citizenship', 'HPE', 'Art', 'ICT'
  ],
  grade11_12_science: [
    'Mathematics', 'English', 'Chemistry', 'Physics', 'Biology', 'Agriculture', 'ICT', 'Construction', 'Amharic'
  ],
  grade11_12_social: [
    'English', 'Mathematics', 'History', 'Journalism', 'Geography', 'Accounting', 'Citizenship', 'ICT', 'Amharic'
  ]
};

interface GenerationConfig {
  studentsPerSection: number;
  grade9Sections: number;
  grade10Sections: number;
  grade11Sections: number;
  grade12Sections: number;
  numTeachers: number;
  generateResults: boolean;
  generateConduct: boolean;
  generateAttendance: boolean;
  generateQR: boolean;
  generateAnalytics: boolean;
  publishResults: boolean;
  mode: 'CONTINUE' | 'REPLACE' | 'RESET';
}

export const DataGenerator: React.FC = () => {
  const { config } = useSchoolConfig();
  const [step, setStep] = useState<'config' | 'impact' | 'preview' | 'generating' | 'report'>('config');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, task: '', batch: 0 });
  const [isQuotaBlocked, setIsQuotaBlocked] = useState(false);
  const [resetTime, setResetTime] = useState('');

  const [existingStats, setExistingStats] = useState({
    grade9: [] as string[],
    grade10: [] as string[],
    grade11: [] as string[],
    grade12: [] as string[],
    teachers: 0,
    students: 0
  });

  const [globalMetrics, setGlobalMetrics] = useState<SystemMetrics | null>(null);
  const [countdown, setCountdown] = useState('');

  const [genConfig, setGenConfig] = useState<GenerationConfig>({
    studentsPerSection: 80,
    grade9Sections: 1,
    grade10Sections: 1,
    grade11Sections: 1,
    grade12Sections: 1,
    numTeachers: 10,
    generateResults: true,
    generateConduct: true,
    generateAttendance: true,
    generateQR: true,
    generateAnalytics: true,
    publishResults: false,
    mode: 'CONTINUE'
  });

  useEffect(() => {
    const fetchExisting = async () => {
      const gSnap = await getDocs(collection(db, 'grades'));
      const tSnap = await getDocs(collection(db, 'teachers'));
      const sSnap = await getDocs(collection(db, 'students'));
      
      const todayId = new Date().toISOString().split('T')[0];
      const mSnap = await getDoc(doc(db, 'system_metrics', todayId));
      
      const g9 = gSnap.docs.filter(d => d.data().name === '9').map(d => d.data().section).sort();
      const g10 = gSnap.docs.filter(d => d.data().name === '10').map(d => d.data().section).sort();
      const g11 = gSnap.docs.filter(d => d.data().name === '11').map(d => d.data().section).sort();
      const g12 = gSnap.docs.filter(d => d.data().name === '12').map(d => d.data().section).sort();

      setExistingStats({
        grade9: g9,
        grade10: g10,
        grade11: g11,
        grade12: g12,
        teachers: tSnap.size,
        students: sSnap.size
      });

      if (mSnap.exists()) {
        const data = mSnap.data();
        // Rename for compatibility if needed, but here we just need totalWrites
        setGlobalMetrics({
          totalWrites: data.totalWrites || 0,
          totalReads: data.totalReads || 0,
          totalDeletes: data.totalDeletes || 0,
          studentsCount: data.studentsCount || 0,
          teachersCount: data.teachersCount || 0,
          resultsCount: data.resultsCount || 0,
          sectionsCount: data.sectionsCount || 0,
          lastUpdated: data.lastUpdated || '',
          quotaExhausted: data.quotaExhausted || false
        });
      }
    };
    fetchExisting();

    const timer = setInterval(() => {
      const now = new Date();
      const reset = new Date();
      reset.setUTCHours(7, 0, 0, 0);
      if (now.getUTCHours() >= 7) reset.setUTCDate(reset.getUTCDate() + 1);
      const diff = reset.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      setResetTime(reset.toLocaleTimeString());
    }, 1000);

    const checkHealth = async () => {
      const health = await checkFirebaseHealth();
      if (!health.firestore.writable || health.firestore.isQuotaExhausted) {
        setIsQuotaBlocked(true);
      }
    };
    checkHealth();

    return () => clearInterval(timer);
  }, []);

  const [impact, setImpact] = useState({
    students: 0,
    sections: 0,
    teachers: 150,
    marks: 0,
    published: 0,
    writes: 0,
    reads: 0,
    storage: 0,
    time: 0,
    quotaWouldExceed: false
  });

  useEffect(() => {
    const sections = genConfig.grade9Sections + genConfig.grade10Sections + genConfig.grade11Sections + genConfig.grade12Sections;
    const students = sections * genConfig.studentsPerSection;
    
    // marks calculation: G9/10 (13 subs), G11/12 (9 subs)
    const marks9_10 = (genConfig.grade9Sections + genConfig.grade10Sections) * genConfig.studentsPerSection * 13;
    const marks11_12 = (genConfig.grade11Sections + genConfig.grade12Sections) * genConfig.studentsPerSection * 9;
    const totalMarks = genConfig.generateResults ? marks9_10 + marks11_12 : 0;
    
    const published = genConfig.publishResults ? students : 0;
    const teachers = genConfig.numTeachers;
    const qr = genConfig.generateQR ? students : 0;
    
    const totalWrites = 4 + sections + teachers + students + totalMarks + published + qr + (genConfig.generateAnalytics ? 50 : 0);
    const storage = (students * 0.4 + totalMarks * 0.08 + published * 0.5) / 1024;

    const todayUsed = globalMetrics?.totalWrites || 0;
    const wouldExceed = (todayUsed + totalWrites) > 20000;

    setImpact({
      students,
      sections,
      teachers,
      marks: totalMarks,
      published,
      writes: totalWrites,
      reads: (sections + teachers) * 2,
      storage: Math.round(storage * 10) / 10,
      time: Math.ceil(totalWrites / 400) * 0.5,
      quotaWouldExceed: wouldExceed
    });
  }, [genConfig, globalMetrics]);

  const generateMark = (pTier: number) => {
    if (pTier === 3) return 85 + Math.floor(Math.random() * 15);
    if (pTier === 2) return 60 + Math.floor(Math.random() * 25);
    if (pTier === 1) return 50 + Math.floor(Math.random() * 10);
    return 20 + Math.floor(Math.random() * 30);
  };

  const getQuotaStatus = (val: number, limit: number) => {
    const p = (val / limit) * 100;
    if (p > 95) return { label: 'CRITICAL', color: 'text-rose-600 bg-rose-50 border-rose-100' };
    if (p > 75) return { label: 'WARNING', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    return { label: 'SAFE', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
  };

  const runGeneration = async () => {
    const finalHealth = await checkFirebaseHealth();
    if (!finalHealth.firestore.writable || finalHealth.firestore.isQuotaExhausted) {
      setIsQuotaBlocked(true);
      toast.error('Generation Aborted: Firebase write quota exhausted.');
      setStep('config');
      return;
    }

    const todayId = new Date().toISOString().split('T')[0];
    const latestMetricsSnap = await getDoc(doc(db, 'system_metrics', todayId));
    const todayWrites = latestMetricsSnap.exists() ? (latestMetricsSnap.data().totalWrites || 0) : 0;

    if (todayWrites + impact.writes > 20000) {
      toast.error('Generation Blocked: Quota Would Be Exceeded.');
      setIsQuotaBlocked(true);
      setStep('config');
      return;
    }

    if (globalMetrics?.quotaExhausted) {
      toast.error('Generation unavailable. Firebase write quota exhausted.');
      return;
    }
    setLoading(true);
    setStep('generating');
    const start = Date.now();
    let actualWrites = 0;
    let localWrites = 0;

    try {
      if (genConfig.mode === 'RESET') {
        setProgress({ current: 0, total: 1, task: 'Factory Resetting System', batch: 1 });
        const cols = ['students', 'teachers', 'grades', 'subjects', 'marks', 'assignments', 'publishedResults', 'verificationCache', 'system_reports'];
        for (const col of cols) {
          const snap = await getDocs(collection(db, col));
          let batch = writeBatch(db);
          let count = 0;
          for (const d of snap.docs) {
            batch.delete(doc(db, col, d.id));
            count++;
            actualWrites++;
            if (count >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      }

      setProgress({ current: 0, total: impact.sections, task: 'Building School Architecture', batch: 1 });
      const gradeCfgs = [
        { name: '9', count: genConfig.grade9Sections, subs: SUBJECT_LISTS.grade9_10, existing: existingStats.grade9 },
        { name: '10', count: genConfig.grade10Sections, subs: SUBJECT_LISTS.grade9_10, existing: existingStats.grade10 },
        { name: '11', count: genConfig.grade11Sections, subs: SUBJECT_LISTS.grade11_12_science, socialSubs: SUBJECT_LISTS.grade11_12_social, existing: existingStats.grade11 },
        { name: '12', count: genConfig.grade12Sections, subs: SUBJECT_LISTS.grade11_12_science, socialSubs: SUBJECT_LISTS.grade11_12_social, existing: existingStats.grade12 }
      ];

      const gradeDocs: Grade[] = [];
      const globalSubjects: Map<string, string> = new Map();

      for (const gc of gradeCfgs) {
        const startChar = gc.existing.length > 0 ? gc.existing[gc.existing.length - 1].charCodeAt(0) + 1 : 65;
        
        for (let i = 0; i < gc.count; i++) {
          const section = String.fromCharCode(startChar + i);
          const isSocial = (gc.name === '11' || gc.name === '12') && (gc.existing.length + i) >= 10;
          const currentSubs = isSocial && gc.socialSubs ? gc.socialSubs : gc.subs;
          
          const batch = writeBatch(db);
          const gId = `${gc.name}${section}`;
          const gRef = doc(db, 'grades', gId);
          
          const subIds: string[] = [];
          for (const sName of currentSubs) {
            let sId = globalSubjects.get(sName);
            if (!sId) {
              const sRef = doc(collection(db, 'subjects'));
              sId = sRef.id;
              batch.set(sRef, { id: sId, name: sName, createdAt: new Date().toISOString() });
              globalSubjects.set(sName, sId);
              actualWrites++;
            }
            subIds.push(sId);
          }

          const gradeData: Grade = {
            id: gRef.id,
            name: gc.name,
            section: section,
            subjectIds: subIds,
            createdAt: new Date().toISOString()
          };
          batch.set(gRef, gradeData);
          gradeDocs.push(gradeData);
          actualWrites++;
          await batch.commit();
          await trackMetrics({ totalWrites: 1, sectionsCount: 1 });
          setProgress(p => ({ ...p, current: p.current + 1 }));
        }
      }

      setProgress({ current: 0, total: genConfig.numTeachers, task: 'Recruiting Faculty', batch: 2 });
      const teacherDocs: Teacher[] = [];
      const teacherStartId = existingStats.teachers + 1001;
      
      for (let i = 0; i < genConfig.numTeachers; i++) {
        const tBatch = writeBatch(db);
        const tId = `T${teacherStartId + i}`;
        const ref = doc(collection(db, 'teachers'));
        const teacher: Teacher = {
          id: ref.id,
          teacherId: tId,
          name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i + 12) % LAST_NAMES.length]}`,
          assignedSubjects: [],
          assignedClasses: [],
          createdAt: new Date().toISOString()
        };
        tBatch.set(ref, teacher);
        teacherDocs.push(teacher);
        actualWrites++;
        await tBatch.commit();
        await trackMetrics({ totalWrites: 1, teachersCount: 1 });
        setProgress(p => ({ ...p, current: i + 1 }));
      }

      const teacherIndexRef = { val: 0 };
      for (const grade of gradeDocs) {
        const batch = writeBatch(db);
        const homeroomTeacher = teacherDocs[teacherIndexRef.val % teacherDocs.length];
        teacherIndexRef.val++;

        const gRef = doc(db, 'grades', grade.id);
        batch.update(gRef, { homeroomTeacher: homeroomTeacher.name });
        actualWrites++;

        for (const sId of (grade.subjectIds || [])) {
          const subTeacher = teacherDocs[teacherIndexRef.val % teacherDocs.length];
          teacherIndexRef.val++;
          const subName = Array.from(globalSubjects.entries()).find(([name, id]) => id === sId)?.[0] || 'Unknown';
          
          const aId = `${subTeacher.teacherId}_${sId}_${grade.id}`;
          const aRef = doc(db, 'assignments', aId);
          batch.set(aRef, {
            id: aId,
            teacherId: subTeacher.teacherId,
            teacherName: subTeacher.name,
            subjectId: sId,
            subjectName: subName,
            gradeId: grade.id,
            gradeName: grade.name,
            section: grade.section,
            passkey: '1234',
            createdAt: new Date().toISOString()
          });
          actualWrites++;
        }
        await batch.commit();
        await trackMetrics({ totalWrites: actualWrites - localWrites });
        localWrites = actualWrites;
        setProgress(p => ({ ...p, current: progress.current + 1 }));
      }

      setProgress({ current: 0, total: impact.students, task: 'Enrolling Students & Computing Marks', batch: 4 });
      for (const grade of gradeDocs) {
        for (let i = 1; i <= genConfig.studentsPerSection; i++) {
          const sBatch = writeBatch(db);
          const studentId = `S${grade.name}${grade.section}${100 + i}`;
          const performance = Math.random() > 0.85 ? 3 : Math.random() > 0.4 ? 2 : Math.random() > 0.1 ? 1 : 0;
          
          const student: Student = {
            id: studentId,
            studentId,
            name: `${FIRST_NAMES[(i + grade.section.charCodeAt(0)) % FIRST_NAMES.length]} ${LAST_NAMES[(i + 7) % LAST_NAMES.length]}`,
            sex: Math.random() > 0.5 ? 'M' : 'F',
            age: 14 + (parseInt(grade.name) - 9) + (Math.random() > 0.9 ? 1 : 0),
            grade: grade.name,
            section: grade.section,
            conduct: genConfig.generateConduct ? (Math.random() > 0.8 ? 'B' : Math.random() > 0.95 ? 'C' : 'A') : 'A',
            absent: genConfig.generateAttendance ? Math.floor(Math.pow(Math.random(), 3) * 15) : 0,
            verificationId: genConfig.generateQR ? crypto.randomUUID() : undefined,
            createdAt: new Date().toISOString()
          };

          const sRef = doc(db, 'students', studentId);
          sBatch.set(sRef, student);
          actualWrites++;

          if (genConfig.generateResults) {
            for (const sId of (grade.subjectIds || [])) {
              const mId = `${studentId}_${sId}`;
              const mRef = doc(db, 'marks', mId);
              sBatch.set(mRef, {
                id: mId,
                studentId,
                subjectId: sId,
                grade: grade.name,
                section: grade.section,
                semester1: generateMark(performance),
                semester2: generateMark(performance),
                updatedAt: new Date().toISOString()
              });
              actualWrites++;
            }
          }

          if (genConfig.generateQR && student.verificationId) {
            const vRef = doc(db, 'verificationCache', student.verificationId);
            sBatch.set(vRef, {
              verificationId: student.verificationId,
              studentId,
              name: student.name,
              academicYear: config?.academicYear || '2026',
              timestamp: new Date().toISOString(),
              isTest: true
            });
            actualWrites++;
          }

          await sBatch.commit();
          await trackMetrics({ totalWrites: actualWrites - localWrites, studentsCount: 1 });
          localWrites = actualWrites;
          setProgress(p => ({ ...p, current: p.current + 1 }));
        }
      }

      setStep('report');
      toast.success('Professional dataset generated successfully!');
    } catch (err: any) {
      console.error("Gen Failure:", err);
      toast.error('Engine error: Quota limit or Firestore security timeout.');
      setStep('config');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
             <Layers className="w-8 h-8 text-indigo-600" /> Data Genie Pro
          </h1>
          <p className="text-gray-500 font-medium">Create a complete, interconnected virtual school in minutes.</p>
        </div>
        {step !== 'config' && (
          <button onClick={() => setStep('config')} className="text-xs font-black uppercase text-gray-400 hover:text-indigo-600 tracking-widest px-4 py-2 border border-gray-100 dark:border-gray-800 rounded-xl transition-colors">
             ← Adjust Parameters
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'config' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-8">
                   <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <Settings className="w-4 h-4" /> Global Parameters
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Faculty Count</label>
                        <input type="number" value={genConfig.numTeachers} onChange={e => setGenConfig({ ...genConfig, numTeachers: parseInt(e.target.value) || 0 })} className="w-full p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl outline-none font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Class Size</label>
                        <input type="number" value={genConfig.studentsPerSection} onChange={e => setGenConfig({ ...genConfig, studentsPerSection: parseInt(e.target.value) || 0 })} className="w-full p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl outline-none font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Teacher Assignment</label>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase text-center border border-emerald-100 dark:border-emerald-900/50">Auto-Matching</div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Section Distribution</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { k: 'grade9Sections', l: 'Grade 9' },
                          { k: 'grade10Sections', l: 'Grade 10' },
                          { k: 'grade11Sections', l: 'Grade 11' },
                          { k: 'grade12Sections', l: 'Grade 12' }
                        ].map((g) => (
                          <div key={g.k} className="p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800">
                             <p className="text-[10px] font-black text-gray-400 uppercase mb-2">{g.l}</p>
                             <input type="number" value={genConfig[g.k as keyof GenerationConfig] as number} onChange={e => setGenConfig({ ...genConfig, [g.k]: parseInt(e.target.value) || 0 })} className="w-full bg-transparent font-black text-xl outline-none focus:text-indigo-600 text-gray-900 dark:text-white" />
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-50 dark:border-gray-850">
                      {[
                        { k: 'CONTINUE', l: 'Continue Existing', d: 'Add new sections & staff' },
                        { k: 'REPLACE', l: 'Replace Current', d: 'Wipe placeholder data' },
                        { k: 'RESET', l: 'Factory Reset', d: 'Purge everything first' }
                      ].map((m) => (
                        <button key={m.k} onClick={() => setGenConfig({ ...genConfig, mode: m.k as any })} className={`p-4 rounded-2xl border-2 transition-all text-left ${genConfig.mode === m.k ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900' : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800'}`}>
                           <p className={`text-[10px] font-black uppercase tracking-widest ${genConfig.mode === m.k ? 'text-indigo-600' : 'text-gray-400'}`}>{m.l}</p>
                           <p className="text-[10px] opacity-60 font-medium mt-1">{m.d}</p>
                        </button>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className={`bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border-4 ${impact.quotaWouldExceed ? 'border-rose-500/50' : 'border-transparent'}`}>
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                         <Zap className={`w-8 h-8 ${isQuotaBlocked || impact.quotaWouldExceed ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`} />
                         <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isQuotaBlocked || impact.quotaWouldExceed ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-indigo-300'}`}>
                           {isQuotaBlocked ? 'Quota Exhausted' : impact.quotaWouldExceed ? 'Quota Projection High' : 'Ready to Build'}
                         </span>
                      </div>
                      <div className="space-y-2 mb-8">
                         <p className="text-3xl font-black">{impact.students.toLocaleString()}</p>
                         <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Target Students Population</p>
                      </div>
                      
                      {isQuotaBlocked ? (
                        <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-center space-y-2 mb-4">
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Firebase Write Quota Exhausted</p>
                           <p className="text-xl font-black tabular-nums font-mono text-white">{countdown}</p>
                           <p className="text-[10px] font-bold text-rose-400 uppercase">Estimated Reset: {resetTime}</p>
                        </div>
                      ) : impact.quotaWouldExceed ? (
                        <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-center space-y-2 mb-4">
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Quota Limit Violation</p>
                           <p className="text-xs font-bold text-white">This generation (+{impact.writes.toLocaleString()} writes) exceeds today's remaining quota.</p>
                           <p className="text-[10px] font-bold text-rose-400 uppercase mt-2">Adjust parameters to continue</p>
                        </div>
                      ) : (
                        <button onClick={() => setStep('impact')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-900 active:scale-95">
                           Audit System Impact
                        </button>
                      )}
                   </div>
                   <Activity className="absolute -right-12 -bottom-12 w-64 h-64 opacity-10 rotate-12 group-hover:scale-125 transition-transform duration-1000" />
                </div>
                
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex items-start gap-4">
                   <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-1" />
                   <p className="text-xs text-gray-500 font-medium leading-relaxed">Advanced generation creates verified relationships between students, teachers, and grades, enabling full analytics testing immediately.</p>
                </div>
             </div>
          </motion.div>
        )}

        {step === 'impact' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-12 rounded-[3.5rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-10">
             <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                   <ShieldAlert className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Firebase Impact Audit</h2>
                <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">Verify quota eligibility before commit</p>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'Grades', v: 4 },
                  { l: 'Sections', v: impact.sections },
                  { l: 'Students', v: impact.students },
                  { l: 'Writes', v: impact.writes, full: true }
                ].map((s, i) => (
                  <div key={i} className={`p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl ${s.full ? 'col-span-2 md:col-span-1' : ''}`}>
                     <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{s.l}</p>
                     <p className="text-lg font-black text-gray-900 dark:text-white">{s.v.toLocaleString()}</p>
                  </div>
                ))}
             </div>

             <div className="space-y-6">
                <div className="p-8 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden">
                   <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-6">Spark Plan Analysis</h4>
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span>Writes (Limit: 20k/day)</span>
                            <span className={getQuotaStatus(impact.writes, 20000).color + " px-2 py-0.5 rounded"}>{impact.writes.toLocaleString()} op</span>
                         </div>
                         <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((impact.writes / 20000) * 100, 100)}%` }} className={`h-full ${impact.writes > 20000 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                         </div>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-indigo-100 dark:border-indigo-900/50">
                         <span className="text-xs font-bold text-indigo-900/60 dark:text-indigo-300">Est. Generation Duration</span>
                         <span className="text-xs font-black text-indigo-900 dark:text-white">{impact.time} Minutes</span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-3 pt-6">
                <button onClick={runGeneration} className="w-full py-4 bg-gray-900 dark:bg-indigo-600 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-gray-200 dark:shadow-none transition-all">
                   Burn to Firebase
                </button>
                <button onClick={() => setStep('config')} className="w-full py-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600">
                   Abort Mission
                </button>
             </div>
          </motion.div>
        )}

        {step === 'generating' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[500px] text-center space-y-12">
             <div className="relative">
                <div className="w-32 h-32 border-8 border-gray-100 dark:border-gray-900 rounded-full" />
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 w-32 h-32 border-8 border-indigo-600 border-t-transparent rounded-full" />
                <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-indigo-600" />
             </div>
             
             <div className="space-y-4 max-w-md w-full">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{progress.task}</h2>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                   <span>Processing: {progress.current} / {progress.total}</span>
                   <span>Batch {progress.batch}</span>
                </div>
                <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-inner p-1">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-end px-3 shadow-lg shadow-indigo-500/20">
                      <span className="text-[10px] font-black text-white">{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
                   </motion.div>
                </div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic animate-pulse">Syncing with Cloud Firestore Cluster...</p>
             </div>
          </motion.div>
        )}

        {step === 'report' && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto bg-white dark:bg-gray-900 p-12 rounded-[3.5rem] border border-gray-100 dark:border-gray-800 shadow-2xl space-y-12">
             <div className="flex items-center gap-8 border-b border-gray-50 dark:border-gray-850 pb-10">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-[2rem] flex items-center justify-center text-emerald-500 shrink-0">
                   <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                   <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Generation Log: Success</h2>
                   <p className="text-gray-500 font-medium tracking-tight">Virtual environment deployed and fully indexed.</p>
                </div>
             </div>

             <div className="pt-8 flex justify-center">
                <button onClick={() => setStep('config')} className="px-12 py-4 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                   System Dashboard
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
