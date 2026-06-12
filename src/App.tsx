import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/Layout';
import { StudentPortal } from './pages/StudentPortal';
import { AdminPortal } from './pages/AdminPortal';
import { TeacherPortal } from './pages/TeacherPortal';
import { DeveloperInfo } from './pages/DeveloperInfo';
import { WelcomeSplash } from './components/WelcomeSplash';
import { VerificationPage } from './pages/VerificationPage';
import { VerifyDocumentPage } from './pages/VerifyDocumentPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, loading } = useAuth();
  const { currentPage } = useNavigation();
  const [verifyId, setVerifyId] = useState<string | null>(() => {
    try {
      return window.location.hash.startsWith('#verify-') ? window.location.hash.replace('#verify-', '') : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify-')) {
        setVerifyId(hash.replace('#verify-', ''));
      } else {
        setVerifyId(null);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (window.location.hash.startsWith('#verify-')) return false;
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

  if (verifyId) {
    return <VerificationPage verificationId={verifyId} />;
  }

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

  if (currentPage === 'verify') {
    return (
      <Layout>
        <VerifyDocumentPage />
      </Layout>
    );
  }

  if (currentPage === 'documentation') {
    return (
      <Layout>
        <DocumentationPage />
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

import { ProgressProvider } from './context/ProgressContext';
import { GlobalProgressModal } from './components/GlobalProgressModal';
import { ModalProvider } from './context/ModalContext';
import { GlobalModal } from './components/UI/GlobalModal';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <ProgressProvider>
      <ModalProvider>
        <NavigationProvider>
          <AuthProvider>
            <AppContent />
            <GlobalProgressModal />
            <GlobalModal />
            <Toaster position="top-right" />
          </AuthProvider>
        </NavigationProvider>
      </ModalProvider>
    </ProgressProvider>
  );
}
