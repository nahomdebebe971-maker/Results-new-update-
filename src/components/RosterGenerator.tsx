import React, { useState, useEffect } from 'react';
import { FileDown, Printer, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Subject, Grade, SchoolConfig } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const RosterGenerator: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchGrades = async () => {
      const gSnap = await getDocs(collection(db, 'grades'));
      setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
      const sSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    };
    fetchGrades();
  }, []);

  const fetchRosterData = async () => {
    if (!selectedGrade) return;
    setLoading(true);
    try {
      const [gName, gSec] = [selectedGrade.replace(/[^0-9]/g, ''), selectedGrade.replace(/[0-9]/g, '')];
      const q = query(
        collection(db, 'students'),
        where('grade', '==', gName),
        where('section', '==', gSec)
      );
      const sSnap = await getDocs(q);
      setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const data: any[] = [];
    students.forEach((s, idx) => {
      // Semester 1 Row
      const row1: any = {
        'S/N': idx + 1,
        'Name': s.name,
        'Sex': s.sex,
        'Age': s.age,
        'Term': '1st',
      };
      // Semester 2 Row
      const row2: any = { 'Term': '2nd' };
      // Average Row
      const row3: any = { 'Term': 'Ave' };

      subjects.forEach(sub => {
        const res = s.results?.[sub.name];
        row1[sub.name] = res?.semester1 || 0;
        row2[sub.name] = res?.semester2 || 0;
        row3[sub.name] = res?.average || 0;
      });

      row1['Total'] = s.semester1?.total || 0;
      row1['Average'] = s.semester1?.average.toFixed(1) || 0;
      row1['Rank'] = s.semester1?.rank || 0;

      row2['Total'] = s.semester2?.total || 0;
      row2['Average'] = s.semester2?.average.toFixed(1) || 0;
      row2['Rank'] = s.semester2?.rank || 0;

      row3['Total'] = s.final?.total || 0;
      row3['Average'] = s.final?.average.toFixed(1) || 0;
      row3['Rank'] = s.final?.rank || 0;

      data.push(row1, row2, row3);
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    XLSX.writeFile(wb, `Roster_${selectedGrade}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Grade for Roster</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
          >
            <option value="">Select Grade</option>
            {grades.map(g => (
              <option key={g.id} value={`${g.name}${g.section}`}>{g.name}{g.section}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={fetchRosterData}
          disabled={!selectedGrade || loading}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate Roster'}
        </button>
      </div>

      {students.length > 0 && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-900">Official Roster: {selectedGrade}</h3>
            <div className="flex gap-3">
              <button onClick={exportExcel} className="flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold border border-gray-100 hover:bg-gray-100 transition-all">
                <FileDown className="w-4 h-4" /> Export Excel
              </button>
              <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
                <Printer className="w-4 h-4" /> Print PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400">S/N</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400">Full Name</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Sex</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Age</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Sem</th>
                  <th colSpan={subjects.length} className="p-2 border-b border-r border-gray-200 text-center font-bold uppercase text-gray-400">Subjects</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 text-center font-bold uppercase text-gray-400">Total</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 text-center font-bold uppercase text-gray-400">Avg</th>
                  <th rowSpan={2} className="p-2 text-center font-bold uppercase text-gray-400">Rank</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {subjects.map(s => (
                    <th key={s.id} className="p-1 border-r border-gray-200 text-center font-bold text-[10px] text-gray-500">{s.name.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-gray-50/50">
                      <td rowSpan={3} className="p-2 border-r border-gray-200 font-bold text-center">{idx + 1}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 font-bold text-gray-900">{s.name}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 text-center">{s.sex}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 text-center">{s.age}</td>
                      <td className="p-1 border-r border-gray-200 text-[10px] font-bold text-gray-500">1st</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center font-medium">{s.results?.[sub.name]?.semester1 || 0}</td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester1?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester1?.average.toFixed(1)}</td>
                      <td className="p-1 text-center font-bold">{s.semester1?.rank}</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="p-1 border-r border-gray-200 text-[10px] font-bold text-gray-500">2nd</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center font-medium">{s.results?.[sub.name]?.semester2 || 0}</td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester2?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester2?.average.toFixed(1)}</td>
                      <td className="p-1 text-center font-bold">{s.semester2?.rank}</td>
                    </tr>
                    <tr className="bg-gray-50/30 hover:bg-gray-50/50 font-black">
                      <td className="p-1 border-r border-gray-200 text-[10px] uppercase">Ave</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center">{s.results?.[sub.name]?.average.toFixed(1) || 0}</td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center border-t border-gray-200">{s.final?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center border-t border-gray-200">{s.final?.average.toFixed(1)}</td>
                      <td className="p-1 text-center border-t border-gray-200">{s.final?.rank}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
