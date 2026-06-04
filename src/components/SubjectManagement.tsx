import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, BookOpen, Loader2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const SubjectManagement: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    const q = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await addDoc(collection(db, 'subjects'), {
        ...formData,
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '' });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this subject? This will remove all associated marks.')) {
      await deleteDoc(doc(db, 'subjects', id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Subject Management</h2>
          <p className="text-gray-500 font-medium">Manage school subjects and the core curriculum.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" /> Add New Subject
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
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-6">
              <div className="flex-grow space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Mathematics"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div className="flex items-end gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-8 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Subject Name</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {subjects.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-gray-900">{sub.name}</span>
                  </div>
                </td>
                <td className="px-8 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(sub.id)}
                    className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && !loading && (
              <tr>
                <td colSpan={2} className="px-8 py-20 text-center text-gray-400 font-medium">No subjects found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
