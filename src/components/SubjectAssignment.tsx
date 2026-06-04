import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Users, BookOpen, GraduationCap, 
  Loader2, AlertTriangle, CheckCircle2 
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
  const [formData, setFormData] = useState({
    teacherId: '',
    subjectId: '',
    gradeId: ''
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { teacherId, subjectId, gradeId } = formData;
    if (!teacherId || !subjectId || !gradeId) return;

    const teacher = teachers.find(t => t.id === teacherId);
    const subject = subjects.find(s => s.id === subjectId);
    const grade = grades.find(g => g.id === gradeId);

    if (!teacher || !subject || !grade) return;

    const assignmentId = `${teacherId}_${subjectId}_${gradeId}`;
    
    try {
      await setDoc(doc(db, 'assignments', assignmentId), {
        teacherId,
        teacherName: teacher.name,
        subjectId,
        subjectName: subject.name,
        gradeId,
        gradeName: grade.name,
        section: grade.section,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      toast.success('Assignment created successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create assignment.');
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
          <p className="text-gray-500 font-medium">Assign teachers to specific subjects and sections.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" /> New Assignment
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-xl"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Teacher</label>
                <select 
                  required
                  value={formData.teacherId}
                  onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.teacherId})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Subject</label>
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Grade & Section</label>
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

              <div className="md:col-span-3 flex gap-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold">Assign Teacher</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((as) => (
          <motion.div 
            layout
            key={as.id}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <button 
                onClick={() => handleDelete(as.id)}
                className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-black text-gray-900 text-lg leading-tight">{as.teacherName}</h3>
              <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">{as.subjectName}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Grade {as.gradeName}{as.section}</span>
              </div>
            </div>

            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform">
              <BookOpen className="w-20 h-20 text-indigo-600" />
            </div>
          </motion.div>
        ))}
        {assignments.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No assignments found. Start by assigning a teacher.</p>
          </div>
        )}
      </div>
    </div>
  );
};
