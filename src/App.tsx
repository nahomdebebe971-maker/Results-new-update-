import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { StudentPortal } from './pages/StudentPortal';
import { AdminPortal } from './pages/AdminPortal';
import { TeacherPortal } from './pages/TeacherPortal';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-bold tracking-tight">Initializing System...</p>
        </div>
      </div>
    );
  }

  // Determine which portal to show
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
