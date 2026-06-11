import React, { useState, useEffect } from 'react';
import { 
  Users, UsersRound, BookOpen, GraduationCap, 
  Settings, PieChart, Upload, Plus, Trash2, 
  Search, FileDown, Edit3, CheckCircle, XCircle,
  Award, TrendingUp, BarChart3, Layout, Menu, X,
  Database, Wand2
} from 'lucide-react';
import { motion } from 'motion/react';
import { SchoolConfig } from '../types';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { GradeManagement } from '../components/GradeManagement';
import { SubjectManagement } from '../components/SubjectManagement';
import { TeacherManagement } from '../components/TeacherManagement';
import { StudentManagement } from '../components/StudentManagement';
import { SchoolSettings } from '../components/SchoolSettings';
import { RosterGenerator } from '../components/RosterGenerator';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { SubjectAssignmentManager } from '../components/SubjectAssignment';
import { DatabaseStatus } from '../components/DatabaseStatus';
import { DataGenerator } from '../components/DataGenerator';

import { DecisionDashboard } from '../components/DecisionDashboard';

import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUnreadCount } from '../lib/notificationService';
import { NotificationPanel } from '../components/NotificationPanel';
import { AnimatePresence } from 'motion/react';
import { Bell } from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { config, updateConfig } = useSchoolConfig();
  const [counts, setCounts] = useState({ students: 0, teachers: 0, grades: 0, subjects: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleOpenNotifs = () => setShowNotifications(true);
    window.addEventListener('open-notifications', handleOpenNotifs);
    const unsub = getUnreadCount(setUnreadCount);
    return () => {
      window.removeEventListener('open-notifications', handleOpenNotifs);
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsubS = onSnapshot(collection(db, 'students'), (snap) => setCounts(prev => ({ ...prev, students: snap.size })));
    const unsubT = onSnapshot(collection(db, 'teachers'), (snap) => setCounts(prev => ({ ...prev, teachers: snap.size })));
    const unsubG = onSnapshot(collection(db, 'grades'), (snap) => setCounts(prev => ({ ...prev, grades: snap.size })));
    const unsubSub = onSnapshot(collection(db, 'subjects'), (snap) => setCounts(prev => ({ ...prev, subjects: snap.size })));
    
    return () => {
      unsubS();
      unsubT();
      unsubG();
      unsubSub();
    };
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'grades', label: 'Grades', icon: UsersRound },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'assignments', label: 'Assignments', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: Award },
    { id: 'db-status', label: 'DB Health', icon: Database },
    { id: 'reports', label: 'Exports', icon: FileDown },
    { id: 'tools', label: 'Data Genie', icon: Wand2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex-grow flex flex-col lg:flex-row min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
      
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-850 sticky top-0 z-30 transition-colors">
        <span className="text-sm font-black uppercase text-indigo-600 tracking-wider">
          Admin Portal
        </span>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Side Portal Menu Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-sm"
        />
      )}

      {/* Sidebar Section */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 z-50 transform lg:transform-none lg:static transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6 flex items-center justify-between lg:block">
          <div>
            <p className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Administration</p>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase">Chercher System</p>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-grow px-4 pb-4 space-y-8 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Core Management</p>
            {tabs.filter(t => ['dashboard', 'teachers', 'students', 'grades', 'subjects', 'assignments'].includes(t.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/40' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:text-gray-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Academic Intelligence</p>
            {tabs.filter(t => ['analytics', 'reports', 'insights'].includes(t.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/40' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:text-gray-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">System Tools</p>
            {tabs.filter(t => ['db-status', 'tools', 'settings'].includes(t.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/40' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:text-gray-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
          <div className="bg-gradient-to-br from-indigo-500 dark:from-indigo-600 to-purple-600 dark:to-purple-700 rounded-2xl p-4 text-white shadow-sm">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider">System Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto bg-gray-50/50 dark:bg-gray-950/30 p-4 sm:p-6 lg:p-8 transition-colors relative">
        <div className="absolute top-6 right-8 hidden lg:flex items-center gap-4 z-20">
           <button 
            onClick={() => setShowNotifications(true)}
            className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all relative group"
           >
              <Bell className="w-5 h-5 text-gray-500 group-hover:text-indigo-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 animate-bounce">
                  {unreadCount}
                </span>
              )}
           </button>
        </div>

        <div className="max-w-6xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <AdminDashboard 
              config={config} 
              counts={counts}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'teachers' && <TeacherManagementWrapper />}
          {activeTab === 'students' && <StudentManagementWrapper />}
          {activeTab === 'grades' && <GradeManagementWrapper />}
          {activeTab === 'subjects' && <SubjectManagementWrapper />}
          {activeTab === 'assignments' && <SubjectAssignmentManager />}
          {activeTab === 'reports' && <RosterGenerator config={config} />}
          {activeTab === 'analytics' && <AnalyticsDashboard config={config} />}
          {activeTab === 'db-status' && <DatabaseStatus />}
          {activeTab === 'tools' && <DataGenerator />}
          {activeTab === 'insights' && <DecisionDashboard config={config} />}
          {activeTab === 'settings' && <SchoolSettingsWrapper />}
        </div>
      </main>
      
      <AnimatePresence>
        {showNotifications && (
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

interface DashboardProps {
  config: SchoolConfig | null;
  counts: { students: number; teachers: number; grades: number; subjects: number };
  setActiveTab: (tab: string) => void;
}

const AdminDashboard = ({ 
  config, 
  counts,
  setActiveTab
}: DashboardProps) => (
  <div className="space-y-8 animate-fade-in">
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Chercher Overview</h1>
      <p className="text-gray-500 dark:text-gray-400 font-medium italic tracking-wide text-sm sm:text-base">Command center for academic surveillance and management.</p>
    </div>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { label: 'Total Students', value: counts.students.toString(), icon: GraduationCap, color: 'bg-indigo-600', link: 'students' },
        { label: 'Total Teachers', value: counts.teachers.toString(), icon: Users, color: 'bg-rose-500', link: 'teachers' },
        { label: 'Classes/Grades', value: counts.grades.toString(), icon: UsersRound, color: 'bg-amber-500', link: 'grades' },
        { label: 'Subjects', value: counts.subjects.toString(), icon: BookOpen, color: 'bg-emerald-500', link: 'subjects' },
      ].map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => setActiveTab(stat.link)}
          className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-5 cursor-pointer hover:shadow-xl hover:shadow-indigo-100/10 dark:hover:shadow-indigo-900/5 transition-all group"
        >
          <div className={`${stat.color} p-4 rounded-2xl text-white shadow-lg dark:shadow-none group-hover:scale-110 transition-transform`}>
            <stat.icon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> Control Intelligence
        </h3>
        <div className="space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${(config?.publishedGrades?.length || 0) > 0 ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40'}`}>
            <div className="text-center md:text-left flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className={`p-4 rounded-2xl shrink-0 ${(config?.publishedGrades?.length || 0) > 0 ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                 {(config?.publishedGrades?.length || 0) > 0 ? <CheckCircle className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
              </div>
              <div>
                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Result Visibility</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-sm mt-1">
                  {(config?.publishedGrades?.length || 0) > 0 
                    ? `Results for ${config?.publishedGrades?.length || 0} grades are currently visible to students.` 
                    : 'All results are currently restricted. No students can access their scores.'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('grades')}
              className="w-full md:w-auto px-6 py-4 bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl dark:shadow-none active:scale-95 text-xs uppercase tracking-widest"
            >
              Configure Access
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => setActiveTab('analytics')} className="p-6 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-105 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 hover:shadow-lg dark:hover:shadow-none transition-all text-left">
                <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                <p className="font-bold text-gray-900 dark:text-white">Student Rankings</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">View top performers across all published grades.</p>
             </button>
             <button onClick={() => setActiveTab('insights')} className="p-6 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-105 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 hover:shadow-lg dark:hover:shadow-none transition-all text-left">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
                <p className="font-bold text-gray-900 dark:text-white">School Insights</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Deep dive into pass rates and subject trends.</p>
             </button>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 dark:bg-gray-900/60 p-10 rounded-3xl shadow-2xl text-white flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <BarChart3 className="w-64 h-64 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000" />
        </div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
             <GraduationCap className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mb-4 tracking-tighter">Academic Command</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-10 px-4">
            Chercher Result Management System provides high-fidelity tracking of student performance and curriculum effectiveness.
          </p>
          <button 
            onClick={() => setActiveTab('reports')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-900/50"
          >
            Manage Academic Exports
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Management Placeholders (will be populated with logic in next steps)
const TeacherManagementWrapper = () => <TeacherManagement />;
const StudentManagementWrapper = () => <StudentManagement />;
const GradeManagementWrapper = () => <GradeManagement />;
const SubjectManagementWrapper = () => <SubjectManagement />;
const SchoolSettingsWrapper = () => <SchoolSettings />;

const Placeholder = ({ title, description }: { title: string, description: string }) => (
  <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
      <Settings className="w-10 h-10 text-gray-200 dark:text-gray-650" />
    </div>
    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{title}</h2>
    <p className="text-gray-500 dark:text-gray-400 max-w-md">{description}</p>
    <button className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200/25 hover:scale-105 transition-transform">
      Setup {title}
    </button>
  </div>
);
