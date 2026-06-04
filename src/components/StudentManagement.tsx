import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GraduationCap, Loader2, Upload, FileDown, Search, Filter } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', sex: 'M' as 'M' | 'F', age: 18, grade: '', section: '' });

  useEffect(() => {
    const qS = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribeS = onSnapshot(qS, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    });

    const qG = query(collection(db, 'grades'));
    const unsubscribeG = onSnapshot(qG, (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    return () => {
      unsubscribeS();
      unsubscribeG();
    };
  }, []);

  const generateId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `ST${num}`;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.grade) return;
    
    const studentId = generateId();
    try {
      await setDoc(doc(db, 'students', studentId), {
        ...formData,
        studentId,
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '', sex: 'M', age: 18, grade: '', section: '' });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      // Preview logic would go here, but for now we direct import
      for (const row of data) {
        const studentId = generateId();
        await setDoc(doc(db, 'students', studentId), {
          name: row.Name,
          sex: row.Sex || 'M',
          age: parseInt(row.Age) || 18,
          grade: row.Grade?.toString() || '',
          section: row.Section?.toString() || '',
          studentId,
          createdAt: new Date().toISOString(),
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Student Management</h2>
          <p className="text-gray-500 font-medium">Add students manually or import from file.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm cursor-pointer">
            <Upload className="w-5 h-5" /> Import Bulk
            <input type="file" className="hidden" accept=".xlsx,.csv,.txt" onChange={handleBulkImport} />
          </label>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Add Student
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        <button className="bg-white border border-gray-100 p-4 rounded-2xl text-gray-400 hover:text-indigo-600 transition-colors">
          <Filter className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-50/50"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sex</label>
                <select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value as 'M' | 'F' })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Age</label>
                <input type="number" value={formData.age} onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade</label>
                <select required value={formData.grade} onChange={e => {
                  const g = grades.find(gr => gr.name === e.target.value);
                  setFormData({ ...formData, grade: e.target.value });
                }} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="">Select Grade</option>
                  {[...new Set(grades.map(g => g.name))].map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Section</label>
                <select required value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="">Select Section</option>
                  {grades.filter(g => g.name === formData.grade).map(g => (
                    <option key={g.id} value={g.section}>{g.section}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4 flex gap-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold">Save Student</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">ID</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Grade</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Section</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">{s.name}</span>
                      <span className="text-[10px] uppercase font-bold text-gray-400">{s.sex} • {s.age} Yrs</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-4 font-mono text-sm font-bold text-gray-500">{s.studentId}</td>
                <td className="px-8 py-4 font-bold text-gray-700">{s.grade}</td>
                <td className="px-8 py-4 font-bold text-gray-700">{s.section}</td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => deleteDoc(doc(db, 'students', s.id))} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
