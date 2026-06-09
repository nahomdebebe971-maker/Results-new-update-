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

export const TeacherPortal: React.FC = () => {
  const { user, teacherId, teacherName } = useAuth();
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
  const [homeroomStudentCount, setHomeroomStudentCount] = useState<number>(0);
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
        setHomeroomStudentCount(sSnap.size);
      } else {
        setHomeroomGrade(null);
        setHomeroomStudentCount(0);
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
            className="space-y-12"
          >
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-3xl mb-6">
                <LayoutGrid className="w-8 h-8" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-4">Teaching Assignments</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-base sm:text-lg">Select a class section to start recording or updating student marks.</p>
            </div>

            {homeroomGrade && (
              <div className="bg-gradient-to-r from-indigo-550 via-indigo-600 to-indigo-750 p-6 sm:p-8 rounded-[32px] border border-indigo-100/10 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden text-white w-full">
                <div className="space-y-2 relative z-10">
                  <span className="bg-white/10 text-white border border-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-block select-none">
                    My Homeroom Class
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Grade {homeroomGrade.name}{homeroomGrade.section}</h2>
                  <p className="text-white/85 font-semibold text-sm sm:text-base">
                    Total Students assigned: <span className="font-extrabold text-white">{homeroomStudentCount}</span>
                  </p>
                </div>
                
                <button
                  onClick={handleOpenHomeroom}
                  disabled={loading}
                  className="bg-white hover:bg-neutral-100 active:scale-95 text-indigo-600 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all shrink-0 select-none cursor-pointer self-stretch md:self-auto justify-center"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                    <>
                      Manage Conduct & Attendance <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              </div>
            )}

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
