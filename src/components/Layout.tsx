import React from 'react';
import { Navbar } from './Navbar';
import { useNavigation } from '../context/NavigationContext';
import { Sparkles } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { navigateTo } = useNavigation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Navbar />
      <main className="flex-grow flex flex-col">
        {children}
      </main>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
          {/* Main Long and Highly Visible Developer Information Button */}
          <button
            onClick={() => navigateTo('developer')}
            className="group w-full max-w-2xl px-6 py-4.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-850 hover:from-indigo-500 hover:via-indigo-600 hover:to-indigo-750 text-white rounded-2xl shadow-xl hover:shadow-indigo-500/20 active:scale-[0.99] transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-500/30 overflow-hidden relative cursor-pointer"
          >
            {/* Absolute ambient light flare */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
            
            <div className="flex items-center gap-3.5 text-left relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-5 h-5 text-indigo-200 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-200 leading-none">SYSTEM DEVELOPER</h4>
                <p className="text-sm font-extrabold text-white tracking-wide mt-1.5 flex items-center gap-1.5">
                  Powered by <span className="underline decoration-indigo-300 underline-offset-4">Ramoda Technologies</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-10 px-4 py-2 bg-white/10 group-hover:bg-white/15 rounded-xl border border-white/5 transition-all self-stretch sm:self-auto justify-center text-center">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                View Developer Desk
              </span>
              <span className="text-sm transition-transform duration-300 group-hover:translate-x-1">➔</span>
            </div>
          </button>

          <div className="text-gray-400 dark:text-gray-550 text-[10px] sm:text-xs font-bold tracking-widest uppercase text-center mt-2">
            &copy; {new Date().getFullYear()} CHERCHER Result Management System. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
