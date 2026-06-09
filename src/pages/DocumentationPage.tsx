import React from 'react';
import { 
  BookOpen, ShieldCheck, FileText, BarChart3, Lock, Award, HeartHandshake, Phone, ArrowLeft, Printer
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigation } from '../context/NavigationContext';

export const DocumentationPage: React.FC = () => {
  const { navigateTo } = useNavigation();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-start p-4 sm:p-8 bg-gray-50 dark:bg-gray-950 print:bg-white transition-colors duration-200">
      {/* Printable Back Button & Header Control Rail */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 print:hidden">
        <button
          onClick={() => navigateTo('portal')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Print Public Guide
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-gray-900 print:shadow-none rounded-[32px] sm:rounded-[40px] shadow-2xl dark:shadow-none p-6 sm:p-12 border border-gray-100 dark:border-gray-850/80 transition-colors print:p-0 print:border-none"
      >
        {/* Banner */}
        <div className="text-center border-b border-gray-100 dark:border-gray-800/60 pb-8 mb-10">
          <span className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest leading-none mb-4 inline-block">
            Legitimate Public Record
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-3">
            Chercher Result Management System
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-extrabold uppercase tracking-widest">
            Institutional Transparency, Technology & Ethics Policy Guide
          </p>
        </div>

        {/* 1. About the System */}
        <div className="space-y-12">
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-indigo-600" /> 1. About the System
            </h2>
            <div className="p-6 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-gray-100 dark:border-gray-800/40 space-y-4">
              <p className="text-sm font-medium text-gray-750 dark:text-gray-300 leading-relaxed">
                The Chercher Secondary School Result Management System (SRMS) is a centralized, digital academic framework engineered in response to national educational modernization guidelines. Replacing old manual logs, the system establishes a highly audited ledger ensuring grades are permanently compiled, securely analyzed, and seamlessly published to students.
              </p>
              <p className="text-sm font-medium text-gray-750 dark:text-gray-300 leading-relaxed">
                Under the directive of Ramoda Technologies, the SRMS bridges school administration, homeroom instruction, and student/guardian oversight into an instant, high-speed connection.
              </p>
            </div>
          </section>

          {/* 2. Core Functional Features */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <Award className="w-6 h-6 text-indigo-600" /> 2. Core Features & Capabilities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Student Result Management
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Grades entry, subject mapping, and semester weights are authorized and completed under state-mandated pass standards.
                </p>
              </div>

              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Transcript Generation
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Beautiful, bilingual (Oromo & English), publication-grade PDFs with automated ranking, conduct records, and performance indexes.
                </p>
              </div>

              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Roster Generation
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Export grade listings matching national regulations, supporting full Excel spreadsheets and high-contrast table grids.
                </p>
              </div>

              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Subject Analysis
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Avery-level mapping across subjects, gender comparisons, standard deviation curves, and subject performance insights.
                </p>
              </div>

              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> QR Verification
                </h3>
                <p className="text-xs text-gray-505 leading-relaxed">
                  Unique embedded TRX signatures on physical badges allowing universities and government agencies to instantly detect forgery under a seconds scan.
                </p>
              </div>

              <div className="p-5 border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-900/60 rounded-xl space-y-2">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Decisive School Analytics
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  High-speed analytics compilation tracks promotion distributions, dropout alerts, and class demographics.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Verification & QR Cryptography */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-indigo-600" /> 3. Verification Protocol
            </h2>
            <div className="p-6 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/20 rounded-2xl border border-indigo-100/30 dark:border-indigo-950/40 space-y-4">
              <p className="text-sm font-semibold text-gray-750 dark:text-gray-300 leading-relaxed">
                How document QR Verification works:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl">
                  <span className="text-xl font-black text-indigo-600 font-mono">01</span>
                  <h4 className="font-extrabold text-xs text-gray-800 dark:text-white mt-1">Unique Fingerprint</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Every printed transcript is generated with a cryptographic security token hash TRX-YYYY-STID.</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl">
                  <span className="text-xl font-black text-indigo-600 font-mono">02</span>
                  <h4 className="font-extrabold text-xs text-gray-800 dark:text-white mt-1">Instant Decryption</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Authorized third-party operators use standard smart device cameras to query and matches record hash.</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl">
                  <span className="text-xl font-black text-indigo-600 font-mono">03</span>
                  <h4 className="font-extrabold text-xs text-gray-800 dark:text-white mt-1">Unbreakable Integrity</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Forged paper certificates are instantly flagged as counterfeit because the database will not verify their falsified hashes.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Data Protection & Sovereignty */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <Lock className="w-6 h-6 text-indigo-600" /> 4. Data Protection Policy
            </h2>
            <div className="p-6 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-gray-100 dark:border-gray-800/40 space-y-4">
              <p className="text-sm font-medium text-gray-750 dark:text-gray-300 leading-relaxed">
                Chercher Secondary School respects the strict privacy of administrative structures. Student ledgers and grades records are compiled and stored on cloud database instances under the direct oversight of the School Director. Only authenticated, registered, and authorized instructors can insert or amend semester marks and attendance sheets.
              </p>
              <div className="flex gap-4 items-center bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-850">
                <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 leading-snug">
                  Our databases utilize SSL/TLS transmission channels, strict Firebase Database Firestore Rules, and secure cryptographic reference keys to block eavesdropping and hacking.
                </span>
              </div>
            </div>
          </section>

          {/* 5. Legal Notice */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <HeartHandshake className="w-6 h-6 text-indigo-600" /> 5. Legal Notice & Legitimacy
            </h2>
            <div className="p-6 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-gray-100 dark:border-gray-800/40 space-y-3.5">
              <p className="text-sm font-medium text-gray-750 dark:text-gray-300 leading-relaxed">
                This software is the officially sanctioned academic ledger of <strong>Chercher Secondary School</strong>. Transcripts generated through this portal and matching the verification ledger represent certified, authentic high school records. Falsification, forgery, or malicious tampering with document scans is a serious offense subject to official federal academic and penal disciplinary actions.
              </p>
            </div>
          </section>

          {/* 6. Contact Information */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-400 tracking-tight flex items-center gap-2.5">
              <Phone className="w-6 h-6 text-indigo-600" /> 6. Institutional Contact Info
            </h2>
            <div className="p-6 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-gray-100 dark:border-gray-800/40 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <h4 className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500">School Location</h4>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">Chercher Secondary School</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Chercher, West Hararghe Zone, Oromia State, Ethiopia</p>
              </div>

              <div className="space-y-1">
                <h4 className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500">Support & Vendor Contact</h4>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">Ramoda Technologies support unit</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email: support@ramodatech.com</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer info */}
        <div className="border-t border-gray-100 dark:border-gray-800/60 mt-12 pt-8 text-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          Authorized educational transcript platform ledger • Compiled: {new Date().toLocaleDateString('en-GB')}
        </div>
      </motion.div>
    </div>
  );
};
