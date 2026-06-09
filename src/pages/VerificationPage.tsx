import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, ShieldCheck, ShieldAlert, Award, Calendar, User, BookOpen, Clock } from 'lucide-react';

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

export const VerificationPage: React.FC<{ verificationId: string }> = ({ verificationId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  useEffect(() => {
    const fetchVerification = async () => {
      setLoading(true);
      setErrorStr(null);
      try {
        const docRef = doc(db, 'verificationCache', verificationId);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          setData(snap.data() as VerificationData);
        } else {
          setErrorStr('The requested Verification ID is invalid or cannot be verified. This document may be non-authentic, modified, or expired.');
        }
      } catch (err: any) {
        console.error('Firestore Read Error:', err);
        setErrorStr('We encountered an error connecting to security systems. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVerification();
  }, [verificationId]);

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/20 via-neutral-900 to-neutral-900 pointer-events-none" />
      
      <div className="w-full max-w-lg relative z-10">
        {/* Brand / Logo */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-black tracking-widest text-indigo-400 uppercase">CHERCHER SECURITY</h1>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-1">Academic Document Verification Portal</p>
        </div>

        {loading ? (
          <div className="bg-neutral-950 border border-neutral-800 p-12 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-2xl">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm font-bold text-neutral-400 tracking-wider">Verifying Security Signatures...</p>
          </div>
        ) : errorStr ? (
          <div className="bg-neutral-950 border border-red-950/30 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-red-950/40 text-red-500 rounded-2xl flex items-center justify-center border border-red-900/40 shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Verification Failed</h2>
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-950/55 px-3 py-1 rounded-full border border-red-900/30">INVALID STATUS</span>
            </div>
            
            <p className="text-sm font-semibold text-neutral-400 text-center leading-relaxed bg-neutral-900/55 p-4 rounded-xl border border-neutral-850">
              {errorStr}
            </p>

            <div className="text-center">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">ID Ref: {verificationId}</p>
              <button 
                onClick={() => window.location.hash = ''} 
                className="mt-6 px-6 py-3 bg-neutral-900 hover:bg-neutral-850 rounded-xl text-xs font-black tracking-widest uppercase transition-all"
              >
                Return to Portal
              </button>
            </div>
          </div>
        ) : data ? (
          <div className="bg-neutral-950 border border-emerald-950/30 rounded-3xl shadow-2xl overflow-hidden">
            {/* Success Header */}
            <div className="p-8 bg-gradient-to-br from-emerald-950/30 to-neutral-950 flex flex-col items-center text-center border-b border-neutral-900">
              <div className="w-16 h-16 bg-emerald-950/45 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-800/40 shadow-inner mb-4 relative">
                <ShieldCheck className="w-8 h-8" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Access Granted</h2>
              <p className="text-xs text-neutral-400 font-bold tracking-wide mt-1">{data.schoolName}</p>
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-950/60 border border-emerald-900/30 px-4 py-1.5 rounded-full mt-4">
                AUTHENTICATED DOCUMENT
              </span>
            </div>

            {/* Document Details Renders */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">Document Type</span>
                  <span className="font-bold text-neutral-200 text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-400" />
                    {data.documentType}
                  </span>
                </div>
                <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">Academic Year</span>
                  <span className="font-bold text-neutral-200 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    {data.academicYear}
                  </span>
                </div>
              </div>

              <div className="border border-neutral-900 rounded-2xl bg-neutral-900/20 p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2 pb-2 border-b border-neutral-900">
                  Student Directory Data
                </h3>

                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <User className="w-4 h-4" /> Full Name
                  </span>
                  <span className="font-bold text-neutral-200">{data.studentName}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-neutral-500">Student ID</span>
                  <span className="font-mono font-bold text-indigo-400">{data.studentId}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Grade & Section
                  </span>
                  <span className="font-bold text-neutral-200">{data.grade} - {data.section}</span>
                </div>

                {data.sex && (
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-neutral-500">Sex / Age</span>
                    <span className="font-bold text-neutral-200">{data.sex} • {data.age} yrs</span>
                  </div>
                )}
              </div>

              <div className="bg-neutral-900/20 border border-neutral-900 p-4 rounded-xl flex items-center gap-3 text-xs font-bold text-neutral-400">
                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  Validated on database replica at: <br className="sm:hidden" />
                  <span className="font-mono text-neutral-300">{new Date(data.dateGenerated).toLocaleString()}</span>
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-neutral-900/30 border-t border-neutral-900 text-center">
              <span className="text-[10px] font-mono text-neutral-500 tracking-wider uppercase">Verification Hash: {data.verificationId}</span>
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={() => window.location.hash = ''} 
                  className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 rounded-xl text-xs font-black tracking-widest uppercase transition-colors"
                >
                  Return to Portal
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
