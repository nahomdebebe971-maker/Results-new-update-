import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  QrCode, Search, ShieldCheck, ShieldAlert, Loader2, ArrowLeft, Camera, Shield, User, Award, Calendar, BookOpen, Clock, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { useNavigation } from '../context/NavigationContext';

interface VerificationData {
  verificationId: string;
  documentType: string;
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  sex?: string;
  age?: number;
  academicYear: string;
  schoolName: string;
  dateGenerated: string;
  status: string;
}

export const VerifyDocumentPage: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [activeTab, setActiveTab ] = useState<'options' | 'scan' | 'result'>('options');
  const [manualId, setManualId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationData | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleBack = () => {
    try {
      // Prioritize explicit last_visited_page if it's not the current page
      const lastVisited = localStorage.getItem('last_visited_page');
      
      // If we have a history, go back
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      
      // Fallback strategies
      if (lastVisited && !['verify', 'developer', 'documentation'].includes(lastVisited)) {
        navigateTo(lastVisited as any);
      } else {
        // Ultimate fallback to Home/Portal
        navigateTo('portal');
      }
    } catch (err) {
      console.error("Back navigation failed:", err);
      navigateTo('portal');
    }
  };

  // Auto-verify if hash is present on mount
  useEffect(() => {
    const checkHash = async () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#verify-')) {
        const vId = hash.replace('#verify-', '');
        if (vId) {
          setManualId(vId);
          await queryVerificationRecord(vId);
        }
      }
    };
    checkHash();
  }, []);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scanRegionId = "qr-reader-container";

  const deactivateScanner = async () => {
    if (qrScannerRef.current) {
      if (qrScannerRef.current.isScanning) {
        try {
          await qrScannerRef.current.stop();
        } catch (err) {
          console.warn('Error stopping QR scanner:', err);
        }
      }
      qrScannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Manage scanner lifecycle with activeTab state
  useEffect(() => {
    let checkExist: NodeJS.Timeout | null = null;
    let isMounted = true;

    if (activeTab === 'scan') {
      setIsCameraActive(true);
      setVerificationError(null);

      // Poll until the HTML container actually exists in the DOM to avoid unmounted errors
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
            // Prevent duplicate instance creation
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
                const extractedId = parseScannedText(decodedText);
                setScannedId(extractedId);
                await queryVerificationRecord(extractedId);
              },
              () => {
                // Silent callback for non-QR frames
              }
            );
          } catch (err) {
            console.error("Camera startup error:", err);
            toast.error("Unable to access camera or frame permission lost.");
            setActiveTab('options');
            setIsCameraActive(false);
          }
        } else if (attempts > 30) { // 3 seconds timeout
          if (checkExist) {
            clearInterval(checkExist);
            checkExist = null;
          }
          toast.error("Scanner element mount timeout. Re-opening portal.");
          setActiveTab('options');
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
  }, [activeTab]);

  const startQRScanner = () => {
    setActiveTab('scan');
  };

  const parseScannedText = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.includes('#verify-')) {
      const parts = trimmed.split('#verify-');
      return parts[parts.length - 1];
    }
    return trimmed;
  };

  const queryVerificationRecord = async (vId: string) => {
    if (!vId.trim()) {
      toast.error('Please enter a valid Verification ID.');
      return;
    }

    setLoading(true);
    setVerificationError(null);
    setVerificationResult(null);
    setActiveTab('result');

    try {
      // PERFORMANCE RULE: Perform ONLY one Firestore read
      const docRef = doc(db, 'verificationCache', vId.trim());
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setVerificationResult(snap.data() as VerificationData);
      } else {
        setVerificationError(`Verification record not found. This security Reference ID "${vId}" is unregistered, inactive, or counterfeit.`);
      }
    } catch (err) {
      console.error('Firestore verify query error:', err);
      setVerificationError('A temporary connectivity error prevented secure lookup. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) {
      toast.error('Please enter a Verification ID.');
      return;
    }
    queryVerificationRecord(manualId.trim());
  };

  const resetVerificationPortal = async () => {
    await deactivateScanner();
    setManualId('');
    setScannedId(null);
    setVerificationResult(null);
    setVerificationError(null);
    setActiveTab('options');
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[32px] sm:rounded-[40px] shadow-2xl dark:shadow-none p-6 sm:p-10 border border-gray-100 dark:border-gray-850/80 transition-colors"
      >
        {/* Back Button */}
        <div className="flex justify-start mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border border-gray-150 dark:border-gray-800/80 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>

        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
            Document Verification
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2">
            Chercher Academic Trust & Security Portal
          </p>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'options' && (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Option 1: Scan QR Code (Primary UI) */}
              <div className="text-center p-8 bg-gradient-to-br from-indigo-50/20 to-gray-50 dark:from-indigo-950/10 dark:to-gray-900/50 border border-indigo-100/40 dark:border-indigo-950/40 rounded-3xl space-y-6">
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none">
                  <QrCode className="w-10 h-10" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">Option 1: Scan QR Code</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-450 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Instantly authenticate any student badge by scanning the security QR code with your device camera.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startQRScanner}
                  className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2.5 mx-auto hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Camera className="w-5 h-5" /> Launch QR Scanner
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-150 dark:border-gray-800"></div>
                <span className="flex-shrink mx-4 text-xs font-mono font-black uppercase text-gray-400 dark:text-gray-650 tracking-widest">
                  Backup Option
                </span>
                <div className="flex-grow border-t border-gray-150 dark:border-gray-800"></div>
              </div>

              {/* Option 2: Manual Search */}
              <div className="p-6 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 rounded-2xl">
                <form onSubmit={handleManualSearchSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black tracking-widest uppercase text-gray-400 dark:text-gray-500">
                      Option 2: Manual Certificate Reference ID
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="e.g. ID-ST123456-2026"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/30 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-900 transition-all outline-none font-mono font-black tracking-wide text-sm uppercase"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
                  >
                    Verify Security Signature
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-4">
                <button 
                  onClick={resetVerificationPortal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg text-gray-500 transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to options
                </button>
                <div className="flex items-center gap-1.5 text-xs font-mono font-black tracking-widest text-indigo-500 uppercase animate-pulse">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span> Camera Active
                </div>
              </div>

              {/* QR scanner DOM target */}
              <div className="relative aspect-square max-w-[400px] mx-auto overflow-hidden rounded-3xl border-4 border-indigo-600 shadow-xl bg-gray-900">
                <div id={scanRegionId} className="w-full h-full object-cover"></div>
                
                {/* Visual scanner crosshairs overlay */}
                <div className="absolute inset-0 border-[35px] border-black/40 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-full border-2 border-indigo-400 border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-full border-t border-indigo-400 absolute top-1/2 left-0 -translate-y-1/2 animate-bounce opacity-80" />
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">Align QR code within the frame</p>
                <p className="text-xs text-gray-400 leading-normal max-w-sm mx-auto">
                  Hold your mobile phone badge or printed ID card centered under the camera light to trigger decryption.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Querying Blockchain Registry...</p>
                </div>
              ) : verificationError ? (
                /* Red/Failure layout */
                <div className="space-y-6">
                  <div className="text-center p-8 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-3xl space-y-4">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center border border-red-200 dark:border-red-900/60 mx-auto">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-xl font-black text-red-750 dark:text-red-450 leading-none">Verification Failed</h2>
                      <p className="text-xs uppercase font-black tracking-widest text-red-500">Invalid Document / Not Found</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 leading-relaxed pt-2">
                      {verificationError}
                    </p>
                  </div>

                  <button
                    onClick={resetVerificationPortal}
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Scan / Search Another
                  </button>
                </div>
              ) : verificationResult ? (
                /* Success/Verified document details */
                <div className="space-y-6">
                  {/* Verified Header Panel */}
                  <div className="text-center p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/25 rounded-3xl space-y-3">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 dark:shadow-none mx-auto relative">
                      <ShieldCheck className="w-8 h-8" />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-white leading-none">Verified Document</h2>
                      <p className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-1">Status: VERIFIED</p>
                    </div>
                    <span className="inline-block text-[9px] font-black text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-150 dark:border-emerald-900/40 px-3 py-1 rounded-full uppercase tracking-widest">
                      Authentic Academic Ledger
                    </span>
                  </div>

                  {/* Document and Student Data Fields */}
                  <div className="space-y-4">
                    {/* Grid highlights */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-400 block tracking-wider">Document Type</span>
                        <span className="font-extrabold text-gray-750 dark:text-gray-200 text-xs sm:text-sm flex items-center gap-1.5 uppercase">
                          <Award className="w-4 h-4 text-indigo-500" />
                          {verificationResult.documentType}
                        </span>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-400 block tracking-wider">Academic Year</span>
                        <span className="font-extrabold text-gray-750 dark:text-gray-200 text-xs sm:text-sm flex items-center gap-1.5 uppercase">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          {verificationResult.academicYear}
                        </span>
                      </div>
                    </div>

                    {/* Directory records detail stack */}
                    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3.5">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 pb-2 border-b border-gray-50 dark:border-gray-850">
                        Identity Metadata
                      </h3>

                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-450 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" /> Student Name
                        </span>
                        <span className="font-extrabold text-gray-800 dark:text-gray-100 uppercase">{verificationResult.studentName}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-450 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-gray-400" /> Grade & Section
                        </span>
                        <span className="font-extrabold text-gray-800 dark:text-gray-100 uppercase">{verificationResult.grade} - {verificationResult.section}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-450">Student ID</span>
                        <span className="font-mono font-black text-indigo-650 dark:text-indigo-400">{verificationResult.studentId}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-450 text-xs">School Name</span>
                        <span className="font-extrabold text-gray-800 dark:text-gray-100 text-xs tracking-tight text-right truncate max-w-[200px] uppercase">
                          {verificationResult.schoolName}
                        </span>
                      </div>

                      {verificationResult.sex && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-450">Biological Sex / Age</span>
                          <span className="font-semibold text-gray-650 dark:text-gray-350">{verificationResult.sex} • {verificationResult.age} years</span>
                        </div>
                      )}
                    </div>

                    {/* Decrypt signature summary stamp */}
                    <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-xl flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800">
                      <Clock className="w-4 h-5 text-indigo-500 shrink-0" />
                      <span className="leading-snug">
                        Decryption complete. Record stamp generated at: <br />
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                          {new Date(verificationResult.dateGenerated).toLocaleString()}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-indigo-50/20 text-center rounded-xl border border-indigo-150/20">
                      <p className="text-[9px] font-mono text-gray-400 uppercase tracking-tight">
                        Security Signature Hash: {verificationResult.verificationId}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={resetVerificationPortal}
                      className="w-full py-4 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Scan Another
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
