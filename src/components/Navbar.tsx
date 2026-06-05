import React, { useState } from 'react';
import { LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { useTheme } from '../hooks/useTheme';
import { LoginModal } from './LoginModal';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { config } = useSchoolConfig();
  const { theme, toggleTheme } = useTheme();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3">
            {config?.schoolLogo ? (
              <img src={config.schoolLogo} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
            ) : (
              <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg">
                C
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-4">
                {config?.schoolName || 'CHERCHER SECONDARY'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">
                RESULT PORTAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
              title="Toggle Theme"
              id="theme-toggle-btn"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            {(user || role) ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-850 rounded-full border border-gray-100 dark:border-gray-800">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 capitalize">
                    {role?.toLowerCase()}
                  </span>
                </div>
                
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
              >
                Staff Login
              </button>
            )}
          </div>
        </div>
      </div>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </nav>
  );
};
