import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/Layout';
import { StudentPortal } from './pages/StudentPortal';
import { AdminPortal } from './pages/AdminPortal';
import { TeacherPortal } from './pages/TeacherPortal';
import { DeveloperInfo } from './pages/DeveloperInfo';
import { WelcomeSplash } from './components/WelcomeSplash';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, loading } = useAuth();
  const { currentPage } = useNavigation();
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('ramoda_splash_seen');
    } catch {
      return true;
    }
  });

  const handleSplashDismiss = () => {
    try {
      sessionStorage.setItem('ramoda_splash_seen', 'true');
    } catch (e) {
      console.warn(e);
    }
    setShowSplash(false);
  };

  if (showSplash) {
    return <WelcomeSplash onDismiss={handleSplashDismiss} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-gray-500 dark:text-gray-450 font-bold tracking-tight">Initializing System...</p>
        </div>
      </div>
    );
  }

  // Determine page rendering based on navigation state
  if (currentPage === 'developer') {
    return (
      <Layout>
        <DeveloperInfo />
      </Layout>
    );
  }

  // If not logged in, show Student Portal (Public search)
  if (!user && !role) {
    return (
      <Layout>
        <StudentPortal />
      </Layout>
    );
  }

  // If logged in, show portal based on role
  return (
    <Layout>
      {role === 'ADMIN' ? <AdminPortal /> : 
       role === 'TEACHER' ? <TeacherPortal /> : 
       <StudentPortal />}
    </Layout>
  );
};

export default function App() {
  return (
    <NavigationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NavigationProvider>
  );
}
