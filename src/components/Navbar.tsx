import React, { useState, useEffect } from 'react';
import { 
  LogOut, Sun, Moon, Menu, X, Info, ShieldCheck, 
  Home, BookOpen, User, BookCheck, Terminal, Award, Bell 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '../context/NavigationContext';
import { LoginModal } from './LoginModal';
import { getUnreadCount } from '../lib/notificationService';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { config } = useSchoolConfig();
  const { theme, toggleTheme } = useTheme();
  const { navigateTo } = useNavigation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = getUnreadCount(setUnreadCount);
    return () => unsub();
  }, []);

  const handleMobileNav = (target: 'portal' | 'verify' | 'documentation' | 'developer' | 'teacher_login' | 'admin_login') => {
    setIsMobileMenuOpen(false);
    if (target === 'teacher_login') {
      if (role === 'TEACHER') {
        navigateTo('portal');
      } else {
        setIsLoginOpen(true);
      }
    } else if (target === 'admin_login') {
      if (role === 'ADMIN') {
        navigateTo('portal');
      } else {
        setIsLoginOpen(true);
      }
    } else {
      navigateTo(target);
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Brand Brand Area */}
          <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={() => navigateTo('portal')}>
            {config?.schoolLogo ? (
              <img src={config.schoolLogo} alt="Logo" className="h-10 w-10 object-contain rounded-lg transition-transform group-hover:scale-105" />
            ) : (
              <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg transition-transform group-hover:scale-105">
                C
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {config?.schoolName || 'CHERCHER SECONDARY'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">
                RESULT PORTAL
              </span>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Rail */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-3">
            {/* Home Link */}
            <button
              onClick={() => navigateTo('portal')}
              className="px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              Home
            </button>

            {/* Verify Document Button */}
            <button
              onClick={() => navigateTo('verify')}
              className="px-3 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden lg:inline">Verify Document</span>
            </button>

            {/* Documentation Button */}
            <button
              onClick={() => navigateTo('documentation')}
              className="px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BookCheck className="w-4 h-4" />
              <span className="hidden lg:inline">Documentation</span>
            </button>

            {/* Developer Info Button */}
            <button
              onClick={() => navigateTo('developer')}
              className="px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Developer Info</span>
            </button>

            {/* Theme Toggle Button */}
            {(user || role) && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
                className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl relative hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                title="System Notifications"
              >
                <Bell className="w-5 h-5 text-gray-500 group-hover:text-indigo-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-950 animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
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
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-850 rounded-full border border-gray-100 dark:border-gray-800">
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
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                Staff Login
              </button>
            )}
          </div>

          {/* Mobile Right Rail (Theme Toggle + Hamburger) */}
          <div className="flex md:hidden items-center gap-3">
            {/* Notification Bell Mobile */}
            {(user || role) && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-notifications'));
                }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Slide Panel overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-xl transition-all">
          <div className="px-4 pt-2 pb-6 space-y-1.5 flex flex-col">
            <button
              onClick={() => handleMobileNav('portal')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <Home className="w-5 h-5 text-gray-400" />
              <span>Home</span>
            </button>

            <button
              onClick={() => handleMobileNav('portal')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <BookOpen className="w-5 h-5 text-gray-400" />
              <span>Student Portal</span>
            </button>

            <button
              onClick={() => handleMobileNav('teacher_login')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <User className="w-5 h-5 text-gray-400" />
              <span>Teacher Portal</span>
            </button>

            <button
              onClick={() => handleMobileNav('admin_login')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <Award className="w-5 h-5 text-gray-400" />
              <span>Admin Portal</span>
            </button>

            <button
              onClick={() => handleMobileNav('verify')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <ShieldCheck className="w-5 h-5 text-indigo-550 dark:text-indigo-400 animate-pulse" />
              <span>Verify Document</span>
            </button>

            <button
              onClick={() => handleMobileNav('documentation')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <BookCheck className="w-5 h-5 text-gray-400" />
              <span>Documentation</span>
            </button>

            <button
              onClick={() => handleMobileNav('developer')}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl transition-colors"
            >
              <Terminal className="w-5 h-5 text-gray-400" />
              <span>Developer Information</span>
            </button>

            <div className="border-t border-gray-100 dark:border-gray-800 my-2 pt-2">
              {(user || role) ? (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-extrabold text-red-500 hover:bg-red-50/40 rounded-xl transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout staff</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsLoginOpen(true);
                  }}
                  className="w-full text-center py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Staff Login Modal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </nav>
  );
};
