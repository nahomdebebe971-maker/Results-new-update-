import React, { useState, useEffect } from 'react';
import { 
  Users, UsersRound, BookOpen, GraduationCap, 
  Settings, PieChart, Upload, Plus, Trash2, 
  Search, FileDown, Edit3, CheckCircle, XCircle,
  Award, TrendingUp, BarChart3, Layout
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
import { TemplateManager } from '../components/TemplateManager';

import { DecisionDashboard } from '../components/DecisionDashboard';

import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { config, updateConfig } = useSchoolConfig();
  const [counts, setCounts] = useState({ students: 0, teachers: 0, grades: 0, subjects: 0 });

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
    { id: 'dashboard', label: 'Overview', icon: PieChart },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'grades', label: 'Academic Structure', icon: UsersRound },
    { id: 'subjects', label: 'Curriculum', icon: BookOpen },
    { id: 'assignments', label: 'Teacher Assignments', icon: Users },
    { id: 'analytics', label: 'Student Rankings', icon: Award },
    { id: 'templates', label: 'Document Templates', icon: Layout },
    { id: 'insights', label: 'Decision Insights', icon: TrendingUp },
    { id: 'reports', label: 'Transcripts', icon: FileDown },
    { id: 'settings', label: 'Configuration', icon: Settings },
  ];

  return (
    <div className="flex-grow flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Administration</p>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-gray-100">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-sm font-bold">System Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto bg-gray-50/50 p-8">
        <div className="max-w-6xl mx-auto">
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
          {activeTab === 'templates' && <TemplateManager />}
          {activeTab === 'insights' && <DecisionDashboard config={config} />}
          {activeTab === 'settings' && <SchoolSettingsWrapper />}
        </div>
      </main>
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
  <div className="space-y-8">
    <div className="flex flex-col gap-2">
      <h1 className="text-4xl font-black text-gray-900 tracking-tight">Chercher Overview</h1>
      <p className="text-gray-500 font-medium italic tracking-wide">Command center for academic surveillance and management.</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 cursor-pointer hover:shadow-xl hover:shadow-indigo-100/20 transition-all group"
        >
          <div className={`${stat.color} p-4 rounded-2xl text-white shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
            <stat.icon className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-gray-900 tabular-nums">{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> Control Intelligence
        </h3>
        <div className="space-y-6">
          <div className={`p-8 rounded-3xl border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${(config?.publishedGrades?.length || 0) > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="text-center md:text-left flex items-start gap-4">
              <div className={`p-4 rounded-2xl ${(config?.publishedGrades?.length || 0) > 0 ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                 {(config?.publishedGrades?.length || 0) > 0 ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <div>
                <p className="text-xl font-black text-gray-900 tracking-tight">Result Visibility</p>
                <p className="text-sm text-gray-500 font-medium max-w-sm mt-1">
                  {(config?.publishedGrades?.length || 0) > 0 
                    ? `Results for ${config?.publishedGrades?.length || 0} grades are currently visible to students.` 
                    : 'All results are currently restricted. No students can access their scores.'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('grades')}
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black transition-all shadow-xl hover:bg-gray-800 active:scale-95 text-xs uppercase tracking-widest"
            >
              Configure Access
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => setActiveTab('analytics')} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-lg transition-all text-left">
                < Award className="w-6 h-6 text-indigo-600 mb-2" />
                <p className="font-bold text-gray-900">Student Rankings</p>
                <p className="text-xs text-gray-400 font-medium">View top performers across all published grades.</p>
             </button>
             <button onClick={() => setActiveTab('insights')} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-lg transition-all text-left">
                < TrendingUp className="w-6 h-6 text-purple-600 mb-2" />
                <p className="font-bold text-gray-900">School Insights</p>
                <p className="text-xs text-gray-400 font-medium">Deep dive into pass rates and subject trends.</p>
             </button>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 p-10 rounded-3xl shadow-2xl text-white flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <BarChart3 className="w-64 h-64 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000" />
        </div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
             <GraduationCap className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-3xl font-black mb-4 tracking-tighter">Academic Command</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-10 px-4">
            Chercher Result Management System provides high-fidelity tracking of student performance and curriculum effectiveness.
          </p>
          <button 
            onClick={() => setActiveTab('reports')}
            className="w-full py-4 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/50"
          >
            Generate Transcripts
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
  <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
      <Settings className="w-10 h-10 text-gray-200" />
    </div>
    <h2 className="text-2xl font-black text-gray-900 mb-2">{title}</h2>
    <p className="text-gray-500 max-w-md">{description}</p>
    <button className="mt-8 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:scale-105 transition-transform">
      Setup {title}
    </button>
  </div>
);
