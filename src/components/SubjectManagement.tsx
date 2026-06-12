import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, BookOpen, Loader2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { useModal } from '../context/ModalContext';

export const SubjectManagement: React.FC = () => {
  const { showModal } = useModal();
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
    if (!formData.name.trim()) return;
    try {
      await addDoc(collection(db, 'subjects'), {
        name: formData.name.trim(),
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '' });
      setShowAdd(false);
      toast.success('Curriculum course added successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to register course.');
    }
  };

  const handleDelete = async (id: string) => {
    showModal({
      title: 'Expel Course from Curriculum',
      message: 'Are you sure you want to delete this course? This will purge all associated student scores and historical mark entries from the database. This action is irreversible.',
      type: 'warning',
      confirmText: 'Confirm Deletion',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'subjects', id));
          toast.success('Course expelled from curriculum.');
        } catch {
          toast.error('Failed to delete subject.');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest text-xs">Accessing curriculum...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Curriculum Course Manager</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Define instructional domains for assignment matching.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
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
            className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-indigo-50 dark:border-indigo-950/40 shadow-xl"
          >
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-6">
              <div className="flex-grow space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Subject Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ name: e.target.value })}
                  placeholder="e.g. Mathematics"
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
              </div>
              <div className="flex items-end gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-8 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-250 text-gray-600 dark:text-gray-300 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850/85 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[500px] border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-8 py-5">Subject Name</th>
              <th className="px-8 py-5 text-right font-black">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {subjects.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition-colors group">
                <td className="px-8 py-4.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="font-extrabold text-gray-900 dark:text-white">{sub.name}</span>
                  </div>
                </td>
                <td className="px-8 py-4.5 text-right">
                  <button 
                    onClick={() => handleDelete(sub.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/45 rounded-xl transition-all"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && !loading && (
              <tr>
                <td colSpan={2} className="px-8 py-16 text-center text-gray-400 dark:text-gray-500 font-bold">No academic curriculum subjects defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
