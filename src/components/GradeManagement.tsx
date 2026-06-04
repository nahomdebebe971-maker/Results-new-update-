import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, UsersRound } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Grade } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const GradeManagement: React.FC = () => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', section: '' });

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
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl">
                  {grade.name}{grade.section}
                </div>
                <button 
                  onClick={() => handleDelete(grade.id)}
                  className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm font-bold text-gray-900">Grade {grade.name}</p>
              <p className="text-xs font-semibold text-gray-400">Section {grade.section}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
