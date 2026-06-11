import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Key, Save, Loader2, 
  CheckCircle2, AlertTriangle, ChevronLeft, LayoutGrid, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade, Subject, Mark, SubjectAssignment } from '../types';
import { calculateResultsForGrade } from '../lib/resultService';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { toast } from 'react-hot-toast';

import { logAction } from '../lib/auditService';
import { trackOperation } from '../lib/metrics';
import { createNotification } from '../lib/notificationService';

export const TeacherPortal: React.FC = () => {
  const { user, teacherId, teacherName, assignedSubjects, assignedClasses, homeroomTeacherFor } = useAuth();
  const { config } = useSchoolConfig();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<SubjectAssignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { semester1: number, semester2: number, teacherId?: string }>>({});

  const [passkeyInput, setPasskeyInput] = useState('');

  // Homeroom variables
  const [homeroomGrade, setHomeroomGrade] = useState<Grade | null>(null);
  const [homeroomStats, setHomeroomStats] = useState({ total: 0, male: 0, female: 0 });
  const [homeroomStudents, setHomeroomStudents] = useState<Student[]>([]);
  const [homeroomConduct, setHomeroomConduct] = useState<Record<string, string>>({});
  const [homeroomAbsent, setHomeroomAbsent] = useState<Record<string, number>>({});
  const [savingHomeroom, setSavingHomeroom] = useState(false);
  const [saveHomeroomSuccess, setSaveHomeroomSuccess] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);

  useEffect(() => {
    if (!teacherName) return;

    const qGrades = query(collection(db, 'grades'));
    const unsubscribe = onSnapshot(qGrades, async (snap) => {
      const allGrades = snap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
      setGrades(allGrades);
      const myHomeroom = allGrades.find(g => 
        g.homeroomTeacher?.trim().toLowerCase() === teacherName.trim().toLowerCase()
      );

      if (myHomeroom) {
        setHomeroomGrade(myHomeroom);
        const qStudents = query(
          collection(db, 'students'),
          where('grade', '==', myHomeroom.name),
          where('section', '==', myHomeroom.section)
        );
        const sSnap = await getDocs(qStudents);
        const slist = sSnap.docs.map(d => d.data() as Student);
        setHomeroomStats({
          total: sSnap.size,
          male: slist.filter(s => s.sex === 'M').length,
          female: slist.filter(s => s.sex === 'F').length
        });
      } else {
        setHomeroomGrade(null);
        setHomeroomStats({ total: 0, male: 0, female: 0 });
      }
    });

    return () => unsubscribe();
  }, [teacherName]);

  useEffect(() => {
    if (!teacherId) return;

    const fetchAssignments = async () => {
      setFetching(true);
      try {
        console.log("Logged In Teacher ID:", teacherId);
        const qA = query(collection(db, 'assignments'), where('teacherId', '==', teacherId));
        const aSnap = await getDocs(qA);
        console.log("Assignments Found:", aSnap.size);
        console.log("Assignment Teacher IDs:");
        aSnap.docs.forEach(doc => {
          console.log(doc.data().teacherId);
        });
        setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectAssignment)));
      } catch (err) {
        console.error(err);
        toast.error('Failed to load assignments.');
      } finally {
        setFetching(false);
      }
    };
    fetchAssignments();
  }, [teacherId]);

  const handleSelectAssignment = (as: SubjectAssignment) => {
    setSelectedAssignment(as);
    setPasskeyInput('');
    setError('');
    setStep(2);
  };

  const handleVerify = async () => {
    if (!selectedAssignment) return;

    if (passkeyInput === selectedAssignment.passkey) {
      setLoading(true);
      try {
        await trackOperation('PORTAL_ACCESS', `Verified Marks Access for ${selectedAssignment.subjectName}`, { reads: 2 });
        // Fetch students for THIS specific assignment's grade/section
        const q2 = query(
          collection(db, 'students'),
          where('grade', '==', selectedAssignment.gradeName),
          where('section', '==', selectedAssignment.section)
        );
        const sSnap = await getDocs(q2);
        const studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        studentList.sort((a, b) => {
          const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
          const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
          return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
        });
        setStudents(studentList);

        // Fetch existing marks for THIS subject and THIS grade/section
        const qM = query(
          collection(db, 'marks'), 
          where('subjectId', '==', selectedAssignment.subjectId), 
          where('grade', '==', selectedAssignment.gradeName), 
          where('section', '==', selectedAssignment.section)
        );
        const mSnap = await getDocs(qM);
        const existingMarks: any = {};
        mSnap.docs.forEach(d => {
          const data = d.data();
          existingMarks[data.studentId] = { 
            semester1: data.semester1, 
            semester2: data.semester2,
            teacherId: data.teacherId
          };
        });
        setMarks(existingMarks);
        
        setStep(3);
      } catch (err) {
        console.error(err);
        setError('Failed to load marks data.');
      } finally {
        setLoading(false);
      }
    } else {
      setError('Invalid Passkey. Please try again.');
    }
  };

  const handleMarkChange = (studentId: string, sem: 'semester1' | 'semester2', value: string) => {
    const existingMark = marks[studentId];
    if (existingMark?.teacherId && existingMark.teacherId !== teacherId) {
      toast.error('This mark was entered by another teacher and cannot be modified by you.');
      return;
    }

    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { semester1: 0, semester2: 0, teacherId }),
        [sem]: num
      }
    }));
  };

  const saveMarks = async () => {
    if (!selectedAssignment) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const studentCount = Object.keys(marks).length;
      for (const [studentId, values] of Object.entries(marks)) {
        const studentMarks = values as { semester1: number, semester2: number, teacherId?: string };
        
        if (studentMarks.teacherId && studentMarks.teacherId !== teacherId) continue;

        const markId = `${studentId}_${selectedAssignment.subjectId}`;
        await setDoc(doc(db, 'marks', markId), {
          studentId,
          subjectId: selectedAssignment.subjectId,
          grade: selectedAssignment.gradeName,
          section: selectedAssignment.section,
          semester1: studentMarks.semester1,
          semester2: studentMarks.semester2,
          teacherId: teacherId, 
          updatedAt: new Date().toISOString()
        });
      }

      if (config) {
        await calculateResultsForGrade(selectedAssignment.gradeName, selectedAssignment.section, config);
      }

      if (user) {
        await logAction(
          user.uid, 
          user.email || '', 
          'GRADE_EDIT', 
          `Updated marks for ${selectedAssignment.subjectName} in Grade ${selectedAssignment.gradeName}${selectedAssignment.section}`,
          selectedAssignment.id
        );
      }

      await trackOperation('MARK_ENTRY', `Updated marks for ${selectedAssignment.subjectName} (${selectedAssignment.gradeName})`, { writes: studentCount + 1 });

      await createNotification({
        type: 'MARK_UPDATE',
        title: 'Marks Entered',
        message: `${teacherName} updated marks for ${selectedAssignment.subjectName} in Grade ${selectedAssignment.gradeName}${selectedAssignment.section}`,
        moduleId: `${selectedAssignment.gradeName}${selectedAssignment.section}`,
        updatedBy: teacherName || 'Teacher',
        priority: 'medium'
      });

      setSaveSuccess(true);
      toast.success('Marks saved and results updated!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHomeroom = async () => {
    if (!homeroomGrade) return;
    setLoading(true);
    try {
      await trackOperation('PORTAL_ACCESS', 'Opening Homeroom Management', { reads: 1 });
      const q = query(
        collection(db, 'students'),
        where('grade', '==', homeroomGrade.name),
        where('section', '==', homeroomGrade.section)
      );
      const sSnap = await getDocs(q);
      const sList = sSnap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          conduct: data.conduct ?? 'A',
          absent: data.absent ?? 0
        } as Student;
      });
      // Sort alphabetically A-Z
      sList.sort((a, b) => {
        const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
      });

      setHomeroomStudents(sList);

      const cond: Record<string, string> = {};
      const abs: Record<string, number> = {};
      sList.forEach(s => {
        cond[s.id] = s.conduct ?? 'A';
        abs[s.id] = s.absent ?? 0;
      });
      setHomeroomConduct(cond);
      setHomeroomAbsent(abs);

      setStep(4);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load homeroom students.');
    } finally {
      setLoading(false);
    }
  };

  const handleAbsentChange = (studentId: string, valStr: string) => {
    const clean = valStr.replace(/[^0-9]/g, '');
    const num = clean === '' ? 0 : parseInt(clean, 10);
    setHomeroomAbsent(prev => ({
      ...prev,
      [studentId]: num
    }));
  };

  const saveHomeroomData = async () => {
    if (!homeroomGrade) return;
    setSavingHomeroom(true);
    setSaveHomeroomSuccess(false);
    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const studentCount = homeroomStudents.length;
      
      for (const s of homeroomStudents) {
        const cond = homeroomConduct[s.id] ?? 'A';
        const abs = homeroomAbsent[s.id] ?? 0;
        
        await updateDoc(doc(db, 'students', s.id), {
          conduct: cond,
          absent: abs,
          updatedAt: new Date().toISOString()
        });

        const pubRef = doc(db, 'publishedResults', s.id);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          await updateDoc(pubRef, {
            conduct: cond,
            absent: abs
          });
        }
      }

      if (config) {
        await calculateResultsForGrade(homeroomGrade.name, homeroomGrade.section, config);
      }

      if (user) {
        await logAction(
          user.uid, 
          user.email || '', 
          'STUDENT_EDIT', 
          `Updated conduct and attendance for Grade ${homeroomGrade.name}${homeroomGrade.section}`,
          homeroomGrade.id
        );
      }

      await trackOperation('MARK_ENTRY', `Updated conduct/absent for Homeroom ${homeroomGrade.name}`, { writes: studentCount });

      await createNotification({
        type: 'CONDUCT_UPDATE',
        title: 'Conduct Updated',
        message: `${teacherName} updated conduct and attendance for Homeroom ${homeroomGrade.name}${homeroomGrade.section}`,
        moduleId: `${homeroomGrade.name}${homeroomGrade.section}`,
        updatedBy: teacherName || 'Teacher',
        priority: 'low'
      });

      setSaveHomeroomSuccess(true);
      toast.success('Conduct and Attendance Saved Successfully');
      setTimeout(() => setSaveHomeroomSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save Conduct and Attendance.');
    } finally {
      setSavingHomeroom(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-950 transition-colors">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">Loading assignments...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-950 transition-colors">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            {/* Professional Welcome Section */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center">
               <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shrink-0 shadow-lg shadow-indigo-100 dark:shadow-none">
                 {teacherName?.charAt(0)}
               </div>
               <div className="flex-grow space-y-1">
                 <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Welcome, Teacher {teacherName}</h1>
                 <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                   Portal Access Active <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> • {teacherId}
                 </p>
                 
                 <div className="flex flex-wrap gap-3 mt-4">
                    {assignedSubjects && assignedSubjects.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-850 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block leading-none mb-1">Subjects</span>
                        <div className="flex flex-wrap gap-x-1.5">
                          {assignedSubjects.map((s, i) => (
                            <span key={s} className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {s}{i < assignedSubjects.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {assignedClasses && assignedClasses.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-850 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block leading-none mb-1">Classes</span>
                        <div className="flex flex-wrap gap-x-1.5">
                          {assignedClasses.map((c, i) => (
                            <span key={c} className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {c}{i < assignedClasses.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
               </div>
            </div>

            {homeroomGrade && (
              <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden text-white w-full border border-white/10">
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                       <LayoutGrid className="w-4 h-4" />
                       <span className="text-xs font-black uppercase tracking-widest">My Class Information</span>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-4xl sm:text-5xl font-black tracking-tight italic">Grade {homeroomGrade.name}{homeroomGrade.section}</h2>
                      <p className="text-white/70 font-bold uppercase tracking-widest text-[10px]">Academic Year {config?.academicYear}</p>
                    </div>

                    <div className="flex gap-6 pt-2">
                       <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm min-w-24 text-center">
                          <p className="text-[10px] font-black uppercase text-white/50 mb-1">Total</p>
                          <p className="text-2xl font-black">{homeroomStats.total}</p>
                       </div>
                       <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm min-w-24 text-center">
                          <p className="text-[10px] font-black uppercase text-indigo-200 mb-1">Male</p>
                          <p className="text-2xl font-black text-indigo-300">{homeroomStats.male}</p>
                       </div>
                       <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm min-w-24 text-center">
                          <p className="text-[10px] font-black uppercase text-rose-200 mb-1">Female</p>
                          <p className="text-2xl font-black text-rose-300">{homeroomStats.female}</p>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleOpenHomeroom}
                      disabled={loading}
                      className="bg-white hover:bg-white/90 active:scale-95 text-indigo-700 p-6 rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-between transition-all select-none cursor-pointer group"
                    >
                      {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (
                        <>
                          <span>Conduct & Absent Management</span>
                          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:translate-x-2 transition-transform">
                             <ArrowRight className="w-5 h-5 text-indigo-600" />
                          </div>
                        </>
                      )}
                    </button>
                    <p className="text-white/40 text-[9px] font-bold text-center uppercase tracking-widest">
                      Changes here will reflect on the final student result documents automatically.
                    </p>
                  </div>
                </div>
                {/* Decorative background blobs */}
                <div className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-400/20 rounded-full blur-[80px] pointer-events-none" />
              </div>
            )}

            <div className="pt-4">
              <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 px-1 flex items-center gap-3">
                <LayoutGrid className="w-4 h-4" /> Grade Entry & Marksheets
              </h3>
            </div>

            {(() => {
              const visibleAssignments = assignments.filter(as => {
                const grDoc = grades.find(g => g.name === as.gradeName && g.section === as.section);
                if (grDoc && grDoc.subjectIds && grDoc.subjectIds.length > 0) {
                  return grDoc.subjectIds.includes(as.subjectId);
                }
                return true;
              });

              if (visibleAssignments.length === 0) {
                return (
                  <div className="text-center py-24 bg-gray-50 dark:bg-gray-850 rounded-[40px] border border-dashed border-gray-200 dark:border-gray-800">
                    <AlertTriangle className="w-16 h-16 text-gray-300 dark:text-gray-650 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400">No teaching assignments available</h3>
                    <p className="text-gray-400 dark:text-gray-500 mt-2 max-w-sm mx-auto font-medium">Please contact the administrator to assign subjects and grades to your account.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {visibleAssignments.map((as) => (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={as.id}
                      onClick={() => handleSelectAssignment(as)}
                      className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl dark:hover:shadow-indigo-900/10 hover:border-indigo-100 dark:hover:border-indigo-900/40 transition-all text-left flex flex-col group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-6 w-full">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white dark:group-hover:text-white transition-colors">
                          <BookOpen className="w-7 h-7" />
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-850 px-4 py-1.5 rounded-full text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest border border-gray-100 dark:border-gray-800">
                          Section {as.section}
                        </div>
                      </div>
                      
                      <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight mb-1">{as.subjectName}</h3>
                      <p className="text-gray-500 dark:text-gray-400 font-bold">Grade {as.gradeName}{as.section}</p>

                      <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-850 flex items-center justify-between w-full">
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center gap-2">
                          Enter Marks <ArrowRight className="w-4 h-4" />
                        </span>
                        <Users className="w-5 h-5 text-gray-255 dark:text-gray-750" />
                      </div>

                      {/* Gradient hint */}
                      <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}

        {step === 2 && selectedAssignment && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto w-full px-2"
          >
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-2xl dark:shadow-none space-y-8">
              <div className="text-center">
                <div className="inline-flex p-5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-3xl mb-6">
                  <Key className="w-10 h-10" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-2">Access Restricted</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium font-sans text-sm sm:text-base">
                  Enter the administrative passkey for <br />
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedAssignment.subjectName} ({selectedAssignment.gradeName}{selectedAssignment.section})</span>
                </p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 text-sm font-bold rounded-2xl border border-red-105 dark:border-red-900/30 flex items-center gap-3"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Class Passkey</label>
                <input 
                  type="password"
                  autoFocus
                  className="w-full p-4 sm:p-5 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white dark:focus:bg-gray-900 transition-all text-xl font-mono text-center tracking-widest placeholder:tracking-normal placeholder:font-sans"
                  placeholder="••••••••"
                  value={passkeyInput}
                  onChange={(e) => {
                    setPasskeyInput(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-full sm:w-24 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold transition-all order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  disabled={!passkeyInput || loading}
                  onClick={handleVerify}
                  className="w-full sm:flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 order-1 sm:order-2"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirm Access'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && selectedAssignment && (
          <motion.div
            key="step3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 animate-fade-in"
          >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
              <div className="relative z-10 w-full lg:w-auto">
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-3 hover:translate-x-1 transition-transform"
                >
                  <ChevronLeft className="w-4 h-4" /> Switch Assignment
                </button>
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                  {selectedAssignment.subjectName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-gray-500 dark:text-gray-400 font-bold">
                   <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs">Grade {selectedAssignment.gradeName}{selectedAssignment.section}</div>
                   <span className="hidden sm:inline">•</span>
                   <span className="text-sm">Classroom Records Entry</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10 w-full lg:w-auto">
                <AnimatePresence>
                  {saveSuccess && (
                     <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-6 py-3 rounded-2xl text-sm font-bold border border-green-100 dark:border-green-900/30 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Saved & Processed
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={saveMarks}
                  disabled={saving}
                  className="bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-base font-black shadow-xl dark:shadow-none flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Finalize Marks
                </button>
              </div>

              {/* Decorative background element */}
              <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[32px] sm:rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[700px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Student</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Identity Info</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest w-40 text-center">Semester 01</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest w-40 text-center">Semester 02</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Academic Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-850/60">
                  {students.map(student => {
                    const m = marks[student.studentId] || { semester1: 0, semester2: 0 };
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/55 dark:hover:bg-gray-850/30 transition-colors group">
                        <td className="px-6 sm:px-10 py-5">
                           <div className="flex flex-col">
                             <span className="font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base sm:text-lg">{student.name}</span>
                             <span className="text-gray-450 dark:text-gray-500 text-xs font-bold font-sans uppercase tracking-widest">{student.sex === 'M' ? 'Male' : 'Female'} • Age {student.age}</span>
                           </div>
                        </td>
                        <td className="px-6 sm:px-10 py-5">
                           <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-mono font-black text-gray-500 dark:text-gray-400 tracking-wider font-bold">{student.studentId}</code>
                        </td>
                        <td className="px-6 sm:px-10 py-5 text-center">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester1} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester1', e.target.value)}
                            className="w-20 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 text-gray-900 dark:text-white rounded-2xl text-center text-base sm:text-lg font-black focus:ring-4 focus:ring-indigo-100/30 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all group-hover:border-gray-200 dark:group-hover:border-gray-700" 
                          />
                        </td>
                        <td className="px-6 sm:px-10 py-5 text-center">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester2} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester2', e.target.value)}
                            className="w-20 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 text-gray-900 dark:text-white rounded-2xl text-center text-base sm:text-lg font-black focus:ring-4 focus:ring-indigo-100/30 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all group-hover:border-gray-250 dark:group-hover:border-gray-700" 
                          />
                        </td>
                        <td className="px-6 sm:px-10 py-5 text-right">
                          <span className={`text-xl sm:text-2xl font-black tabular-nums ${(((m.semester1 ?? 0) + (m.semester2 ?? 0)) / 2) >= (config?.passMark || 50) ? 'text-green-650' : 'text-red-500'}`}>
                            {(((m.semester1 ?? 0) + (m.semester2 ?? 0)) / 2).toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-10 py-32 text-center text-gray-300 dark:text-gray-650 font-black uppercase tracking-widest italic opacity-50">
                         No student profiles found for this class section
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {step === 4 && homeroomGrade && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
              <div className="relative z-10 w-full lg:w-auto">
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-3 hover:translate-x-1 transition-transform cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Return Dashboard
                </button>
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                  Conduct & Attendance Management
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-gray-500 dark:text-gray-400 font-bold">
                   <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs">
                     Grade {homeroomGrade.name}{homeroomGrade.section} Homeroom
                   </div>
                   <span className="hidden sm:inline">•</span>
                   <span className="text-sm">Default: Conduct = A, Absent = 0</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10 w-full lg:w-auto">
                <AnimatePresence>
                  {saveHomeroomSuccess && (
                     <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-6 py-3 rounded-2xl text-sm font-bold border border-green-100 dark:border-green-905/30 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Conduct and Attendance Saved Successfully
                     </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={saveHomeroomData}
                  disabled={savingHomeroom}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-base font-black shadow-xl dark:shadow-none flex items-center justify-center gap-3 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingHomeroom ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>

              {/* Decorative background element */}
              <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[32px] sm:rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[700px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center w-20">Roll No</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest w-40">Student ID</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Student Name</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center w-24">Sex</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center w-24">Age</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest w-48 text-center">Conduct (Amala)</th>
                    <th className="px-6 sm:px-10 py-5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest w-48 text-center">Absent (Hafte)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-850/60">
                  {homeroomStudents.map((student, index) => {
                    const cond = homeroomConduct[student.id] ?? 'A';
                    const abs = homeroomAbsent[student.id] ?? 0;
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/55 dark:hover:bg-gray-850/30 transition-colors group">
                        <td className="px-6 py-5 text-center font-mono font-bold text-gray-400 dark:text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-6 py-5">
                          <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-wider">
                            {student.studentId}
                          </code>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base sm:text-lg">
                            {student.name}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center text-gray-500 dark:text-gray-400 font-bold text-sm">
                          {student.sex}
                        </td>
                        <td className="px-6 py-5 text-center text-gray-500 dark:text-gray-400 font-bold text-sm">
                          {student.age}
                        </td>
                        <td className="px-6 sm:px-10 py-5 text-center">
                          <div className="flex justify-center">
                            <select
                              value={cond}
                              onChange={(e) => setHomeroomConduct(prev => ({ ...prev, [student.id]: e.target.value }))}
                              className="bg-gray-55 border border-black/10 text-gray-950 font-black text-sm rounded-xl focus:ring-4 focus:ring-indigo-100 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all w-28 py-3 text-center cursor-pointer"
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                              <option value="F">F</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 sm:px-10 py-5 text-center">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={abs}
                              onChange={(e) => handleAbsentChange(student.id, e.target.value)}
                              className="w-24 p-3 bg-gray-50 dark:bg-gray-850 border border-black/10 text-gray-900 dark:text-white rounded-2xl text-center text-base sm:text-lg font-black focus:ring-4 focus:ring-indigo-100/30 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-mono"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {homeroomStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-10 py-32 text-center text-gray-300 dark:text-gray-650 font-black uppercase tracking-widest italic opacity-50">
                         No student list loaded for your homeroom class
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
