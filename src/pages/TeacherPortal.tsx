import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Key, Save, Loader2, 
  CheckCircle2, AlertTriangle, ChevronLeft, Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade, Subject, Mark } from '../types';
import { calculateResultsForGrade } from '../lib/resultService';
import { useSchoolConfig } from '../hooks/useSchoolConfig';

export const TeacherPortal: React.FC = () => {
  const { teacherId } = useAuth();
  const { config } = useSchoolConfig();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { semester1: number, semester2: number }>>({});

  const [selection, setSelection] = useState({
    grade: '',
    subject: '',
    passkey: ''
  });

  useEffect(() => {
    const fetchMeta = async () => {
      const gSnap = await getDocs(collection(db, 'grades'));
      setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
      const sSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    };
    fetchMeta();
  }, []);

  const handleVerify = async () => {
    const sub = subjects.find(s => s.name === selection.subject);
    if (sub && sub.passkey === selection.passkey) {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'students'), 
          where('grade', '==', selection.grade.replace(/[A-Z]/g, '')), // Simplified grade comparison
          where('section', '==', selection.grade.match(/[A-Z]/)?.[0] || '')
        );
        // Wait, GradeManagement stores name+section separately? 
        // Let's check selection.grade. 
        // Better: filter students by matching grade name and section exactly.
        const [gName, gSec] = [selection.grade.replace(/[^0-9]/g, ''), selection.grade.replace(/[0-9]/g, '')];
        
        const q2 = query(
          collection(db, 'students'),
          where('grade', '==', gName),
          where('section', '==', gSec)
        );
        const sSnap = await getDocs(q2);
        const studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(studentList);

        // Fetch existing marks
        const mSnap = await getDocs(query(collection(db, 'marks'), where('subjectId', '==', selection.subject)));
        const existingMarks: any = {};
        mSnap.docs.forEach(d => {
          const data = d.data();
          existingMarks[data.studentId] = { semester1: data.semester1, semester2: data.semester2 };
        });
        setMarks(existingMarks);
        
        setStep(3);
      } catch (err) {
        console.error(err);
        setError('Failed to load students.');
      } finally {
        setLoading(false);
      }
    } else {
      setError('Invalid passkey for this subject.');
    }
  };

  const handleMarkChange = (studentId: string, sem: 'semester1' | 'semester2', value: string) => {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { semester1: 0, semester2: 0 }),
        [sem]: num
      }
    }));
  };

  const saveMarks = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const [gName, gSec] = [selection.grade.replace(/[^0-9]/g, ''), selection.grade.replace(/[0-9]/g, '')];

      for (const [studentId, values] of Object.entries(marks)) {
        const studentMarks = values as { semester1: number, semester2: number };
        const markId = `${studentId}_${selection.subject}`;
        await setDoc(doc(db, 'marks', markId), {
          studentId,
          subjectId: selection.subject,
          grade: gName,
          section: gSec,
          semester1: studentMarks.semester1,
          semester2: studentMarks.semester2,
          updatedAt: new Date().toISOString()
        });
      }

      // Trigger recalculation for the entire grade
      if (config) {
        await calculateResultsForGrade(gName, config);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="max-w-xl mx-auto space-y-8"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Select Classroom</h2>
              <p className="text-gray-500 mt-2">Pick the grade and subject you are grading today.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Grade & Section</label>
                <select 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all appearance-none"
                  value={selection.grade}
                  onChange={(e) => setSelection({ ...selection, grade: e.target.value })}
                >
                  <option value="">Select Grade</option>
                  {grades.map(g => (
                    <option key={g.id} value={`${g.name}${g.section}`}>Grade {g.name}{g.section}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Subject</label>
                <select 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all appearance-none"
                  value={selection.subject}
                  onChange={(e) => setSelection({ ...selection, subject: e.target.value })}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <button
                disabled={!selection.grade || !selection.subject}
                onClick={() => setStep(2)}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="max-w-xl mx-auto space-y-8"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Key className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Access Verification</h2>
              <p className="text-gray-500 mt-2">Enter the passkey for {selection.subject} ({selection.grade}).</p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Subject Passkey</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  placeholder="••••••••"
                  value={selection.passkey}
                  onChange={(e) => {
                    setSelection({ ...selection, passkey: e.target.value });
                    setError('');
                  }}
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/3 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all font-sans"
                >
                  Back
                </button>
                <button
                  disabled={!selection.passkey || loading}
                  onClick={handleVerify}
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Verify Access'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-2 hover:translate-x-1 transition-transform"
                >
                  <ChevronLeft className="w-4 h-4" /> Change Class
                </button>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                  Marks Entry: <span className="text-indigo-600">{selection.subject} - {selection.grade}</span>
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border border-green-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> All Changes Saved
                  </div>
                )}
                <button 
                  onClick={saveMarks}
                  disabled={saving}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-gray-200 flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                  Save Everything
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student ID</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest w-40">Semester 1</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest w-40">Semester 2</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map(student => {
                    const m = marks[student.studentId] || { semester1: 0, semester2: 0 };
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-4 font-bold text-gray-900 whitespace-nowrap">{student.name}</td>
                        <td className="px-8 py-4 text-sm font-mono text-gray-500">{student.studentId}</td>
                        <td className="px-8 py-4">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester1} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester1', e.target.value)}
                            className="w-20 p-2 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold focus:ring-2 focus:ring-indigo-600 outline-none" 
                          />
                        </td>
                        <td className="px-8 py-4">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={m.semester2} 
                            onChange={(e) => handleMarkChange(student.studentId, 'semester2', e.target.value)}
                            className="w-20 p-2 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold focus:ring-2 focus:ring-indigo-600 outline-none" 
                          />
                        </td>
                        <td className="px-8 py-4">
                          <span className={`text-lg font-black ${((m.semester1 + m.semester2) / 2) >= (config?.passMark || 50) ? 'text-green-600' : 'text-red-600'}`}>
                            {((m.semester1 + m.semester2) / 2).toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium">No students found in this class.</td>
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
