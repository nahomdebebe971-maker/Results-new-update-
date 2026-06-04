import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Users, BookOpen, GraduationCap, 
  Loader2, AlertTriangle, CheckCircle2, Pencil 
} from 'lucide-react';
import { 
  collection, getDocs, setDoc, doc, deleteDoc, 
  onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Teacher, Subject, Grade, SubjectAssignment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

export const SubjectAssignmentManager: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    teacherId: '',
    subjectId: '',
    gradeId: '',
    passkey: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const tSnap = await getDocs(query(collection(db, 'teachers'), orderBy('name', 'asc')));
      setTeachers(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));

      const sSnap = await getDocs(query(collection(db, 'subjects'), orderBy('name', 'asc')));
      setSubjects(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));

      const gSnap = await getDocs(query(collection(db, 'grades'), orderBy('name', 'asc'), orderBy('section', 'asc')));
      setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));

      const unsubscribe = onSnapshot(collection(db, 'assignments'), (snap) => {
        setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectAssignment)));
        setLoading(false);
      });
      return unsubscribe;
    };
    fetchData();
  }, []);

  const handleEdit = (as: SubjectAssignment) => {
    setFormData({
      teacherId: as.teacherId,
      subjectId: as.subjectId,
      gradeId: as.gradeId,
      passkey: as.passkey
    });
    setEditingId(as.id);
    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { teacherId, subjectId, gradeId, passkey } = formData;
    if (!teacherId || !subjectId || !gradeId || !passkey) return;

    const teacher = teachers.find(t => t.id === teacherId);
    const subject = subjects.find(s => s.id === subjectId);
    const grade = grades.find(g => g.id === gradeId);

    if (!teacher || !subject || !grade) return;

    // Use specific ID if adding new, or reuse if editing
    const assignmentId = editingId || `${teacherId}_${subjectId}_${gradeId}`;
    
    try {
      await setDoc(doc(db, 'assignments', assignmentId), {
        teacherId,
        teacherName: teacher.name,
        subjectId,
        subjectName: subject.name,
        gradeId,
        gradeName: grade.name,
        section: grade.section,
        passkey,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setEditingId(null);
      setFormData({ teacherId: '', subjectId: '', gradeId: '', passkey: '' });
      toast.success(editingId ? 'Assignment updated!' : 'Assignment created!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process assignment.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove this assignment?')) {
      await deleteDoc(doc(db, 'assignments', id));
      toast.success('Assignment removed.');
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Teacher Assignments</h2>
          <p className="text-gray-500 font-medium">Assign teachers to specific subjects and sections with passkeys.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ teacherId: '', subjectId: '', gradeId: '', passkey: '' });
            setShowAdd(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" /> New Assignment
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-xl"
          >
            <h3 className="text-lg font-black text-gray-900 mb-6">{editingId ? 'Edit Assignment' : 'Create New Assignment'}</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Teacher</label>
                <select 
                  required
                  value={formData.teacherId}
                  onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject</label>
                <select 
                  required
                  value={formData.subjectId}
                  onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade & Section</label>
                <select 
                  required
                  value={formData.gradeId}
                  onChange={e => setFormData({ ...formData, gradeId: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Class</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>Grade {g.name}{g.section}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manual Passkey</label>
                <div className="relative">
                  <input 
                    required
                    type="text"
                    placeholder="e.g. CHEM11A2025"
                    value={formData.passkey}
                    onChange={e => setFormData({ ...formData, passkey: e.target.value })}
                    className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                  />
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="lg:col-span-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAdd(false);
                    setEditingId(null);
                  }} 
                  className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">
                  {editingId ? 'Update Assignment' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 font-black text-[10px] text-gray-400 uppercase tracking-widest">
              <th className="px-8 py-5">Teacher</th>
              <th className="px-8 py-5">Subject</th>
              <th className="px-8 py-5">Grade / Section</th>
              <th className="px-8 py-5">Passkey</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {assignments.map((as) => (
              <tr key={as.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-gray-900">{as.teacherName}</span>
                  </div>
                </td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <BookOpen className="w-4 h-4" /> {as.subjectName}
                  </div>
                </td>
                <td className="px-8 py-4 text-sm font-bold text-gray-700">
                  Grade {as.gradeName}{as.section}
                </td>
                <td className="px-8 py-4">
                  <code className="bg-gray-100 px-3 py-1 rounded text-xs font-mono font-black text-gray-500">{as.passkey}</code>
                </td>
                <td className="px-8 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleEdit(as)}
                      className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(as.id)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium">No teaching assignments available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
