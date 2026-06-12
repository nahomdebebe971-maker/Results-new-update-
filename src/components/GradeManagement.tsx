import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  UsersRound, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  Eye, 
  FileDown, 
  FileSpreadsheet, 
  GraduationCap, 
  X,
  TrendingUp,
  Sparkles,
  Award,
  BookOpen,
  Pencil,
  MessageSquare
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Grade, Student, Subject, Teacher } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { toast } from 'react-hot-toast';
import { useModal } from '../context/ModalContext';
import { trackOperation } from '../lib/metrics';
import { GradeResultsTable } from './GradeResultsTable';
import { publishGradeResults, ProgressData } from '../lib/resultService';
import { PublishProgressModal } from './PublishProgressModal';
import { generateRosterPDF, generateRosterExcel, isMaleGender, isStudentDropout } from './RosterGenerator';
import { generateAllStudentTranscriptsForGrade } from '../lib/pdfGenerator';

import { useProgress } from '../context/ProgressContext';

export const GradeManagement: React.FC = () => {
  const { showModal } = useModal();
  const [grades, setGrades] = useState<Grade[]>([]);
  const { config, updateConfig } = useSchoolConfig();
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', section: '', homeroomTeacher: '', subjectIds: [] as string[] });
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [systemSubjects, setSystemSubjects] = useState<Subject[]>([]);
  
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();
  
  // High-performance actions states
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});
  const [analyticsGrade, setAnalyticsGrade] = useState<{grade: Grade; students: Student[]; subjects: Subject[]} | null>(null);
  const [publishProgress, setPublishProgress] = useState<ProgressData | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'grades'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qT = query(collection(db, 'teachers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(qT, (snap) => {
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qS = query(collection(db, 'subjects'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(qS, (snap) => {
      setSystemSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.section) return;
    try {
      if (editingGrade) {
        // Edit existing grade
        await updateDoc(doc(db, 'grades', editingGrade.id), {
          name: formData.name.trim(),
          section: formData.section.trim(),
          homeroomTeacher: formData.homeroomTeacher,
          subjectIds: formData.subjectIds
        });
        await trackOperation('GRADE_MGT', `Updated Grade: ${formData.name}${formData.section}`, { writes: 1 });
        toast.success(`Grade ${formData.name}${formData.section} updated successfully!`);
        setEditingGrade(null);
      } else {
        // Create new grade
        await addDoc(collection(db, 'grades'), {
          name: formData.name.trim(),
          section: formData.section.trim(),
          homeroomTeacher: formData.homeroomTeacher,
          subjectIds: formData.subjectIds,
          createdAt: new Date().toISOString(),
        });
        await trackOperation('GRADE_MGT', `Created Grade: ${formData.name}${formData.section}`, { writes: 1 });
        toast.success(`Grade ${formData.name}${formData.section} created successfully!`);
      }
      setFormData({ name: '', section: '', homeroomTeacher: '', subjectIds: [] });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save grade.');
    }
  };

  const handleDelete = async (grade: Grade) => {
    // 1. Data Existence Check (Safety Checks)
    const sQuery = query(collection(db, 'students'), where('grade', '==', grade.name), where('section', '==', grade.section));
    const sSnap = await getDocs(sQuery);
    const studentCount = sSnap.size;

    const mQuery = query(collection(db, 'marks'), where('grade', '==', grade.name), where('section', '==', grade.section));
    const mSnap = await getDocs(mQuery);
    const markCount = mSnap.size;

    const isPublished = config?.publishedGrades?.includes(grade.id);

    let message = `Are you sure you want to delete Grade ${grade.name}${grade.section}? This action cannot be undone.`;
    
    if (studentCount > 0 || markCount > 0 || isPublished) {
      message = `GRADE ${grade.name}${grade.section} CONTAINS SENSITIVE DATA:\n\n` +
                `• ${studentCount} Students Assigned\n` +
                `• ${markCount} Results/Marks Recorded\n` +
                `${isPublished ? '• PUBLICLY PUBLISHED RESULTS\n' : ''}\n` +
                `Are you sure you want to FORCE DELETE this grade and ALL associated records? This will purge teacher assignments, progress reports, and notifications.`;
    }

    showModal({
      title: 'Force Delete Grade Ecosystem',
      message: message,
      type: 'warning',
      confirmText: 'Execute Force Delete',
      onConfirm: async () => {
        try {
          startOperation(`Deleting Grade ${grade.name}${grade.section}`, 100);
          
          // Step 1: Remove Assignments
          updateProgress(10, 'Clearing Subject & Teacher Assignments...', 0);
          const aQuery = query(collection(db, 'assignments'), where('gradeId', '==', grade.id));
          const aSnap = await getDocs(aQuery);
          for (const d of aSnap.docs) {
              await deleteDoc(d.ref);
          }
          updateProgress(30, 'Assignments purged successfully.', aSnap.size);

          // Step 2: Remove Notifications
          updateProgress(35, 'Cleaning System Notifications...', aSnap.size);
          const nQuery = query(collection(db, 'system_notifications'), where('moduleId', '==', `${grade.name}${grade.section}`));
          const nSnap = await getDocs(nQuery);
          for (const d of nSnap.docs) {
              await deleteDoc(d.ref);
          }
          updateProgress(50, 'Notification logs cleared.', aSnap.size + nSnap.size);

          // Step 3: Clear Results Data (Marks & Published)
          updateProgress(55, 'Purging results and cache...', aSnap.size + nSnap.size);
          
          // Marks Deletion
          for (const d of mSnap.docs) {
            await deleteDoc(d.ref);
          }

          // Published Results & Verification Cache
          const pQuery = query(collection(db, 'publishedResults'), where('grade', '==', grade.name), where('section', '==', grade.section));
          const pSnap = await getDocs(pQuery);
          for (const d of pSnap.docs) {
            await deleteDoc(d.ref);
          }

          const vQuery = query(collection(db, 'verificationCache'), where('grade', '==', grade.name), where('section', '==', grade.section));
          const vSnap = await getDocs(vQuery);
          for (const d of vSnap.docs) {
            await deleteDoc(d.ref);
          }
          
          updateProgress(80, 'Results metadata purged.', aSnap.size + nSnap.size + mSnap.size + pSnap.size + vSnap.size);

          // Step 4: Delete Primary Record
          updateProgress(85, 'Deleting Primary Grade Record...', aSnap.size + nSnap.size + mSnap.size + pSnap.size + vSnap.size);
          await deleteDoc(doc(db, 'grades', grade.id));

          // Step 5: Update Configuration
          if (isPublished) {
              updateProgress(90, 'Updating System Configuration...', aSnap.size + nSnap.size + mSnap.size + pSnap.size + vSnap.size);
              const newPublished = (config?.publishedGrades || []).filter(id => id !== grade.id);
              await updateConfig({ publishedGrades: newPublished });
          }

          await trackOperation('GRADE_MGT', `Fully Purged Grade ${grade.name}${grade.section}`, { 
            deletes: 1 + aSnap.size + nSnap.size + mSnap.size + pSnap.size + vSnap.size 
          });
          
          completeOperation();
          toast.success(`Grade ${grade.name}${grade.section} and its ecosystem deleted.`);
        } catch (err: any) {
          console.error(err);
          failOperation(err.message || 'Purge failed due to database connectivity issues.');
        }
      }
    });
  };

  const togglePublish = async (gradeId: string) => {
    if (!config || isPublishing) return;
    setIsPublishing(true);
    const currentPublished = config.publishedGrades || [];
    const isPublished = currentPublished.includes(gradeId);
    const newPublished = isPublished 
      ? currentPublished.filter(id => id !== gradeId)
      : [...currentPublished, gradeId];
    
    try {
      // First, calculate & write precomputed documents
      await publishGradeResults(gradeId, !isPublished, config, (p) => {
        setPublishProgress(p);
      });
      await trackOperation('RESULT_PUB', `${isPublished ? 'Unpublished' : 'Published'} Grade Results`, { writes: isPublished ? 1 : 100 });
      // Wait, let's also update config so the state reflects accurately
      await updateConfig({ publishedGrades: newPublished });
      
      if (isPublished) {
         toast.success('Results unpublished for this grade');
         setPublishProgress(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update publishing status');
    } finally {
      setIsPublishing(false);
    }
  };

  // High-Performance Data Fetcher on Action Trigger
  const handleGradeAction = async (grade: Grade, action: 'analytics' | 'roster-pdf' | 'roster-excel' | 'transcripts-pdf') => {
    if (!config) return;
    setActionLoading(prev => ({ ...prev, [grade.id]: true }));
    const toastId = toast.loading(`Preparing grade ${grade.name}${grade.section} data...`);
    try {
      // 1. Fetch Students (Lazily & Targeted)
      const sQuery = query(
        collection(db, 'students'),
        where('grade', '==', grade.name),
        where('section', '==', grade.section)
      );
      const sSnap = await getDocs(sQuery);
      const studentsList = sSnap.docs.map(d => {
        const data = d.data();
        let needsUpdate = false;
        const conduct = data.conduct !== undefined ? data.conduct : (needsUpdate = true, 'A');
        const absent = data.absent !== undefined ? data.absent : (needsUpdate = true, 0);
        
        if (needsUpdate) {
          import('firebase/firestore').then(({ doc, updateDoc }) => {
            updateDoc(doc(db, 'students', d.id), { conduct, absent }).catch(err => 
              console.error('Error migrating student:', d.id, err)
            );
          });
        }
        return { id: d.id, ...data, conduct, absent } as Student;
      });

      // Sort alphabetically A-Z
      studentsList.sort((a, b) => {
        const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
      });

      if (studentsList.length === 0) {
        toast.error('No students found in this grade and section.', { id: toastId });
        return;
      }

      // 2. Fetch Subjects
      const subSnap = await getDocs(query(collection(db, 'subjects'), orderBy('name', 'asc')));
      let subjectsList = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));

      if (grade.subjectIds && grade.subjectIds.length > 0) {
        subjectsList = subjectsList.filter(s => grade.subjectIds!.includes(s.id));
      }

      if (subjectsList.length === 0) {
        toast.error('No subjects assigned to this grade.', { id: toastId });
        return;
      }

      if (action === 'analytics') {
        setAnalyticsGrade({ grade, students: studentsList, subjects: subjectsList });
        toast.success(`Loaded analytics for Grade ${grade.name}${grade.section}`, { id: toastId });
      } else if (action === 'roster-pdf') {
        generateRosterPDF(studentsList, subjectsList, config, `${grade.name}${grade.section}`, grades);
        toast.success('Roster PDF generated successfully!', { id: toastId });
      } else if (action === 'roster-excel') {
        await generateRosterExcel(studentsList, subjectsList, config, `${grade.name}${grade.section}`, grades);
        toast.success('Roster Excel generated successfully!', { id: toastId });
      } else if (action === 'transcripts-pdf') {
        const htName = grade?.homeroomTeacher || '________________';
        await generateAllStudentTranscriptsForGrade(studentsList, config, subjectsList, grade.name, grade.section, htName);
        toast.success('All Student Transcripts generated successfully!', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while executing this action.', { id: toastId });
    } finally {
      setActionLoading(prev => ({ ...prev, [grade.id]: false }));
    }
  };

  // Perform Calculations for open analytics inside modal
  const getAnalyticsMetrics = () => {
    if (!analyticsGrade || !config) return null;
    const { students, subjects } = analyticsGrade;
    const passMark = config.passMark || 50;

    const maleStudents = students.filter(s => isMaleGender(s.sex));
    const femaleStudents = students.filter(s => !isMaleGender(s.sex));
    const dropouts = students.filter(s => isStudentDropout(s, subjects));
    const activeStudents = students.filter(s => !isStudentDropout(s, subjects));

    const passed = activeStudents.filter(s => (s.final?.average ?? 0) >= passMark);
    const failed = activeStudents.filter(s => (s.final?.average ?? 0) < passMark);

    const passRate = students.length > 0 ? (passed.length / students.length) * 100 : 0;
    const failRate = students.length > 0 ? (failed.length / students.length) * 100 : 0;
    const dropoutRate = students.length > 0 ? (dropouts.length / students.length) * 100 : 0;

    // Top Performance Rank
    const topStudents = [...activeStudents]
      .sort((a, b) => (b.final?.average ?? 0) - (a.final?.average ?? 0))
      .slice(0, 5);

    // Subject averages
    const subjectAverages = subjects.map(sub => {
      let sum = 0, count = 0;
      students.forEach(s => {
        const mark = s.results?.[sub.id] || s.results?.[sub.name];
        if (mark && mark.average !== undefined) {
          sum += mark.average;
          count++;
        }
      });
      return {
        name: sub.name,
        average: count > 0 ? sum / count : 0
      };
    });

    return {
      total: students.length,
      maleCount: maleStudents.length,
      femaleCount: femaleStudents.length,
      passedCount: passed.length,
      failedCount: failed.length,
      dropoutCount: dropouts.length,
      passRate,
      failRate,
      dropoutRate,
      topStudents,
      subjectAverages
    };
  };

  const metrics = getAnalyticsMetrics();
  const passMark = config?.passMark || 50;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Grade & Section Management</h2>
          <p className="text-gray-500 font-medium">Define your school classes (e.g. 9A, 10B).</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              if (!config || isPublishing) return;

              showModal({
                title: 'Mass Publish Result Pipeline',
                message: 'This operation will compute and publish analytical results for ALL grades and sections. This will consume significant Firebase resources and overwrite all existing portal data.',
                type: 'confirm',
                confirmText: 'Initiate Mass Publish',
                onConfirm: async () => {
                  setIsPublishing(true);
                  let overallProcessed = 0;
                  const totalGrades = grades.length;
                  
                  for (let i = 0; i < grades.length; i++) {
                    const grade = grades[i];
                    await publishGradeResults(grade.id, true, config, (p) => {
                      // We merge real section progress with overall grade progress
                      const sectionWeight = 1 / totalGrades;
                      const sectionProgress = p.total > 0 ? (p.current / p.total) : 0;
                      const overallPercent = Math.round(((i + sectionProgress) / totalGrades) * 100);
                      
                      setPublishProgress({
                        ...p,
                        status: `Overall Progress: ${overallPercent}% | Processing Grade ${grade.name}${grade.section}`,
                        current: i, // We use grade index as current for overall
                        total: totalGrades
                      });
                    });
                    
                    // Update config iteratively or at the end? Iteratively is safer for feedback loop.
                    const currentPublished = config.publishedGrades || [];
                    if (!currentPublished.includes(grade.id)) {
                      await updateConfig({ publishedGrades: [...currentPublished, grade.id] });
                    }
                  }
                  
                  setPublishProgress(prev => prev ? { ...prev, stage: 'completed', status: 'Successfully published all grades!' } : null);
                  toast.success('Successfully published all grade results!');
                  setIsPublishing(false);
                }
              });
            }}
            disabled={isPublishing}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:scale-105 transition-transform disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" /> Publish All Results
          </button>
          <button 
            onClick={() => {
              setFormData({ name: '', section: '', homeroomTeacher: '', subjectIds: systemSubjects.map(s => s.id) });
              setShowAdd(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Add New Grade
          </button>
        </div>
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade (e.g. 9)</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="9"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Section (e.g. A)</label>
                <input 
                  required
                  type="text" 
                  value={formData.section}
                  onChange={e => setFormData({ ...formData, section: e.target.value })}
                  placeholder="A"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Homeroom Teacher (Optional)</label>
                <select 
                  value={formData.homeroomTeacher}
                  onChange={e => setFormData({ ...formData, homeroomTeacher: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-black/10 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-medium text-gray-700"
                >
                  <option value="">Select Homeroom Teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2 space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Select Subjects for this Grade</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {systemSubjects.map(sub => {
                    const isChecked = formData.subjectIds.includes(sub.id);
                    return (
                      <label key={sub.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-extrabold shadow-sm'
                          : 'bg-gray-55 border-black/5 text-gray-500 font-medium hover:bg-gray-100 hover:border-gray-200'
                      }`}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newIds = isChecked 
                              ? formData.subjectIds.filter(id => id !== sub.id)
                              : [...formData.subjectIds, sub.id];
                            setFormData({ ...formData, subjectIds: newIds });
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 transition-all cursor-pointer"
                        />
                        <span className="text-xs truncate">{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
                {formData.subjectIds.length === 0 && (
                  <p className="text-rose-500 text-xs font-bold leading-none py-1">
                     ⚠️ No subjects selected. Please select at least one subject for this grade.
                  </p>
                )}
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setEditingGrade(null);
                    setFormData({ name: '', section: '', homeroomTeacher: '', subjectIds: [] });
                  }}
                  className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={formData.subjectIds.length === 0}
                  className="flex-grow py-4 bg-indigo-600 disabled:bg-gray-305 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  {editingGrade ? 'Update Grade' : 'Create Grade'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin w-10 h-10 text-gray-200" />
        </div>
      ) : grades.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <UsersRound className="w-16 h-16 text-gray-100 mb-4" />
          <p className="text-gray-400 font-bold">No grades found. Start by adding one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {grades.map((grade) => (
            <motion.div
              layout
              key={grade.id}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/20 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div 
                  onClick={() => setSelectedGrade(grade)}
                  className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all cursor-pointer shadow-inner"
                >
                  {grade.name}{grade.section}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePublish(grade.id);
                    }}
                    className={`p-2 rounded-xl transition-all ${
                      config?.publishedGrades?.includes(grade.id)
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                    } disabled:opacity-50`}
                    disabled={isPublishing}
                    title={config?.publishedGrades?.includes(grade.id) ? 'Unpublish' : 'Publish'}
                  >
                    {config?.publishedGrades?.includes(grade.id) ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // This will be linked to the main AdminPortal notification state
                      // For now we just trigger a toast or common event if we can't prop drill easily
                      // but since we are in the same portal, we can perhaps use a custom event
                      window.dispatchEvent(new CustomEvent('open-notifications', { detail: { moduleId: `${grade.name}${grade.section}` } }));
                    }}
                    className="p-2 text-gray-300 hover:text-blue-500 rounded-xl hover:bg-blue-50 transition-all"
                    title="View Section Activity"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({ 
                        name: grade.name, 
                        section: grade.section, 
                        homeroomTeacher: grade.homeroomTeacher || '', 
                        subjectIds: grade.subjectIds || systemSubjects.map(s => s.id)
                      });
                      setShowAdd(true);
                    }}
                    className="p-2 text-gray-300 hover:text-indigo-500 rounded-xl hover:bg-indigo-50 transition-all"
                    title="Edit Grade"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(grade);
                    }}
                    className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all"
                    title="Delete Grade"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div onClick={() => setSelectedGrade(grade)} className="cursor-pointer space-y-1">
                <p className="text-lg font-black text-gray-900 tracking-tight leading-none">Grade {grade.name}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">Section {grade.section}</p>
                {grade.homeroomTeacher && (
                  <p className="text-[10px] font-extrabold text-indigo-500 italic pt-1 leading-none">Homeroom: {grade.homeroomTeacher}</p>
                )}
                
                <div className="pt-2 flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    config?.publishedGrades?.includes(grade.id) ? 'text-green-500' : 'text-amber-500'
                  }`}>
                    {config?.publishedGrades?.includes(grade.id) ? '● Published' : '○ Draft'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Hub inside card */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2 relative z-10 select-none">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</div>
                
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGrade(grade);
                    }}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-inner"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGradeAction(grade, 'analytics');
                    }}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-teal-50 text-teal-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-teal-600 hover:text-white transition-all shadow-inner"
                    disabled={actionLoading[grade.id]}
                  >
                    {actionLoading[grade.id] ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />} Analytics
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGradeAction(grade, 'roster-pdf');
                    }}
                    className="flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 bg-purple-50 text-purple-600 rounded-xl text-[8px] font-black uppercase tracking-wide hover:bg-purple-600 hover:text-white transition-all"
                    title="Export Roster PDF"
                    disabled={actionLoading[grade.id]}
                  >
                    <FileDown className="w-3.5 h-3.5 text-purple-500 group-hover:text-white" />
                    <span>Roster PDF</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGradeAction(grade, 'roster-excel');
                    }}
                    className="flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[8px] font-black uppercase tracking-wide hover:bg-emerald-600 hover:text-white transition-all"
                    title="Export Roster Excel"
                    disabled={actionLoading[grade.id]}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" />
                    <span>Roster Excel</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGradeAction(grade, 'transcripts-pdf');
                    }}
                    className="flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 bg-amber-50 text-amber-600 rounded-xl text-[8px] font-black uppercase tracking-wide hover:bg-amber-600 hover:text-white transition-all"
                    title="Export All Transcripts PDF"
                    disabled={actionLoading[grade.id]}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
                    <span>Transcripts PDF</span>
                  </button>
                </div>
              </div>

              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-150 transition-transform">
                <BarChart3 className="w-24 h-24 text-indigo-600" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* COMPREHENSIVE VIEW WORKSPACE */}
      {selectedGrade && config && (
        <GradeResultsTable 
          grade={selectedGrade} 
          config={config} 
          onClose={() => setSelectedGrade(null)} 
        />
      )}

      {/* PUBLISH PROGRESS MODAL */}
      <PublishProgressModal 
        progress={publishProgress} 
        onClose={() => setPublishProgress(null)} 
        onRetry={(failedIds) => {
          // Identify the gradeId from state or context. 
          // Since togglePublish is a closure, we might need to store the active gradeId being published.
          const activeGradeId = grades.find(g => g.name === publishProgress?.gradeName && g.section === publishProgress?.section)?.id;
          if (activeGradeId) {
            publishGradeResults(activeGradeId, true, config, (p) => {
              setPublishProgress(p);
            }, failedIds);
          }
        }}
      />

      {/* BILINGUAL GRADE ANALYTICS MODAL */}
      <AnimatePresence>
        {analyticsGrade && metrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-gray-100 flex flex-col gap-6"
            >
              <button 
                onClick={() => setAnalyticsGrade(null)}
                className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Title Header */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600">
                  <Sparkles className="w-4 h-4" /> Xiinxala Miriitii Kutaa / Grade Analytics
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  Kutaa / Grade {analyticsGrade.grade.name}{analyticsGrade.grade.section} Report
                </h3>
                <p className="text-gray-400 text-xs font-bold font-mono">Bara Barnootaa / Academic Year: {config?.academicYear}</p>
              </div>

              {/* Key Indicators Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/60 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Barattoota Galmeeffaman</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase leading-tight pb-1">Registered Students</p>
                  <p className="text-3xl font-black text-slate-900">{metrics.total}</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">Dhiira / Male: {metrics.maleCount} | Dub / Fem: {metrics.femaleCount}</p>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/80">Darban (Darbee)</p>
                  <p className="text-[9px] font-bold text-emerald-600/60 uppercase leading-tight pb-1">Passed Students</p>
                  <p className="text-3xl font-black text-emerald-600">{metrics.passedCount}</p>
                  <p className="text-[10px] font-black text-emerald-500 mt-1">{metrics.passRate.toFixed(1)}% Rate</p>
                </div>
                <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-100/50 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/80">Kufan (Kufee)</p>
                  <p className="text-[9px] font-bold text-rose-600/60 uppercase leading-tight pb-1">Failed Students</p>
                  <p className="text-3xl font-black text-rose-600">{metrics.failedCount}</p>
                  <p className="text-[10px] font-black text-rose-500 mt-1">{metrics.failRate.toFixed(1)}% Rate</p>
                </div>
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100/50 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">Addaan Kutan (Dropout)</p>
                  <p className="text-[9px] font-bold text-amber-600/60 uppercase leading-tight pb-1">Dropouts</p>
                  <p className="text-3xl font-black text-amber-600">{metrics.dropoutCount}</p>
                  <p className="text-[10px] font-black text-amber-500 mt-1">{metrics.dropoutRate.toFixed(1)}% Rate</p>
                </div>
              </div>

              {/* Sub-sections layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                {/* Left: Top Performers */}
                <div className="space-y-4">
                  <h4 className="font-black text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm uppercase tracking-wide">
                    <Award className="w-4 h-4 text-amber-500" /> Barattoo qaphxii olaanaa / Top Performers
                  </h4>
                  {metrics.topStudents.length === 0 ? (
                    <p className="text-xs font-bold text-gray-400">No active students recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.topStudents.map((s, idx) => (
                        <div 
                          key={s.id}
                          className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-xs font-extrabold text-gray-900">{s.name}</p>
                              <p className="text-[10px] font-extrabold text-gray-400">{isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii'} • Roll: #{idx + 1}</p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black font-mono">
                            {s.final?.average?.toFixed(1) || '0'} avg
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Subject Performance */}
                <div className="space-y-4">
                  <h4 className="font-black text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm uppercase tracking-wide">
                    <BookOpen className="w-4 h-4 text-indigo-500" /> Qaphxii Giddu-galeessaa Gosa Barnootaa / Subject Performance
                  </h4>
                  <div className="space-y-3.5 max-h-[30vh] overflow-y-auto pr-2">
                    {metrics.subjectAverages.map((sub, sIdx) => (
                      <div key={sIdx} className="space-y-1">
                        <div className="flex justify-between text-xs font-extrabold">
                          <span className="text-slate-700">{sub.name}</span>
                          <span className="text-indigo-600 font-mono">{sub.average.toFixed(1)} avg</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${Math.min(sub.average, 100)}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              sub.average >= passMark ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Close controls */}
              <div className="border-t border-gray-100 pt-4 flex justify-end">
                <button
                  onClick={() => setAnalyticsGrade(null)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                >
                  Close Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
