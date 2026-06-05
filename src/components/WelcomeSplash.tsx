import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface WelcomeSplashProps {
  onDismiss: () => void;
}

export const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onDismiss }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 25);

    // Timeout to dismiss splash screen after ~3 seconds
    const timeout = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 text-white overflow-hidden select-none">
      {/* Dynamic Grid Background Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12)_0,rgba(3,7,18,1)_100%)] pointer-events-none" />
      
      {/* Floating Ambient Glow Light Particles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl px-6 text-center">
        
        {/* Company Developer Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative mb-8"
        >
          <div className="relative p-6 bg-white/5 rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-md">
            <img
              src="https://i.postimg.cc/L8XpTy0H/file-00000000f02472438f295169e929f395.png"
              alt="Ramoda Technologies"
              referrerPolicy="no-referrer"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
            />
            {/* Visual badge */}
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-gray-950 p-2 rounded-2xl shadow-lg border border-gray-950 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-gray-950" />
            </div>
          </div>
        </motion.div>

        {/* Company & System Title Info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <h3 className="text-xs sm:text-sm font-black tracking-[0.2em] text-indigo-400 uppercase leading-none">
              RAMODA TECHNOLOGIES
            </h3>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white mb-2 max-w-xl">
            CHERCHER SECONDARY SCHOOL
          </h1>
          
          <h2 className="text-sm sm:text-base font-bold tracking-wider text-gray-400 uppercase max-w-md mx-auto">
            Student Result Management System
          </h2>
        </motion.div>

        {/* Dynamic Status / Progress indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-14 w-60 sm:w-80 space-y-3"
        >
          {/* Progress Bar Container */}
          <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-gray-500 uppercase">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
              Authenticating Ledger
            </span>
            <span className="font-mono text-gray-400 font-black">{progress}%</span>
          </div>
        </motion.div>

      </div>

      {/* Sleek bottom developer tag */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 text-[10px] font-extrabold tracking-[0.3em] uppercase text-gray-500 pointer-events-none"
      >
        Secures by Ramoda Technologies
      </motion.div>
    </div>
  );
};
