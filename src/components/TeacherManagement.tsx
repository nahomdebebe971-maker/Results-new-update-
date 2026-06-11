import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Loader2, FileDown, Search, FileText } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Teacher, SubjectAssignment, SchoolConfig, Grade } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

import { logAction } from '../lib/auditService';
import { useAuth } from '../hooks/useAuth';
import { generateTeacherDoc } from '../lib/teacherPdf';
import { trackOperation } from '../lib/metrics';

export const TeacherManagement: React.FC = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', teacherId: '' });

  useEffect(() => {
    const q = query(collection(db, 'teachers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanId = formData.teacherId.trim();

    if (!cleanName || !cleanId) return;
    try {
      const docRef = await addDoc(collection(db, 'teachers'), {
        name: cleanName,
        teacherId: cleanId,
        createdAt: new Date().toISOString(),
      });
      await trackOperation('TEACHER_MGT', `Registered Teacher: ${cleanName}`, { writes: 1 });
      
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'TEACHER_EDIT',
          `Registered new teacher: ${cleanName} (${cleanId})`,
          docRef.id
        );
      }
      
      setFormData({ name: '', teacherId: '' });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete teacher record for ${name}?`)) {
      await deleteDoc(doc(db, 'teachers', id));
      await trackOperation('TEACHER_MGT', `Removed Teacher: ${name}`, { deletes: 1, writes: 1 });
      
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'TEACHER_EDIT',
          `Deleted teacher record: ${name}`,
          id
        );
      }
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teachers.map(t => ({ Name: t.name, 'Teacher ID': t.teacherId, 'Created At': t.createdAt })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, 'Teachers_Roll.xlsx');
  };

  const handleExportPdf = async (specificTeacher?: Teacher) => {
    try {
      toast.loading('Preparing teacher documents...', { id: 'pdf-gen' });
      
      // Fetch Required Data
      const [assignSnap, configSnap, gradesSnap, studentSnap] = await Promise.all([
        getDocs(collection(db, 'assignments')),
        getDoc(doc(db, 'settings', 'school_config')),
        getDocs(collection(db, 'grades')),
        getDocs(collection(db, 'students'))
      ]);

      const assignments = assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectAssignment));
      const config = configSnap.exists() ? configSnap.data() as SchoolConfig : {} as SchoolConfig;
      const grades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
      
      const studentCounts: Record<string, number> = {};
      studentSnap.docs.forEach(d => {
        const s = d.data();
        const key = `${s.grade}_${s.section}`;
        studentCounts[key] = (studentCounts[key] || 0) + 1;
      });

      const targets = specificTeacher ? [specificTeacher] : teachers;
      await generateTeacherDoc(targets, assignments, config, grades, studentCounts);
      
      toast.success(specificTeacher ? `Document generated for ${specificTeacher.name}` : 'All teacher documents generated', { id: 'pdf-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF document', { id: 'pdf-gen' });
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.teacherId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Teacher Management</h2>
          <p className="text-gray-500 font-medium">Manage your school's teaching staff.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => handleExportPdf()}
            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-100 px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-all text-sm"
          >
            <FileText className="w-5 h-5" /> Generate All Info Docs
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
          >
            <FileDown className="w-5 h-5" /> Export Excel
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Add Teacher
          </button>
        </div>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="Search by name or ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-50/50"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Nahom Debebe"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Teacher ID</label>
                <input 
                  required
                  type="text" 
                  value={formData.teacherId}
                  onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                  placeholder="e.g. T1001"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  Default login passkey: <span className="text-indigo-600">1234</span>
                </p>
              </div>
              <div className="md:col-span-2 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Register Teacher
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Teacher Name</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Teacher ID</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                      {teacher.name.charAt(0)}
                    </div>
                    <span className="font-bold text-gray-900">{teacher.name}</span>
                  </div>
                </td>
                <td className="px-8 py-4">
                  <span className="text-sm font-mono font-bold text-gray-500">{teacher.teacherId}</span>
                </td>
                <td className="px-8 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleExportPdf(teacher)}
                      title="Generate Information Document"
                      className="p-2 text-gray-300 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(teacher.id, teacher.name)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTeachers.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-8 py-20 text-center text-gray-400 font-medium">No teachers found matching your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
