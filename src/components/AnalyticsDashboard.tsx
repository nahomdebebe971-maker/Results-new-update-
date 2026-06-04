import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, Grade, Subject, Mark } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, Users, Award, Target, Loader2, BarChart3, Filter } from 'lucide-react';
import { getSubjectStats } from '../lib/calculations';

export const AnalyticsDashboard: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [topStudents, setTopStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [subjectStats, setSubjectStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const gSnap = await getDocs(collection(db, 'grades'));
        const gradesList = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
        setGrades(gradesList);

        const subSnap = await getDocs(collection(db, 'subjects'));
        const subjectsList = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsList);

        let q = query(
          collection(db, 'students'), 
          orderBy('final.average', 'desc'), 
          limit(20)
        );
        
        let marksQuery = collection(db, 'marks');

        if (selectedGrade !== 'All') {
          const [gName, gSec] = [selectedGrade.replace(/[^0-9]/g, ''), selectedGrade.replace(/[0-9]/g, '')];
          q = query(
            collection(db, 'students'), 
            where('grade', '==', gName),
            where('section', '==', gSec),
            orderBy('final.average', 'desc'), 
            limit(20)
          );
        }

        const sSnap = await getDocs(q);
        const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setTopStudents(students);

        // Fetch marks for subject stats
        if (config && subjectsList.length > 0) {
          const mSnap = await getDocs(marksQuery);
          const allMarks = mSnap.docs.map(d => d.data() as Mark);
          const stats = getSubjectStats(allMarks, students, subjectsList, config);
          setSubjectStats(stats);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedGrade, config]);

  const genderData = [
    { name: 'Male', value: topStudents.filter(s => s.sex === 'M').length },
    { name: 'Female', value: topStudents.filter(s => s.sex === 'F').length },
  ];

  const gradeDistData = [
    { range: '90-100', count: topStudents.filter(s => (s.final?.average || 0) >= 90).length },
    { range: '75-90', count: topStudents.filter(s => (s.final?.average || 0) >= 75 && (s.final?.average || 0) < 90).length },
    { range: '50-75', count: topStudents.filter(s => (s.final?.average || 0) >= 50 && (s.final?.average || 0) < 75).length },
    { range: '<50', count: topStudents.filter(s => (s.final?.average || 0) < 50).length },
  ];

  const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin w-12 h-12 text-indigo-200" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Student Rankings</h2>
          <p className="text-gray-500 font-medium italic">Academic excellence board for {selectedGrade === 'All' ? 'Whole School' : `Grade ${selectedGrade}`}</p>
        </div>
        <select 
          value={selectedGrade} 
          onChange={e => setSelectedGrade(e.target.value)}
          className="p-3 bg-white border border-gray-100 rounded-xl font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
        >
          <option value="All">All Grades (Cumulative Top 20)</option>
          {grades.map(g => (
            <option key={g.id} value={`${g.name}${g.section}`}>Grade {g.name}{g.section}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Top Students Card */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" /> Student Leaderboard
            </h3>
            <div className="space-y-4">
              {topStudents.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-indigo-100/20 transition-all border border-transparent hover:border-indigo-100 group">
                  <div className="flex items-center gap-4">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover:scale-110 ${
                      i < 3 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400 border border-gray-100'
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-black text-gray-900">{s.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.studentId} • Grade {s.grade}{s.section}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">Status</p>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${s.final?.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.final?.status}
                      </span>
                    </div>
                    <div className="text-right min-w-[80px]">
                       <p className="text-2xl font-black text-indigo-600 leading-none">{s.final?.average.toFixed(1)}%</p>
                       <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1">GPA Score</p>
                    </div>
                  </div>
                </div>
              ))}
              {topStudents.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <Award className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Waiting for Results Publication</p>
                </div>
              )}
            </div>
          </div>

          {/* Subject Performance Breakdown */}
          {subjectStats && (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" /> Subject Average Comparison
              </h3>
              <div className="h-80 w-full overflow-x-auto">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(subjectStats).map(([subId, stat]: any) => ({
                      name: subId.slice(0, 8),
                      average: stat.totalAvg,
                      passRate: stat.passRate
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                      <Tooltip cursor={{fill: '#f8fafc', radius: 10}} content={({ active, payload }: any) => {
                        if (active && payload?.[0]) {
                          return (
                            <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100">
                              <p className="text-xs font-black text-gray-900 mb-2 uppercase tracking-widest">{payload[0].payload.name}</p>
                              <p className="text-lg font-black text-indigo-600">{payload[0].value.toFixed(1)}% Avg</p>
                              <p className="text-xs font-bold text-emerald-500">{payload[0].payload.passRate.toFixed(1)}% Pass Rate</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Bar dataKey="average" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-600" /> Merit Distribution
            </h3>
            <div className="h-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeDistData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="count"
                    stroke="none"
                  >
                    {gradeDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" /> Inclusivity Index
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                    <span>Male Participation</span>
                    <span>{genderData[0].value} Students</span>
                  </div>
                  <div className="h-2 bg-indigo-500 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-1000" style={{ width: `${(genderData[0].value / (topStudents.length || 1)) * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                    <span>Female Participation</span>
                    <span>{genderData[1].value} Students</span>
                  </div>
                  <div className="h-2 bg-indigo-500 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 transition-all duration-1000" style={{ width: `${(genderData[1].value / (topStudents.length || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10">
               <Users className="w-40 h-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
