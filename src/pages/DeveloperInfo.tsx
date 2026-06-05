import React from 'react';
import { Mail, Phone, Send, Info, Award, ShieldCheck, ArrowLeft, ExternalLink, Sparkles, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigation } from '../context/NavigationContext';

export const DeveloperInfo: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-[32px] sm:rounded-[40px] shadow-2xl dark:shadow-none p-6 sm:p-10 border border-gray-100 dark:border-gray-850/80 transition-colors relative overflow-hidden"
      >
        {/* Background Decorative Circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-950/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 dark:bg-emerald-950/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        {/* Back Navigation Bar */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-50 dark:border-gray-800 pb-5 relative z-10">
          <button
            onClick={() => navigateTo('portal')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-550 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back to Portal
          </button>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400 px-2.5 py-1 rounded-lg">
              Official Developer Page
            </span>
          </div>
        </div>

        {/* Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
          
          {/* PROFILE CARD - 5 Cols */}
          <div className="md:col-span-5 flex flex-col items-center">
            <motion.div 
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-full bg-gray-50 dark:bg-gray-850 rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center text-center shadow-lg relative"
            >
              {/* Image Frame with gradient borders */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden mb-5 p-1 bg-gradient-to-tr from-indigo-500 to-emerald-500 shadow-xl group">
                <img 
                  src="https://i.postimg.cc/Y0yKdbbg/IMG-20260517-213404-358.jpg" 
                  alt="Nahom Debebe" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Nahom Debebe</h3>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1">Founder & Lead Architect</p>
              
              <div className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100/30">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Ramoda Technologies</span>
              </div>

              <div className="w-full border-t border-gray-150/50 dark:border-gray-800/80 my-5" />

              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                Pioneering robust and secured digital infrastructures for educational institutions across East Africa.
              </p>
            </motion.div>
          </div>

          {/* DETAILED INFORMATION & CONTACTS - 7 Cols */}
          <div className="md:col-span-7 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Developed By Partners</span>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white leading-none mt-1">
                  Ramoda Technologies
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-bold mt-2 text-sm">
                  Innovation • Integrity • Institutional Excellence
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Academic Excellence</h4>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-0.5">Custom-tailored result ledger systems matching Oromo Regional Education policies seamlessly.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Enterprise Cryptography Rules</h4>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-0.5">Engineered with fortified Firestore security and dynamic document footprint tracking.</p>
                  </div>
                </div>
              </div>

              {/* Information Message Highlight Card */}
              <div className="bg-gradient-to-r from-emerald-50/70 to-indigo-50/70 dark:from-emerald-950/20 dark:to-indigo-950/20 p-5 rounded-2xl border border-emerald-100/30 dark:border-indigo-900/30 flex gap-3 shadow-inner">
                <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5 animate-bounce" />
                <p className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-400 leading-relaxed">
                  "If you need this system for your school, contact us by email or Telegram."
                </p>
              </div>
            </div>

            {/* Quick Action Contact Buttons */}
            <div className="space-y-3 pt-6 md:pt-0">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Interactive Contact Desk</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Email Action */}
                <a
                  href="mailto:ramodatechnologies@gmail.com"
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all p-3.5 rounded-xl text-xs uppercase tracking-wider font-black shadow-md focus:ring-2 focus:ring-indigo-400 outline-none hover:shadow-lg"
                >
                  <Mail className="w-4 h-4" /> Email Developer
                </a>

                {/* Phone Call Action */}
                <a
                  href="tel:+251993253633"
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all p-3.5 rounded-xl text-xs uppercase tracking-wider font-black shadow-md focus:ring-2 focus:ring-emerald-400 outline-none hover:shadow-lg"
                >
                  <Phone className="w-4 h-4" /> Call Developer
                </a>

                {/* Telegram Contact */}
                <a
                  href="https://t.me/Rtdart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-sky-500 text-white hover:bg-sky-600 active:scale-95 transition-all p-3.5 rounded-xl text-xs uppercase tracking-wider font-black shadow-md focus:ring-2 focus:ring-sky-400 outline-none hover:shadow-lg"
                >
                  <Send className="w-4 h-4" /> Open Telegram
                </a>

              </div>

              {/* Bottom detail list */}
              <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 mt-4 text-[11px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50/50 p-3 rounded-xl border border-gray-150/30">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> ramodatechnologies@gmail.com
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> +251 993 253633
                </span>
              </div>
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
};
