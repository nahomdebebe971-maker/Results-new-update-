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

export const TeacherPortal: React.FC = () => {
  const { teacherId } = useAuth();
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

  useEffect(() => {
    if (!teacherId) return;

    const fetchAssignments = async () => {
      setFetching(true);
      try {
        const qA = query(collection(db, 'assignments'), where('teacherId', '==', teacherId));
        const aSnap = await getDocs(qA);
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

  if (fetching) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading assignments...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
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
              <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-2xl mb-6">
                <LayoutGrid className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-4">Teaching Assignments</h1>
              <p className="text-gray-500 font-medium text-lg">Select a class section to start recording or updating student marks.</p>
            </div>

            {assignments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {assignments.map((as) => (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={as.id}
                    onClick={() => handleSelectAssignment(as)}
                    className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all text-left flex flex-col group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <BookOpen className="w-7 h-7" />
                      </div>
                      <div className="bg-gray-50 px-4 py-1.5 rounded-full text-xs font-black text-gray-400 uppercase tracking-widest border border-gray-100">
                        Section {as.section}
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 leading-tight mb-1">{as.subjectName}</h3>
                    <p className="text-gray-500 font-bold">Grade {as.gradeName}{as.section}</p>

                    <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-indigo-600 font-black text-sm flex items-center gap-2">
                        Enter Marks <ArrowRight className="w-4 h-4" />
                      </span>
                      <Users className="w-5 h-5 text-gray-200" />
                    </div>

                    {/* Gradient hint */}
                    <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-600">No teaching assignments available</h3>
                <p className="text-gray-400 mt-2 max-w-sm mx-auto font-medium">Please contact the administrator to assign subjects and grades to your account.</p>
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && selectedAssignment && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-2xl shadow-indigo-100/50 space-y-8">
              <div className="text-center">
                <div className="inline-flex p-5 bg-orange-50 text-orange-600 rounded-3xl mb-6">
                  <Key className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Access Restricted</h2>
                <p className="text-gray-500 font-medium font-sans">
                  Enter the administrative passkey for <br />
                  <span className="text-indigo-600 font-black">{selectedAssignment.subjectName} ({selectedAssignment.gradeName}{selectedAssignment.section})</span>
                </p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-100 flex items-center gap-3"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Class Passkey</label>
                <input 
                  type="password"
                  autoFocus
                  className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all text-xl font-mono text-center tracking-widest placeholder:tracking-normal placeholder:font-sans"
                  placeholder="••••••••"
                  value={passkeyInput}
                  onChange={(e) => {
                    setPasskeyInput(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-24 py-5 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!passkeyInput || loading}
                  onClick={handleVerify}
                  className="flex-grow py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:translate-y-[-2px] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
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
            className="space-y-8"
          >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest mb-3 hover:translate-x-1 transition-transform"
                >
                  <ChevronLeft className="w-4 h-4" /> Switch Assignment
                </button>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-1">
                  {selectedAssignment.subjectName}
                </h2>
                <div className="flex items-center gap-2 text-gray-500 font-bold">
                   <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs">Grade {selectedAssignment.gradeName}{selectedAssignment.section}</div>
                   <span>•</span>
                   <span className="text-sm">Classroom Records Entry</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 relative z-10">
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-green-50 text-green-700 px-6 py-3 rounded-2xl text-sm font-bold border border-green-100 flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Saved & Processed
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={saveMarks}
                  disabled={saving}
                  className="bg-gray-900 text-white px-8 py-4 rounded-2xl text-base font-black shadow-xl shadow-gray-200 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Finalize Marks
                </button>
              </div>

              {/* Decorative background element */}
              <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest uppercase">Student</th>
                    <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">Identity Info</th>
                    <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest w-48 text-center text-indigo-600">Semester 01</th>
                    <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest w-48 text-center text-indigo-600">Semester 02</th>
                    <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Academic Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map(student => {
                    const m = marks[student.studentId] || { semester1: 0, semester2: 0 };
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-10 py-6">
                           <div className="flex flex-col">
                             <span className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors text-lg">{student.name}</span>
                             <span className="text-gray-400 text-xs font-bold font-sans uppercase tracking-widest">{student.sex === 'M' ? 'Male' : 'Female'} • Age {student.age}</span>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                           <code className="bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-mono font-black text-gray-500 tracking-wider ">{student.studentId}</code>
                        </td>
                        <td className="px-10 py-6">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester1} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester1', e.target.value)}
                            className="w-24 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center text-lg font-black focus:ring-4 focus:ring-indigo-100 focus:bg-white outline-none transition-all group-hover:border-gray-200" 
                          />
                        </td>
                        <td className="px-10 py-6">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester2} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester2', e.target.value)}
                            className="w-24 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center text-lg font-black focus:ring-4 focus:ring-indigo-100 focus:bg-white outline-none transition-all group-hover:border-gray-200" 
                          />
                        </td>
                        <td className="px-10 py-6 text-right">
                          <span className={`text-2xl font-black tabular-nums ${((m.semester1 + m.semester2) / 2) >= (config?.passMark || 50) ? 'text-green-600' : 'text-red-500'}`}>
                            {((m.semester1 + m.semester2) / 2).toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-10 py-32 text-center text-gray-300 font-black uppercase tracking-widest italic opacity-50">
                         No student profiles found for this class section
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
