import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, query, where, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Subject, Mark, Grade, SchoolConfig } from '../types';
import { 
  X, FileSpreadsheet, Search, Filter, 
  ArrowUpDown, Loader2, Award, BookOpen, Users
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

interface GradeResultsTableProps {
  grade: Grade;
  config: SchoolConfig;
  onClose: () => void;
}

export const GradeResultsTable: React.FC<GradeResultsTableProps> = ({ grade, config, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Students
        const qS = query(
          collection(db, 'students'),
          where('grade', '==', grade.name),
          where('section', '==', grade.section)
        );
        const sSnap = await getDocs(qS);
        const studentsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));

        // 2. Fetch Subjects
        const subSnap = await getDocs(query(collection(db, 'subjects'), orderBy('name', 'asc')));
        const subjectsList = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));

        // 3. Fetch Marks
        const qM = query(
          collection(db, 'marks'),
          where('grade', '==', grade.name),
          where('section', '==', grade.section)
        );
        const mSnap = await getDocs(qM);
        const marksList = mSnap.docs.map(d => d.data() as Mark);

        setStudents(studentsList);
        setSubjects(subjectsList);
        setMarks(marksList);
      } catch (err) {
        console.error('Error fetching grade results:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [grade]);

  const getMark = (studentId: string, subject: Subject) => {
    // Try by UID first (new system), then by Name (old system)
    return marks.find(m => 
      m.studentId === studentId && 
      (m.subjectId === subject.id || m.subjectId === subject.name)
    );
  };

  const formatMark = (val: number | undefined | null) => {
    if (val === undefined || val === null) return 'Unfilled';
    return val.toString();
  };

  const formatSummaryValue = (val: number | undefined | null, isPercentage: boolean = false) => {
    if (val === undefined || val === null) return 'N/A';
    return isPercentage ? `${val.toFixed(1)}%` : val.toFixed(1);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedStudents = () => {
    const items = [...filteredStudents];
    if (sortConfig) {
      items.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sortConfig.key === 'name') {
          aVal = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
          bVal = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        } else if (sortConfig.key === 'id') {
          aVal = a.studentId.toLowerCase();
          bVal = b.studentId.toLowerCase();
        } else if (sortConfig.key === 'finalAvg') {
          aVal = a.final?.average || -1;
          bVal = b.final?.average || -1;
        } else if (sortConfig.key === 'finalRank') {
          aVal = a.final?.rank || 9999;
          bVal = b.final?.rank || 9999;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default: Alphabetical sort by Name (A-Z)
      items.sort((a, b) => {
        const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    return items;
  };

  const sortedStudents = getSortedStudents();

  const exportToExcel = () => {
    const data = sortedStudents.map(student => {
      const row: any = {
        'Student ID': student.studentId,
        'Name': student.name,
        'Sex': student.sex,
        'Age': student.age
      };

      subjects.forEach(sub => {
        const m = getMark(student.studentId, sub);
        row[`${sub.name} (S1)`] = m ? m.semester1 : 'Unfilled';
        row[`${sub.name} (S2)`] = m ? m.semester2 : 'Unfilled';
        row[`${sub.name} (Avg)`] = m ? ((m.semester1 + m.semester2) / 2).toFixed(1) : 'Unfilled';
      });

      row['S1 Total'] = student.semester1?.total || 'N/A';
      row['S1 Avg'] = student.semester1?.average.toFixed(1) || 'N/A';
      row['S1 Rank'] = student.semester1?.rank || 'N/A';
      row['S1 Status'] = student.semester1?.status || 'N/A';

      row['S2 Total'] = student.semester2?.total || 'N/A';
      row['S2 Avg'] = student.semester2?.average.toFixed(1) || 'N/A';
      row['S2 Rank'] = student.semester2?.rank || 'N/A';
      row['S2 Status'] = student.semester2?.status || 'N/A';

      row['Final Total'] = student.final?.total || 'N/A';
      row['Final Avg'] = student.final?.average.toFixed(1) || 'N/A';
      row['Final Rank'] = student.final?.rank || 'N/A';
      row['Final Status'] = student.final?.status || 'N/A';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Results_${grade.name}${grade.section}`);
    XLSX.writeFile(workbook, `Grade_${grade.name}${grade.section}_Results.xlsx`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Aggregating Academic Data...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white z-50 flex flex-col"
    >
      {/* Header */}
      <div className="bg-gray-900 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">
            {grade.name}{grade.section}
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Grade {grade.name}{grade.section} - Comprehensive Results</h2>
            <p className="text-indigo-300 text-sm font-medium">Monitoring Dashboard • View Only Mode</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
            />
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button 
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-red-500 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-grow overflow-auto p-4 md:p-8">
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden min-w-max">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Complex Header */}
              <tr className="bg-gray-900 border-b border-gray-800 text-white">
                <th colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-center border-r border-gray-800">Student Profile</th>
                {subjects.map(sub => (
                  <th key={sub.id} colSpan={3} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-center border-r border-gray-800 bg-gray-800/50">
                    {sub.name}
                  </th>
                ))}
                <th colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-center border-r border-gray-800 bg-indigo-900/30">Semester 1</th>
                <th colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-center border-r border-gray-800 bg-purple-900/30">Semester 2</th>
                <th colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-center bg-emerald-900/30">Final Result</th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0 z-10">
                <th onClick={() => handleSort('id')} className="px-6 py-3 border-r border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2">ID <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('name')} className="px-6 py-3 border-r border-gray-100 min-w-[200px] cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2">Student Name <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-3 border-r border-gray-100">Sex</th>
                <th className="px-6 py-3 border-r border-gray-100">Age</th>
                
                {subjects.map(sub => (
                  <React.Fragment key={sub.id}>
                    <th className="px-4 py-3 border-r border-gray-100 text-center">S1</th>
                    <th className="px-4 py-3 border-r border-gray-100 text-center">S2</th>
                    <th className="px-4 py-3 border-r border-gray-100 text-center bg-gray-100/50">Avg</th>
                  </React.Fragment>
                ))}

                <th className="px-4 py-3 border-r border-gray-100 text-center">Total</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Avg</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Rank</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Status</th>

                <th className="px-4 py-3 border-r border-gray-100 text-center">Total</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Avg</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Rank</th>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Status</th>

                <th className="px-4 py-3 border-r border-gray-100 text-center">Total</th>
                <th onClick={() => handleSort('finalAvg')} className="px-4 py-3 border-r border-gray-100 text-center cursor-pointer hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center justify-center gap-1">Avg <ArrowUpDown className="w-2 h-2" /></div>
                </th>
                <th onClick={() => handleSort('finalRank')} className="px-4 py-3 border-r border-gray-100 text-center cursor-pointer hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center justify-center gap-1">Rank <ArrowUpDown className="w-2 h-2" /></div>
                </th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedStudents.map(student => (
                <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4 font-mono text-xs text-gray-400 border-r border-gray-50">{student.studentId}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 border-r border-gray-50 whitespace-nowrap">{student.name}</td>
                  <td className="px-6 py-4 text-center border-r border-gray-50 text-xs font-bold text-gray-500">{student.sex}</td>
                  <td className="px-6 py-4 text-center border-r border-gray-50 text-xs font-bold text-gray-500">{student.age}</td>

                  {subjects.map(sub => {
                    const m = getMark(student.studentId, sub);
                    const avg = m ? (m.semester1 + m.semester2) / 2 : null;
                    return (
                      <React.Fragment key={sub.id}>
                        <td className={`px-4 py-4 text-center border-r border-gray-50 text-xs font-bold ${!m ? 'text-amber-400 italic' : 'text-gray-900'}`}>
                          {formatMark(m?.semester1)}
                        </td>
                        <td className={`px-4 py-4 text-center border-r border-gray-50 text-xs font-bold ${!m ? 'text-amber-400 italic' : 'text-gray-900'}`}>
                          {formatMark(m?.semester2)}
                        </td>
                        <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black text-indigo-600 bg-indigo-50/10">
                          {avg !== null ? avg.toFixed(1) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* S1 Summary */}
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-bold text-gray-700 bg-indigo-50/5">
                    {formatSummaryValue(student.semester1?.total)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black text-indigo-600 bg-indigo-50/5">
                    {formatSummaryValue(student.semester1?.average, true)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-bold text-amber-600 bg-indigo-50/5">
                    {student.semester1?.rank || '—'}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black bg-indigo-50/5">
                    <span className={student.semester1?.status === 'Pass' ? 'text-emerald-500' : 'text-rose-500'}>
                      {student.semester1?.status || '—'}
                    </span>
                  </td>

                  {/* S2 Summary */}
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-bold text-gray-700 bg-purple-50/5">
                    {formatSummaryValue(student.semester2?.total)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black text-purple-600 bg-purple-50/5">
                    {formatSummaryValue(student.semester2?.average, true)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-bold text-amber-600 bg-purple-50/5">
                    {student.semester2?.rank || '—'}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black bg-purple-50/5">
                    <span className={student.semester2?.status === 'Pass' ? 'text-emerald-500' : 'text-rose-500'}>
                      {student.semester2?.status || '—'}
                    </span>
                  </td>

                  {/* Final Summary */}
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-bold text-gray-700 bg-emerald-50/5">
                    {formatSummaryValue(student.final?.total)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black text-emerald-600 bg-emerald-50/5">
                    {formatSummaryValue(student.final?.average, true)}
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-50 text-xs font-black text-amber-600 bg-emerald-50/5">
                    {student.final?.rank || '—'}
                  </td>
                  <td className="px-4 py-4 text-center text-xs font-black bg-emerald-50/5">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${
                      student.final?.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {student.final?.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div className="py-20 text-center">
              <Users className="w-16 h-16 text-gray-100 mx-auto mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No students matched your search</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        <div className="flex gap-6">
          <span>Total Students: {students.length}</span>
          <span>Subjects Monitored: {subjects.length}</span>
        </div>
        <div>
          Any values marked <span className="text-amber-500 italic">"Unfilled"</span> require teacher attention.
        </div>
      </div>
    </motion.div>
  );
};
