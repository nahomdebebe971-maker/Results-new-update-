import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Users, BookOpen, GraduationCap, 
  Loader2, AlertTriangle, CheckCircle2, Pencil, Key, Info, HelpCircle
} from 'lucide-react';
import { 
  collection, getDocs, setDoc, doc, deleteDoc, 
  onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Teacher, Subject, Grade, SubjectAssignment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { trackOperation } from '../lib/metrics';

export const SubjectAssignmentManager: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filter States
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredAssignments = assignments.filter(a => {
    const matchesGrade = !filterGrade || a.gradeName === filterGrade;
    const matchesSection = !filterSection || a.section === filterSection;
    const matchesSubject = !filterSubject || a.subjectName === filterSubject;
    const matchesSearch = !searchTerm || 
      a.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.gradeName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesGrade && matchesSection && matchesSubject && matchesSearch;
  });

  const getUniqueSections = () => {
    const sections = new Set(grades.map(g => g.section));
    return Array.from(sections).sort();
  };

  const getUniqueGradeNames = () => {
    const names = new Set(grades.map(g => g.name));
    return Array.from(names).sort();
  };

  const handleEdit = (as: any) => {
    const matchedTeacher = teachers.find(t => 
      t.id === as.teacherDocId || 
      t.teacherId === as.teacherId || 
      t.id === as.teacherId
    );
    setFormData({
      teacherId: matchedTeacher ? matchedTeacher.id : '',
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

    if (!teacher || !subject || !grade) {
      toast.error('Selected entities are invalid. Re-check options.');
      return;
    }

    const assignmentId = editingId || `${teacher.teacherId}_${subjectId}_${gradeId}`;
    
    try {
      await setDoc(doc(db, 'assignments', assignmentId), {
        teacherId: teacher.teacherId, // Custom Stable Teacher ID (e.g. TCH001)
        teacherDocId: teacher.id, // Firestore document ID reference
        teacherName: teacher.name,
        subjectId,
        subjectName: subject.name,
        gradeId,
        gradeName: grade.name,
        section: grade.section,
        passkey: passkey.trim(),
        createdAt: new Date().toISOString()
      });
      await trackOperation('SUBJECT_ASSIGN', `Assigned ${subject.name} to ${teacher.name}`, { writes: 1 });
      setShowAdd(false);
      setEditingId(null);
      setFormData({ teacherId: '', subjectId: '', gradeId: '', passkey: '' });
      toast.success(editingId ? 'Teacher assignment updated successfully!' : 'New teacher assignment configured!');
    } catch (err) {
      console.error(err);
      toast.error('Save operation failed. Please connect with the main ledger.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you absolutely sure you want to remove this teacher assignment?')) {
      try {
        await deleteDoc(doc(db, 'assignments', id));
        await trackOperation('SUBJECT_ASSIGN', 'Removed Subject Assignment', { deletes: 1, writes: 1 });
        toast.success('Assignment deleted successfully.');
      } catch {
        toast.error('Failed to clear assignment.');
      }
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest text-xs">Loading assignment registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Teacher Assignments</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Link instructors to dynamic courses and sections with passkeys.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ teacherId: '', subjectId: '', gradeId: '', passkey: '' });
            setShowAdd(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> New Assignment
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">Grade</label>
               <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20"
               >
                  <option value="">All Grades</option>
                  {getUniqueGradeNames().map(n => <option key={n} value={n}>{n}</option>)}
               </select>
            </div>
            <div className="md:col-span-1">
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">Section</label>
               <select 
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20"
               >
                  <option value="">All Sections</option>
                  {getUniqueSections().map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            <div className="md:col-span-2">
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">Search Table</label>
               <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teacher, subject or grade..."
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20"
               />
            </div>
         </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-indigo-50 dark:border-indigo-950/40 shadow-xl"
          >
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-xs text-indigo-500">
              {editingId ? 'Modify Teaching Alignment' : 'Establish Teaching Assignment'}
            </h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Teacher</label>
                <select 
                  required
                  value={formData.teacherId}
                  onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white transition-all font-bold"
                >
                  <option value="" className="text-gray-400">Select Instructor</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grade & Section</label>
                <select 
                  required
                  value={formData.gradeId}
                  onChange={e => {
                    const gradeId = e.target.value;
                    const gradeDoc = grades.find(g => g.id === gradeId);
                    let newSubjectId = formData.subjectId;
                    if (gradeDoc && gradeDoc.subjectIds && gradeDoc.subjectIds.length > 0) {
                      if (!gradeDoc.subjectIds.includes(formData.subjectId)) {
                        newSubjectId = '';
                      }
                    }
                    setFormData({ ...formData, gradeId, subjectId: newSubjectId });
                  }}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white transition-all font-bold"
                >
                  <option value="">Choose Grade Target</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>Grade {g.name}{g.section}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Instructional Subject</label>
                <select 
                  required
                  disabled={!formData.gradeId}
                  value={formData.subjectId}
                  onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white transition-all font-bold disabled:opacity-50"
                >
                  <option value="">{!formData.gradeId ? "Select Grade first..." : "Select Subject"}</option>
                  {(() => {
                    const selectedGradeDoc = grades.find(g => g.id === formData.gradeId);
                    const filteredSubjects = selectedGradeDoc 
                      ? (selectedGradeDoc.subjectIds && selectedGradeDoc.subjectIds.length > 0
                          ? subjects.filter(s => selectedGradeDoc.subjectIds!.includes(s.id))
                          : subjects)
                      : subjects;
                    return filteredSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ));
                  })()}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Manual Verification Passkey</label>
                <div className="relative">
                  <input 
                    required
                    type="text"
                    placeholder="e.g. CHEM11A2025"
                    value={formData.passkey}
                    onChange={e => setFormData({ ...formData, passkey: e.target.value })}
                    className="w-full p-4 pl-12 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white transition-all font-mono font-bold tracking-widest uppercase placeholder:tracking-normal placeholder:font-sans"
                  />
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row gap-4 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAdd(false);
                    setEditingId(null);
                  }} 
                  className="w-full sm:w-auto px-8 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-full sm:flex-grow py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                >
                  {editingId ? 'Save Changes' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850/85 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[700px] border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-8 py-5">Instructor Name</th>
              <th className="px-8 py-5">Course / Subject</th>
              <th className="px-8 py-5">Assigned Class</th>
              <th className="px-8 py-5">Security Passkey</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {filteredAssignments.map((as) => (
              <tr key={as.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition-colors group">
                <td className="px-8 py-4.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="font-extrabold text-gray-900 dark:text-white">{as.teacherName}</span>
                  </div>
                </td>
                <td className="px-8 py-4.5">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                    <BookOpen className="w-4 h-4" /> {as.subjectName}
                  </div>
                </td>
                <td className="px-8 py-4.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                  Grade {as.gradeName}{as.section}
                </td>
                <td className="px-8 py-4.5">
                  <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 px-3.5 py-1.5 rounded-xl text-xs font-mono font-black text-gray-600 dark:text-gray-300">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    {as.passkey}
                  </span>
                </td>
                <td className="px-8 py-4.5 text-right">
                  <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(as)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all"
                      title="Edit Assignment"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(as.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all"
                      title="Delete Assignment"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-16 text-center text-gray-400 dark:text-gray-500 font-bold">No Teaching Assignment Alignments have been defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
