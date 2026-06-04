import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, Grade } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { TrendingUp, Users, Award, Target, Loader2 } from 'lucide-react';

export const AnalyticsDashboard: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [topStudents, setTopStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const gSnap = await getDocs(collection(db, 'grades'));
        setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));

        let q = query(
          collection(db, 'students'), 
          orderBy('final.average', 'desc'), 
          limit(20)
        );
        
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
        setTopStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedGrade]);

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

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin w-12 h-12 text-indigo-600" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Performance Analytics</h2>
          <p className="text-gray-500 font-medium">Deep dive into school-wide and grade-level statistics.</p>
        </div>
        <select 
          value={selectedGrade} 
          onChange={e => setSelectedGrade(e.target.value)}
          className="p-3 bg-white border border-gray-100 rounded-xl font-bold shadow-sm outline-none"
        >
          <option value="All">All Grades (School Top 20)</option>
          {grades.map(g => (
            <option key={g.id} value={`${g.name}${g.section}`}>Grade {g.name}{g.section}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" /> Top Performing Students
            </h3>
            <div className="space-y-4">
              {topStudents.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-100 group">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i < 3 ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">{s.name}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase">{s.studentId} • Grade {s.grade}{s.section}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-indigo-600">{s.final?.average.toFixed(1)}%</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Rank: {s.final?.rank}</p>
                  </div>
                </div>
              ))}
              {topStudents.length === 0 && <p className="text-center text-gray-400 py-10 font-medium">No results found for this selection.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" /> Performance Distribution
            </h3>
            <div className="h-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeDistData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {gradeDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Gender Ratio (Top 20)
            </h3>
            <div className="h-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genderData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
