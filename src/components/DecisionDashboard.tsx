import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, Grade, Subject, Mark } from '../types';
import { 
  TrendingUp, Award, Users, Download, 
  BarChart3, PieChart as PieChartIcon, 
  ChevronRight, Filter, FileSpreadsheet,
  CheckCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export const DecisionDashboard: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [loading, setLoading] = useState(true);
  const [top20, setTop20] = useState<Student[]>([]);
  const [gradeTop5, setGradeTop5] = useState<Record<string, Student[]>>({});
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [topByGrade, setTopByGrade] = useState<Record<string, Student[]>>({});
  const [stats, setStats] = useState({
    totalStudents: 0,
    overallPassRate: 0,
    maleStudents: 0,
    femaleStudents: 0,
    averageScore: 0
  });

  useEffect(() => {
    const fetchDecisionData = async () => {
      setLoading(true);
      try {
        // Fetch Grades
        const gSnap = await getDocs(collection(db, 'grades'));
        const gradesList = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
        setGrades(gradesList);

        // Fetch Subjects
        const subSnap = await getDocs(collection(db, 'subjects'));
        const subjectsList = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsList);

        // Fetch Marks
        const mSnap = await getDocs(collection(db, 'marks'));
        const marksList = mSnap.docs.map(d => d.data() as Mark);
        setMarks(marksList);

        // Fetch School Top 20
        const qTop20 = query(
          collection(db, 'students'), 
          orderBy('final.average', 'desc'), 
          limit(20)
        );
        const sSnap = await getDocs(qTop20);
        const top20List = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setTop20(top20List);

        // Fetch all students for Batch rankings and Global stats
        const allSnap = await getDocs(collection(db, 'students'));
        const allStudents = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)).filter(s => s.final);
        
        // Group by Grade (Batch)
        const batches: Record<string, Student[]> = {};
        allStudents.forEach(s => {
          if (!batches[s.grade]) batches[s.grade] = [];
          batches[s.grade].push(s);
        });
        setTopByGrade(batches);

        // Group by Section (Grade Leaders)
        const sectionLeaders: Record<string, Student[]> = {};
        allStudents.forEach(s => {
          const key = `${s.grade}${s.section}`;
          if (!sectionLeaders[key]) sectionLeaders[key] = [];
          sectionLeaders[key].push(s);
        });
        
        const top5PerSection: Record<string, Student[]> = {};
        Object.keys(sectionLeaders).forEach(key => {
          top5PerSection[key] = sectionLeaders[key]
            .sort((a, b) => (b.final?.average || 0) - (a.final?.average || 0))
            .slice(0, 5);
        });
        setGradeTop5(top5PerSection);

        // Meta calculations
        const passCount = allStudents.filter(s => (s.final?.average || 0) >= (config?.passMark || 50)).length;
        const totalAvg = allStudents.reduce((acc, s) => acc + (s.final?.average || 0), 0) / (allStudents.length || 1);

        setStats({
          totalStudents: allStudents.length,
          overallPassRate: (passCount / (allStudents.length || 1)) * 100,
          maleStudents: allStudents.filter(s => s.sex === 'M').length,
          femaleStudents: allStudents.filter(s => s.sex === 'F').length,
          averageScore: totalAvg
        });

      } catch (err) {
        console.error(err);
        toast.error('Failed to load decision metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchDecisionData();
  }, [config]);

  const exportTop20 = () => {
    const data = top20.map((s, i) => ({
      Rank: i + 1,
      Name: s.name,
      ID: s.studentId,
      Grade: `${s.grade}${s.section}`,
      Average: (s.final?.average?.toFixed(1) ?? '0.0') + '%',
      Status: s.final?.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Top_20");
    XLSX.writeFile(wb, "School_Top_20_Students.xlsx");
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <TrendingUp className="w-12 h-12 text-indigo-200 animate-pulse" />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Assembling Intelligence...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Total Students" value={stats.totalStudents} icon={Users} color="indigo" />
        <MetricCard label="School Pass Rate" value={`${(stats.overallPassRate ?? 0).toFixed(1)}%`} icon={Award} color="emerald" />
        <MetricCard label="Average Performance" value={`${(stats.averageScore ?? 0).toFixed(1)}%`} icon={TrendingUp} color="blue" />
        <MetricCard label="Gender Equality" value={`${((stats.femaleStudents / (stats.totalStudents || 1)) * 100).toFixed(0)}% F`} icon={Filter} color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* School Top 20 */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">School Top 20</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Global Academic Leaders</p>
                </div>
              </div>
              <button 
                onClick={exportTop20}
                className="flex items-center gap-2 bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold border border-gray-100 hover:bg-gray-100 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Top 20
              </button>
            </div>

            <div className="space-y-3">
              {top20.map((student, i) => (
                <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 group">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                      i < 3 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-900">{student.name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {student.studentId} • {student.grade}{student.section}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-600 block leading-none">{student.final?.average?.toFixed(1) ?? '0.0'}%</span>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Merit Score</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grade Leaders */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Grade Leaders</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Top 5 Per Grade/Section</p>
                </div>
              </div>

              <div className="space-y-8">
                {grades.map(grade => {
                  const tops = gradeTop5[`${grade.name}${grade.section}`] || [];
                  return (
                    <div key={grade.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-tighter">Grade {grade.name}{grade.section}</h4>
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{tops.length} Students</span>
                      </div>
                      <div className="space-y-2">
                        {tops.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-xs font-bold text-gray-700">{idx + 1}. {s.name}</span>
                            <span className="text-xs font-black text-indigo-600">{s.final?.average?.toFixed(1) ?? '0.0'}%</span>
                          </div>
                        ))}
                        {tops.length === 0 && <p className="text-[10px] text-gray-400 font-medium italic">No data published for this grade.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
      </div>

      {/* Batch Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Grade Batch Comparison</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Averages Across All Batches</p>
            </div>
          </div>
          <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(topByGrade).map(([grade, students]: [string, Student[]]) => ({
                  grade: `Grade ${grade}`,
                  avg: students.reduce((acc, s) => acc + (s.final?.average || 0), 0) / (students.length || 1),
                  students: students.length
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 10}} content={({ active, payload }: any) => {
                    if (active && payload?.[0]) {
                      return (
                        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100">
                          <p className="text-xs font-black text-gray-900 mb-2 uppercase tracking-widest">{payload[0].payload.grade}</p>
                          <p className="text-lg font-black text-indigo-600">{(payload[0].value ?? 0).toFixed(1)}% Avg</p>
                          <p className="text-[10px] font-bold text-gray-400">{payload[0].payload.students} Students</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="avg" fill="#6366f1" radius={[10, 10, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Curriculum Performance</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject Pass Rates School-Wide</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Students</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Pass Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                 {subjects.map(sub => {
                   const subMarks = marks.filter(m => m.subjectId === sub.id);
                   const passCount = subMarks.filter(m => (m.semester1 + m.semester2)/2 >= (config?.passMark || 50)).length;
                   const rate = subMarks.length > 0 ? (passCount / subMarks.length) * 100 : 0;
                   return (
                     <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-3 font-bold text-gray-900 text-sm">{sub.name}</td>
                       <td className="px-4 py-3 text-xs font-bold text-gray-400">{subMarks.length} Records</td>
                       <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${rate >= 75 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {rate.toFixed(1)}%
                          </span>
                       </td>
                     </tr>
                   )
                 })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 shadow-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 shadow-emerald-100',
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    purple: 'bg-purple-50 text-purple-600 shadow-purple-100'
  };
  
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-3xl font-black text-gray-900 tracking-tight">{value}</h3>
    </div>
  );
};
