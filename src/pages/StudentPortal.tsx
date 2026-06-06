import React, { useState, useEffect } from 'react';
import { Search, Download, FileText, ChevronRight, AlertCircle, Loader2, Award, Sparkles, BookOpen, User } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, SemesterSummary, Grade, Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { generateStudentTranscript } from '../lib/pdfGenerator';
import { useNavigation } from '../context/NavigationContext';
import { toast } from 'react-hot-toast';

export const StudentPortal: React.FC = () => {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { config } = useSchoolConfig();
  const { navigateTo } = useNavigation();

  // Queue states
  const [inQueue, setInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [studentsAhead, setStudentsAhead] = useState(0);
  const [waitTime, setWaitTime] = useState(0);
  const [queueStatus, setQueueStatus] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'subjects'));
        setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      } catch (err) {
        console.error("Error fetching subjects in student portal:", err);
      }
    };
    fetchSubjects();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !studentName.trim()) {
      setError('Please provide both your identity PIN and your registered full name.');
      return;
    }

    setLoading(true);
    setError('');
    setStudent(null);
    setInQueue(false);

    try {
      // 1. Fetch cache version
      const docRef = doc(db, 'systemConfiguration', 'cacheVersion');
      const snap = await getDoc(docRef);
      const currentVersion = snap.exists() ? (snap.data()?.version || 1) : 1;

      // 2. Fetch traffic threshold
      const trafficRef = doc(db, 'systemConfiguration', 'traffic');
      const tSnap = await getDoc(trafficRef);
      if (!tSnap.exists()) {
        // Initialize default traffic configuration (no queue by default)
        await setDoc(trafficRef, { activeRequests: 0, maxActiveRequests: 50 });
      }
      const trafficData = tSnap.exists() ? tSnap.data() : { activeRequests: 0, maxActiveRequests: 50 };
      const activeRequests = trafficData.activeRequests || 0;
      const maxActiveRequests = trafficData.maxActiveRequests || 50;

      // 3. Check sessionStorage cache
      const cachedDataStr = sessionStorage.getItem('student_result_cache');
      let cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : null;

      if (cachedData && cachedData.version === currentVersion) {
        const cachedStudent = cachedData.results[studentId.trim().toUpperCase()];
        if (cachedStudent) {
          // Verify name match (case-insensitive)
          const recordName = (cachedStudent.studentName || cachedStudent.name || '').trim().toUpperCase();
          const inputName = studentName.trim().toUpperCase();
          
          if (recordName === inputName || recordName.includes(inputName) || inputName.includes(recordName)) {
            setStudent(cachedStudent);
            toast.success("Results loaded.......");
            setLoading(false);
            return;
          } else {
            setError('The student name entered does not match our records for this Student ID.');
            setLoading(false);
            return;
          }
        }
      } else {
        // Reset cache with matching version if old or empty
        cachedData = { version: currentVersion, results: {} };
      }

      // Cache Miss: Run fetch flow
      const executeFetch = async () => {
        setLoading(true);
        try {
          const pubDocRef = doc(db, 'publishedResults', studentId.trim().toUpperCase());
          const pubSnap = await getDoc(pubDocRef);

          if (pubSnap.exists()) {
            const studentData = pubSnap.data() as any;
            
            // Verify name match (case-insensitive)
            const recordName = (studentData.studentName || studentData.name || '').trim().toUpperCase();
            const inputName = studentName.trim().toUpperCase();
            
            if (recordName === inputName || recordName.includes(inputName) || inputName.includes(recordName)) {
              setStudent(studentData);
              
              // Save to sessionStorage cache
              const updatedResults = {
                ...cachedData.results,
                [studentId.trim().toUpperCase()]: studentData
              };
              sessionStorage.setItem('student_result_cache', JSON.stringify({
                version: currentVersion,
                results: updatedResults
              }));
              
              toast.success("Result retrieved successfully!");
            } else {
              setError('The student name entered does not match our records for this Student ID.');
            }
          } else {
            setError('The student ID was not registered in our published results records or is not published yet.');
          }
        } catch (err) {
          console.error(err);
          setError('A secure records query timeout occurred. Please re-search.');
        } finally {
          setLoading(false);
        }
      };

      // 4. Determine if we should trigger High Volume Queue Mode
      if (activeRequests > maxActiveRequests) {
        setInQueue(true);
        setQueueStatus("Connecting to result server...");
        const startPos = (activeRequests - maxActiveRequests) + Math.floor(Math.random() * 4) + 2; // e.g. 10
        setQueuePosition(startPos);
        setStudentsAhead(startPos - 1);
        setWaitTime((startPos - 1) * 2);

        const countdown = setInterval(() => {
          setQueuePosition(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              setInQueue(false);
              executeFetch();
              return 0;
            }
            const nextPos = prev - 1;
            setStudentsAhead(nextPos - 1);
            setWaitTime(Math.max(0, (nextPos - 1) * 2));

            const progress = nextPos / startPos;
            if (progress > 0.65) {
              setQueueStatus("Connecting to result server...");
            } else if (progress > 0.3) {
              setQueueStatus("Checking student record...");
            } else {
              setQueueStatus("Loading published result...");
            }
            return nextPos;
          });
        }, 1200);
      } else {
        // Direct Query
        await executeFetch();
      }

    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check internet access or retry.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-[32px] sm:rounded-[40px] shadow-2xl dark:shadow-none p-6 sm:p-10 border border-gray-100 dark:border-gray-850/80 transition-colors"
      >
        <div className="text-center mb-10 max-w-xl mx-auto">
          <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-3xl mb-6">
            <Award className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-3">
            Chercher Secondary School
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm sm:text-base">
            Secure Student Transcript & Records Portal. Enter your official details to retrieve marks sheet details.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Identity PIN (e.g. ST123456)"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-base sm:text-lg font-mono font-bold tracking-wider placeholder:tracking-normal placeholder:font-sans"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 w-5 h-5" />
            </div>

            <div className="relative">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Student Registered Name"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-base sm:text-lg font-bold placeholder:font-normal"
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 w-5 h-5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || inQueue}
            className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider relative overflow-hidden active:scale-98 shadow-md"
          >
            {loading || inQueue ? <Loader2 className="animate-spin w-5 h-5" /> : 'Search Result'}
          </button>
        </form>


        <AnimatePresence>
          {inQueue && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center p-8 bg-indigo-50/25 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/50 rounded-3xl mb-8 space-y-4"
            >
              <Loader2 className="animate-spin w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              <div className="text-center">
                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">{queueStatus}</h3>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">High traffic query server load mitigation queue. Do not close this tab.</p>
              </div>
              <div className="flex gap-6 text-center pt-2 w-full max-w-sm justify-around">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Position</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">#{queuePosition}</p>
                </div>
                <div className="w-px bg-gray-200 dark:bg-gray-800" />
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Ahead of you</p>
                  <p className="text-2xl font-black text-gray-700 dark:text-gray-300 font-mono">{studentsAhead}</p>
                </div>
                <div className="w-px bg-gray-200 dark:bg-gray-800" />
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Est. Wait</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{waitTime}s</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-5 rounded-2xl flex items-start sm:items-center gap-3 border border-red-100 dark:border-red-900/30"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
              <p className="text-sm font-bold leading-tight">{error}</p>
            </motion.div>
          )}

          {student && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-4"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-indigo-50/40 dark:bg-indigo-950/20 p-6 sm:p-8 rounded-3xl border border-indigo-100/30 dark:border-indigo-950/50">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest leading-none">Registered Student</span>
                    <Sparkles className="w-4 h-4 text-orange-400" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none">{student.name}</h2>
                  <p className="text-gray-500 dark:text-gray-400 font-bold mt-1 text-sm sm:text-base">Identity Pin: <span className="font-mono text-gray-600 dark:text-gray-200">{student.studentId}</span> • Grade Section {student.grade}{student.section}</p>
                </div>
                <button 
                  onClick={async () => {
                    if (config && student && !downloading) {
                      setDownloading(true);
                      try {
                        await generateStudentTranscript(student, config, subjects);
                      } catch (err) {
                        console.error('Failed to download transcript:', err);
                      } finally {
                        setDownloading(false);
                      }
                    }
                  }}
                  disabled={downloading}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-75 focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download Transcript PDF
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <ResultCard title="Semester 01 Summary" data={student.semester1} accent="indigo" />
                <ResultCard title="Semester 02 Summary" data={student.semester2} accent="blue" />
                <ResultCard title="Final Academic Status" data={student.final} accent="emerald" />
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden overflow-x-auto shadow-sm">
                <table className="w-full text-left min-w-[550px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-6 py-4.5 text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest">Subject Academic Course</th>
                      <th className="px-6 py-4.5 text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest text-center w-32">Sem 1</th>
                      <th className="px-6 py-4.5 text-xs font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest text-center w-32">Sem 1</th>
                      <th className="px-6 py-4.5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-right w-40">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-840/60">
                    {(student as any).subjects && (student as any).subjects.length > 0 ? (
                      (student as any).subjects.map((sub: any) => (
                        <tr key={sub.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-850/20 transition-colors group">
                          <td className="px-6 py-4 font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 transition-colors">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            {sub.name}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 font-mono font-bold">{sub.semester1}</td>
                          <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 font-mono font-bold">{sub.semester2}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-lg font-black font-mono tracking-tight ${sub.average >= (config?.passMark || 50) ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                              {sub.average.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      Object.entries(student.results || {}).map(([subId, m]) => {
                        const marks = m as { semester1: number; semester2: number; average: number };
                        const subjectName = subjects.find(s => s.id === subId || s.name === subId)?.name || subId;
                        return (
                          <tr key={subId} className="hover:bg-gray-50/40 dark:hover:bg-gray-850/20 transition-colors group">
                            <td className="px-6 py-4 font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 transition-colors">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              {subjectName}
                            </td>
                            <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 font-mono font-bold">{marks.semester1}</td>
                            <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 font-mono font-bold">{marks.semester2}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-lg font-black font-mono tracking-tight ${(marks.average ?? 0) >= (config?.passMark || 50) ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                {(marks.average ?? 0).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && !student && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-600" />
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px]">Accessing student ledger...</p>
          </div>
        )}

        {!student && !loading && (
          <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800/60 grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">About Chercher Secondary</h3>
              <p className="text-xs text-gray-550 dark:text-gray-400 font-medium leading-relaxed">
                Chercher Secondary School is committed to academic rigor, integrity, and fostering state-of-the-art educational technologies to streamline record preservation and grades retrieval.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Technical Authority</h3>
              <p className="text-xs text-gray-555 dark:text-gray-400 font-medium leading-relaxed">
                Developed in coordination with our development partner <strong>Ramoda Technologies</strong>. Discover founder credentials and support channels on our{' '}
                <button
                  type="button"
                  onClick={() => navigateTo('developer')}
                  className="text-indigo-600 hover:text-indigo-750 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline outline-none cursor-pointer"
                >
                  Developer Information page
                </button>.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const ResultCard = ({ title, data, accent }: { title: string, data?: SemesterSummary, accent: 'indigo' | 'blue' | 'emerald' }) => {
  const bgStyles = {
    indigo: 'border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/15',
    blue: 'border-blue-100 dark:border-blue-950 bg-blue-50/10 dark:bg-blue-950/15',
    emerald: 'border-emerald-100 dark:border-emerald-950 bg-emerald-50/10 dark:bg-emerald-950/15'
  };

  const textStyles = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400'
  };

  return (
    <div className={`p-6 rounded-3xl border ${bgStyles[accent]} shadow-sm transition-all relative overflow-hidden group`}>
      <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-4 tracking-widest">{title}</h3>
      {data ? (
        <div className="space-y-3 relative z-10">
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter font-mono">{(data.average ?? 0).toFixed(1)}%</span>
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl uppercase tracking-wider ${data.status === 'Pass' ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-150 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/30'}`}>
              {data.status}
            </span>
          </div>
          <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-450 pt-2 border-t border-gray-100/50 dark:border-gray-800">
            <span>Rank: #{data.rank}</span>
            <span>Total Point: {data.total}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 dark:text-gray-550 text-sm font-bold italic py-2">Records Pending</p>
      )}
    </div>
  );
};
