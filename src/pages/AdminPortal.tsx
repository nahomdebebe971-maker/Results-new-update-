import React, { useState } from 'react';
import { 
  Users, UsersRound, BookOpen, GraduationCap, 
  Settings, PieChart, Upload, Plus, Trash2, 
  Search, FileDown, Edit3, CheckCircle, XCircle 
} from 'lucide-react';
import { motion } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { GradeManagement } from '../components/GradeManagement';
import { SubjectManagement } from '../components/SubjectManagement';
import { TeacherManagement } from '../components/TeacherManagement';
import { StudentManagement } from '../components/StudentManagement';
import { SchoolSettings } from '../components/SchoolSettings';
import { RosterGenerator } from '../components/RosterGenerator';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

export const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { config, updateConfig } = useSchoolConfig();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'grades', label: 'Grades', icon: UsersRound },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileDown },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
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
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'teachers' && <TeacherManagementWrapper />}
          {activeTab === 'students' && <StudentManagementWrapper />}
          {activeTab === 'grades' && <GradeManagementWrapper />}
          {activeTab === 'subjects' && <SubjectManagementWrapper />}
          {activeTab === 'reports' && <RosterGenerator config={config} />}
          {activeTab === 'analytics' && <AnalyticsDashboard config={config} />}
          {activeTab === 'settings' && <SchoolSettingsWrapper />}
        </div>
      </main>
    </div>
  );
};

const AdminDashboard = () => (
  <div className="space-y-8">
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin Overview</h1>
      <p className="text-gray-500 font-medium">Quick statistics and system health.</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { label: 'Total Students', value: '0', icon: GraduationCap, color: 'bg-indigo-500' },
        { label: 'Total Teachers', value: '0', icon: Users, color: 'bg-blue-500' },
        { label: 'Classes/Grades', value: '0', icon: UsersRound, color: 'bg-emerald-500' },
        { label: 'Subjects', value: '0', icon: BookOpen, color: 'bg-orange-500' },
      ].map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
        >
          <div className={`${stat.color} p-3 rounded-xl text-white`}>
            <stat.icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>

    {/* Placeholder for charts/recent activity */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center">
        <PieChart className="w-16 h-16 text-gray-200 mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Performance Analytics</h3>
        <p className="text-gray-400 text-sm mt-2">Publish results to see performance distributions.</p>
      </div>
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[300px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activities</h3>
        <div className="space-y-4">
          <p className="text-gray-400 text-sm italic">No recent system updates found.</p>
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
