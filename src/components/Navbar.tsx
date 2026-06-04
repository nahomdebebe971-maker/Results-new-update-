import React from 'react';
import { LogOut, LayoutDashboard, UserCircle, BookOpen, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { logout, signInWithGoogle } from '../lib/firebase';
import { useSchoolConfig } from '../hooks/useSchoolConfig';

export const Navbar: React.FC = () => {
  const { user, role } = useAuth();
  const { config } = useSchoolConfig();

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3">
            {config?.schoolLogo && (
              <img src={config.schoolLogo} alt="Logo" className="h-10 w-10 object-contain" />
            )}
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              {config?.schoolName || 'School Result System'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-600 capitalize">
                    {role?.toLowerCase()} Mode
                  </span>
                </div>
                
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
              >
                Staff Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
