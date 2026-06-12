import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, GraduationCap, Loader2, Upload, 
  FileDown, Search, Filter, X, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { 
  collection, addDoc, deleteDoc, doc, getDoc, onSnapshot, 
  query, orderBy, setDoc, getDocs, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade, Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { generateStudentTranscript } from '../lib/pdfGenerator';
import { IdCardGenerator } from './IdCardGenerator';
import { StudentImport } from './StudentImport';

interface ImportPreview {
  name: string;
  sex: 'M' | 'F';
  age: number;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

import { logAction } from '../lib/auditService';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import { trackOperation } from '../lib/metrics';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const { showModal } = useModal();
  const { config } = useSchoolConfig();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showIdGen, setShowIdGen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', sex: 'M' as 'M' | 'F', age: 18, grade: '', section: '' });
  
  // Bulk Import state
  const [showImportModal, setShowImportModal] = useState(false);


  useEffect(() => {
    const qS = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    trackOperation('STUDENT_MGT', 'View Student Catalog', { reads: 1 });
    const unsubscribeS = onSnapshot(qS, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    });

    const qG = query(collection(db, 'grades'));
    const unsubscribeG = onSnapshot(qG, (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    const qSub = query(collection(db, 'subjects'));
    const unsubscribeSub = onSnapshot(qSub, (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    return () => {
      unsubscribeS();
      unsubscribeG();
      unsubscribeSub();
    };
  }, []);

  const handleDownloadTranscript = async (student: Student) => {
    if (!config) {
      toast.error('School configuration not loaded.');
      return;
    }
    
    try {
      const gradeObj = grades.find(g => g.name === student.grade && g.section === student.section);
      const htName = gradeObj?.homeroomTeacher || '________________';
      
      await generateStudentTranscript(student, config, subjects, htName);
      toast.success(`Generated transcript for ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF.');
    }
  };

  const generateId = async (existingIds: string[]) => {
    let id = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      attempts++;
      const digits = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      id = `ST${digits}`;
      // Local uniqueness check
      if (!existingIds.includes(id)) {
        // Direct database document availability verification
        try {
          const docRef = doc(db, 'students', id);
          const snap = await getDoc(docRef);
          if (!snap.exists()) {
            isUnique = true;
          }
        } catch {
          // If query fails, assume unique if it passed local check
          isUnique = true;
        }
      }
    }
    return id;
  };



  const handleDelete = async (studentId: string, name: string) => {
    showModal({
      title: 'Delete Student Profile',
      message: `You are about to permanently delete the profile for ${name}. This action will void their student ID, clear their attendance history, and purge all scholastic records.`,
      type: 'warning',
      confirmText: 'Permanently Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'students', studentId));
          await trackOperation('STUDENT_MGT', `Deleted Student: ${name}`, { deletes: 1, writes: 1 });
          if (user) {
            await logAction(
              user.uid,
              user.email || '',
              'STUDENT_EDIT',
              `Deleted student record: ${name} (${studentId})`,
              studentId
            );
          }
          toast.success('Student record purged from primary ledger.');
        } catch (err) {
          toast.error('Failed to eliminate student record.');
        }
      }
    });
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
    const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
    return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.grade) return;
    
    const existingIds = students.map(s => s.studentId);
    const studentId = await generateId(existingIds);
    try {
      await setDoc(doc(db, 'students', studentId), {
        ...formData,
        studentId,
        createdAt: new Date().toISOString(),
      });
      await trackOperation('STUDENT_MGT', `Added Student: ${formData.name}`, { writes: 1 });

      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'STUDENT_EDIT',
          `Added new student: ${formData.name} (${studentId}) to Grade ${formData.grade}${formData.section}`,
          studentId
        );
      }

      setFormData({ name: '', sex: 'M', age: 18, grade: '', section: '' });
      setShowAdd(false);
      toast.success('Student added successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add student.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Student Management</h2>
          <p className="text-gray-500 font-medium">Add students manually or import from file.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowIdGen(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-700 border border-indigo-200/50 px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-all text-sm cursor-pointer"
          >
            <IconsBadgeDecal className="w-4 h-4 text-indigo-505" /> Generate ID Cards
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm cursor-pointer"
          >
            <Upload className="w-5 h-5" /> Import Bulk
          </button>
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
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleDownloadTranscript(s)}
                      className="p-2 text-gray-300 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                      title="Download Transcript"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(s.studentId, s.name)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Id Card Generator Integration Tag */}
      <IdCardGenerator 
        isOpen={showIdGen} 
        onClose={() => setShowIdGen(false)} 
        students={students} 
        grades={grades} 
        config={config} 
      />

      {/* Student Import System */}
      <StudentImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        grades={grades}
        students={students}
      />
    </div>
  );
};

const IconsBadgeDecal = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 2H9a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
    <path d="M12 18h.01" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
