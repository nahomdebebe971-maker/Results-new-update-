import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, FileText, ChevronRight, AlertCircle, Loader2, Award, Sparkles, BookOpen, User, Camera, X } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, SemesterSummary, Grade, Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { generateStudentTranscript } from '../lib/pdfGenerator';
import { useNavigation } from '../context/NavigationContext';
import { toast } from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

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

  // Search option and QR Code Scanner variables
  const [searchMethod, setSearchMethod] = useState<'id' | 'qr'>('id');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'detected' | 'searching'>('idle');
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scanRegionId = "student-qr-reader-container";

  // Top rankings states
  const [topRankingsPublished, setTopRankingsPublished] = useState(false);
  const [topRankingsList, setTopRankingsList] = useState<any[]>([]);

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
      } catch (err: any) {
        console.error("Error fetching subjects in student portal:", err);
        if (err.code === 'unavailable') {
          setError('The system is currently unable to reach the results database. Please check your internet connection or try again later.');
        }
      }
    };
    fetchSubjects();
  }, []);

  // Fetch top rankings status
  useEffect(() => {
    const fetchTopRankings = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfiguration', 'topStudentsRanking'));
        if (snap.exists()) {
          const data = snap.data();
          setTopRankingsPublished(data.published || false);
          setTopRankingsList(data.students || []);
        }
      } catch (err: any) {
        console.error("Failed to fetch published top students:", err);
        if (err.code === 'unavailable') {
          // This is often transient, so we don't necessarily need a hard error page yet
          console.warn("Top rankings unavailable due to network.");
        }
      }
    };
    fetchTopRankings();
  }, [student]);

  const deactivateScanner = async () => {
    if (qrScannerRef.current) {
      if (qrScannerRef.current.isScanning) {
        try {
          await qrScannerRef.current.stop();
        } catch (err) {
          console.warn('Error stopping student QR scanner:', err);
        }
      }
      qrScannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const extractStudentIdFromQR = (text: string): string => {
    let trimmed = text.trim();
    // Handle URL hashes if present
    if (trimmed.includes('#verify-')) {
      const parts = trimmed.split('#verify-');
      trimmed = parts[parts.length - 1];
    }
    
    // Split by common delimiters like hyphens
    const parts = trimmed.split('-');
    
    // 1. Look for a part that starts with 'ST' or 'STU' (e.g., TRX-ST502321-2016)
    const stPart = parts.find(p => p.trim().toUpperCase().startsWith('ST'));
    if (stPart) return stPart.trim().toUpperCase();

    // 2. Handle ID-xxxx or TRX-xxxx patterns specifically
    if (parts.length >= 2) {
      const firstPart = parts[0].toUpperCase();
      if (firstPart === 'ID' || firstPart === 'TRX') {
        const secondPart = parts[1].trim().toUpperCase();
        // If it starts with numeric, it's likely the ID if no ST part was found
        if (/[0-9]/.test(secondPart)) return secondPart;
      }
    }

    // 3. Fallback to full trimmed upper case if it matches ID pattern
    return trimmed.toUpperCase();
  };

  const getRecommendation = (average: number): string => {
    if (average >= 90) return 'Excellent Performance (Dandeettii Olaana)';
    if (average >= 80) return 'Very Good Performance (Dandeettii Gaarii Olaana)';
    if (average >= 75) return 'Good Performance (Dandeettii Gaarii)';
    if (average >= 65) return 'Satisfactory Performance (Dandeettii Giddu-galeessa)';
    if (average >= 50) return 'Needs Improvement (Gargaarsa Barbaada)';
    return 'Poor Performance (Gargaarsa Olaana Barbaada)';
  };

  const [searchCount, setSearchCount] = useState(0);

  const checkRateLimit = () => {
    const limit = 20;
    const windowMs = 60 * 1000;
    const now = Date.now();
    const rateDataStr = localStorage.getItem('student_search_ratelimit');
    let rateData = rateDataStr ? JSON.parse(rateDataStr) : { count: 0, firstRequest: now };

    if (now - rateData.firstRequest > windowMs) {
      rateData = { count: 1, firstRequest: now };
    } else {
      rateData.count += 1;
    }

    localStorage.setItem('student_search_ratelimit', JSON.stringify(rateData));

    if (rateData.count > limit) {
      const waitSec = Math.ceil((windowMs - (now - rateData.firstRequest)) / 1000);
      setError(`Rate limit exceeded. Please wait ${waitSec} seconds before searching again.`);
      return false;
    }
    return true;
  };

  const performUnifiedSearch = async (providedId: string, providedName?: string, isFromQR = false) => {
    if (!checkRateLimit()) return;
    
    const targetId = providedId.trim().toUpperCase();
    const targetName = providedName?.trim().toUpperCase();

    if (!isFromQR && (!targetId || !targetName)) {
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
      const trafficData = tSnap.exists() ? tSnap.data() : { activeRequests: 0, maxActiveRequests: 50 };
      const activeRequests = trafficData.activeRequests || 0;
      const maxActiveRequests = trafficData.maxActiveRequests || 50;

      // 3. Virtual Queue logic for high demand
      if (activeRequests >= maxActiveRequests) {
        setInQueue(true);
        const waitTime = Math.floor(Math.random() * 5000) + 2000; // 2-7 second wait
        await new Promise(resolve => setTimeout(resolve, waitTime));
        setInQueue(false);
      }

      // 3. Check sessionStorage cache if not QR (QR ignores name verification so cache might be incomplete)
      if (!isFromQR) {
        const cachedDataStr = sessionStorage.getItem('student_result_cache');
        let cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : null;
        if (cachedData && cachedData.version === currentVersion) {
          const cachedStudent = cachedData.results[targetId];
          if (cachedStudent) {
            const recordName = (cachedStudent.studentName || cachedStudent.name || '').trim().toUpperCase();
            if (recordName === targetName || recordName.includes(targetName!) || targetName!.includes(recordName)) {
              setStudent(cachedStudent);
              toast.success("Results loaded from cache.");
              setLoading(false);
              return;
            }
          }
        }
      }

      // CORE FETCH LOGIC
      const executeFetch = async () => {
        setLoading(true);
        try {
          // Check if result exists
          const pubDocRef = doc(db, 'publishedResults', targetId);
          const pubSnap = await getDoc(pubDocRef);

          if (pubSnap.exists()) {
            const studentData = pubSnap.data() as any;
            const recordName = (studentData.studentName || studentData.name || '').trim().toUpperCase();
            
            // Name verification (skipped for QR)
            if (isFromQR || (targetName && (recordName === targetName || recordName.includes(targetName) || targetName.includes(recordName)))) {
              setStudent(studentData);
              
              // Update name state for UI consistency if QR scan
              if (isFromQR) {
                setStudentName(studentData.name || studentData.studentName || '');
              }

              // Update cache
              const cachedDataStr = sessionStorage.getItem('student_result_cache');
              let cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : { version: currentVersion, results: {} };
              cachedData.results[targetId] = studentData;
              sessionStorage.setItem('student_result_cache', JSON.stringify(cachedData));
              
              toast.success("Result retrieved successfully!");
            } else {
              setError('The student name entered does not match our records for this Student ID.');
            }
          } else {
            // Result not in publishedResults. Check if student even exists.
            const studentCheckRef = doc(db, 'students', targetId);
            const studentCheckSnap = await getDoc(studentCheckRef);
            
            if (studentCheckSnap.exists()) {
              setError('Result Not Published Yet');
            } else {
              setError('Student Record Not Found');
            }
          }
        } catch (err) {
          console.error(err);
          setError('A secure records query timeout occurred. Please retry.');
        } finally {
          setLoading(false);
          setScanningStatus('idle');
        }
      };

      // Queue Logic
      if (activeRequests > maxActiveRequests) {
        setInQueue(true);
        setQueueStatus("Connecting to result server...");
        const startPos = (activeRequests - maxActiveRequests) + Math.floor(Math.random() * 4) + 2;
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
            return nextPos;
          });
        }, 1200);
      } else {
        await executeFetch();
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'unavailable') {
        setError('Database connection lost. Please verify your internet connection and try again.');
      } else {
        setError('Connection failed. Please check internet access or retry.');
      }
      setLoading(false);
      setScanningStatus('idle');
    }
  };

  const loadStudentByExtractedId = async (extractedId: string) => {
    // 1. Basic validation - if it doesn't contain digits or ID patterns, it's likely invalid
    const idRegex = /[S|T|R|X|I|D]{0,3}\d+/;
    if (!extractedId || !idRegex.test(extractedId)) {
      setError('Invalid QR Code. Please scan a valid Student ID or Transcript QR code.');
      setSearchMethod('id');
      deactivateScanner();
      return;
    }

    // 2. Fill Student ID input automatically
    setStudentId(extractedId);
    
    // 3. Visual confirmation
    setScanningStatus('detected');
    toast.success(`QR Detected Success: ${extractedId}`);

    // 4. Close scanner and switch view
    await deactivateScanner();
    setSearchMethod('id');

    // 5. Trigger the exact same search logic
    await performUnifiedSearch(extractedId, undefined, true);
  };

  // Manage scanner lifecycle corresponding to searchMethod
  useEffect(() => {
    let checkExist: NodeJS.Timeout | null = null;
    let isMounted = true;

    if (searchMethod === 'qr') {
      setIsCameraActive(true);
      setError('');

      let attempts = 0;
      checkExist = setInterval(async () => {
        if (!isMounted) return;
        const el = document.getElementById(scanRegionId);
        attempts++;

        if (el) {
          if (checkExist) {
            clearInterval(checkExist);
            checkExist = null;
          }
          
          try {
            if (qrScannerRef.current) {
              await deactivateScanner();
            }

            const scanner = new Html5Qrcode(scanRegionId);
            qrScannerRef.current = scanner;

            await scanner.start(
              { facingMode: "environment" },
              {
                fps: 15,
                qrbox: (width, height) => {
                  const size = Math.min(width, height) * 0.7;
                  return { width: size, height: size };
                }
              },
              async (decodedText) => {
                await deactivateScanner();
                const extractedId = extractStudentIdFromQR(decodedText);
                await loadStudentByExtractedId(extractedId);
              },
              () => {
                // Silent loop
              }
            );
          } catch (err) {
            console.error("Camera startup error:", err);
            toast.error("Unable to access camera. Please confirm permissions.");
            setSearchMethod('id');
            setIsCameraActive(false);
          }
        } else if (attempts > 30) {
          if (checkExist) {
            clearInterval(checkExist);
            checkExist = null;
          }
          toast.error("Scanner element mount timeout.");
          setSearchMethod('id');
          setIsCameraActive(false);
        }
      }, 100);
    } else {
      deactivateScanner();
    }

    return () => {
      isMounted = false;
      if (checkExist) {
        clearInterval(checkExist);
      }
      deactivateScanner();
    };
  }, [searchMethod]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performUnifiedSearch(studentId, studentName, false);
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

        {/* Toggle Option selection pills */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-gray-55 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60">
            <button
              type="button"
              onClick={() => {
                setSearchMethod('id');
                deactivateScanner();
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${searchMethod === 'id' ? 'bg-white dark:bg-gray-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-255'}`}
            >
              <Search className="w-4 h-4" /> Option 1: Student ID
            </button>
            <button
              type="button"
              onClick={() => setSearchMethod('qr')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${searchMethod === 'qr' ? 'bg-white dark:bg-gray-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-255'}`}
            >
              <Camera className="w-4 h-4" /> Option 2: Scan QR Code
            </button>
          </div>
        </div>

        {searchMethod === 'id' ? (
          <form onSubmit={handleSearch} className="space-y-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Identity PIN (e.g. ST123456)"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-855 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-base sm:text-lg font-mono font-bold tracking-wider placeholder:tracking-normal placeholder:font-sans"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 w-5 h-5" />
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Student Registered Name"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-855 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none text-base sm:text-lg font-bold placeholder:font-normal"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 w-5 h-5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || inQueue}
              className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider relative overflow-hidden active:scale-98 shadow-md cursor-pointer"
            >
              {loading || inQueue ? <Loader2 className="animate-spin w-5 h-5" /> : 'Search Result'}
            </button>
          </form>
        ) : (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-855 rounded-3xl border border-gray-150 dark:border-gray-800/60 max-w-lg mx-auto overflow-hidden">
            <div className="text-center mb-4">
              <h3 className="text-sm font-black text-gray-850 dark:text-gray-100 uppercase tracking-wider">Live Camera QR Code Reader</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Place the printed QR code signature inside the camera viewport</p>
            </div>
            
            <div className="relative bg-black dark:bg-gray-950 rounded-2xl aspect-video overflow-hidden border border-gray-200 dark:border-gray-800 shadow-inner flex items-center justify-center">
              {isCameraActive ? (
                <div id={scanRegionId} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Camera className="w-10 h-10 animate-pulse text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Activating camera hardware...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchMethod('id');
                deactivateScanner();
              }}
              className="mt-4 w-full py-2.5 bg-gray-150 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-250 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel Scan
            </button>
          </div>
        )}


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
                        const gradesSnap = await getDocs(query(collection(db, 'grades'), where('name', '==', student.grade), where('section', '==', student.section)));
                        const htName = gradesSnap.docs[0]?.data()?.homeroomTeacher || '________________';
                        await generateStudentTranscript(student, config, subjects, htName);
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <ResultCard title="Semester 01 Summary" data={student.semester1} accent="indigo" />
                <ResultCard title="Semester 02 Summary" data={student.semester2} accent="blue" />
                <ResultCard 
                  title="Final Academic Status" 
                  data={student.final ? {
                    ...student.final,
                    total: (student.semester1 && student.semester2) 
                      ? Number(((student.semester1.total + student.semester2.total) / 2).toFixed(1))
                      : student.final.total
                  } : undefined} 
                  accent="emerald" 
                />
                <div className="p-6 rounded-3xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/15 shadow-sm transition-all relative overflow-hidden group">
                  <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-4 tracking-widest">Conduct & Attendance</h3>
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-baseline">
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Conduct (Amala)</p>
                        <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter font-mono">{student.conduct || 'A'}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Absent (Hafte)</p>
                        <span className="text-3xl font-black text-rose-500 dark:text-rose-400 tracking-tighter font-mono">{student.absent ?? 0}</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase pt-2 border-t border-gray-100/50 dark:border-gray-800 leading-tight">
                      Recommendation: {getRecommendation(student.final?.average || 0)}
                    </div>
                  </div>
                </div>
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
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="relative">
              <Loader2 className="animate-spin w-16 h-16 text-indigo-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full animate-ping" />
              </div>
            </div>
            
            <div className="text-center space-y-3">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Finding Student...</h3>
                {studentId && (
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target ID:</span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">{studentId}</span>
                  </div>
                )}
              </div>
              
              <div className="w-64 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mx-auto">
                <motion.div 
                  className="h-full bg-indigo-600"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </div>

              <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                Searching published results... Please wait...
              </p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="px-6 py-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/10 flex items-center gap-3"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Verifying academic signature...</span>
            </motion.div>
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

        {/* TOP 5 SCHOLARS RANKING CARD Section */}
        <div className="mt-12 bg-white dark:bg-gray-900 border border-gray-105 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-55 dark:border-gray-800 pb-4 mb-6">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                Top Scholars Honor Board <span className="text-gray-400 font-medium text-xs sm:text-sm border-l pl-2 ml-2 border-gray-200 dark:border-gray-700">Oromia Excellence</span>
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Top 5 Student Averages School-Wide</p>
            </div>
          </div>

          {topRankingsPublished ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {topRankingsList.slice(0, 5).map((studentRank: any, idx: number) => (
                <div 
                  key={studentRank.studentId || idx} 
                  className="flex flex-col items-center text-center p-4 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-transparent hover:border-amber-400 transition-all shadow-xs"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs mb-3 ${idx === 0 ? 'bg-amber-500 text-white shadow' : idx === 1 ? 'bg-slate-300 dark:bg-slate-705 text-gray-900 dark:text-white shadow font-bold' : idx === 2 ? 'bg-amber-700 text-white shadow font-bold' : 'bg-white dark:bg-gray-800 text-gray-400'}`}>
                    {idx + 1}
                  </span>
                  <p className="font-black text-xs text-gray-950 dark:text-gray-100 line-clamp-1">{studentRank.name}</p>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-0.5">{studentRank.studentId} • Gr {studentRank.grade}{studentRank.section}</p>
                  <span className="mt-2 text-sm font-black text-amber-600 dark:text-amber-400">{(studentRank.average ?? 0).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Top Student Ranking Not Yet Published
              </p>
            </div>
          )}
        </div>
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
