import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, UsersRound } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Grade, SchoolConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GradeResultsTable } from './GradeResultsTable';

export const GradeManagement: React.FC = () => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const { config, updateConfig } = useSchoolConfig();
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', section: '' });
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'grades'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name) return;
    try {
      await addDoc(collection(db, 'grades'), {
        ...formData,
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '', section: '' });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this grade? This may affect students assigned to it.')) {
      await deleteDoc(doc(db, 'grades', id));
    }
  };

  const togglePublish = async (gradeId: string) => {
    if (!config) return;
    const currentPublished = config.publishedGrades || [];
    const isPublished = currentPublished.includes(gradeId);
    const newPublished = isPublished 
      ? currentPublished.filter(id => id !== gradeId)
      : [...currentPublished, gradeId];
    
    try {
      await updateConfig({ publishedGrades: newPublished });
      toast.success(isPublished ? 'Results unpublished for this grade' : 'Results published successfully!');
    } catch (err) {
      toast.error('Failed to update publishing status');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Grade & Section Management</h2>
          <p className="text-gray-500 font-medium">Define your school classes (e.g. 9A, 10B).</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" /> Add New Grade
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
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
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
                  Create Grade
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
              onClick={() => setSelectedGrade(grade)}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/20 transition-all group cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  {grade.name}{grade.section}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePublish(grade.id);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      config?.publishedGrades?.includes(grade.id)
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                    }`}
                    title={config?.publishedGrades?.includes(grade.id) ? 'Unpublish' : 'Publish'}
                  >
                    {config?.publishedGrades?.includes(grade.id) ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(grade.id);
                    }}
                    className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-900 relative z-10">Grade {grade.name}</p>
              <p className="text-xs font-semibold text-gray-400 relative z-10">Section {grade.section}</p>
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between relative z-10">
                 <span className={`text-[10px] font-black uppercase tracking-widest ${
                   config?.publishedGrades?.includes(grade.id) ? 'text-green-500' : 'text-amber-500'
                 }`}>
                   {config?.publishedGrades?.includes(grade.id) ? 'Published' : 'Draft'}
                 </span>
                 <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    View Results <BarChart3 className="w-3 h-3" />
                 </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-150 transition-transform">
                <BarChart3 className="w-24 h-24 text-indigo-600" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedGrade && config && (
        <GradeResultsTable 
          grade={selectedGrade} 
          config={config} 
          onClose={() => setSelectedGrade(null)} 
        />
      )}
    </div>
  );
};
