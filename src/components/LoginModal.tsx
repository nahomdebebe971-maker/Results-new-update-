import React, { useState } from 'react';
import { X, Mail, Lock, User, Key, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loginWithEmail, registerAdmin } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginTeacher, loginAdmin } = useAuth();
  const [type, setType] = useState<'ADMIN' | 'TEACHER'>('ADMIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Teacher state
  const [teacherName, setTeacherName] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginTeacher(teacherName, teacherId);
      onClose();
    } catch (err: any) {
      console.error('Teacher Auth Error:', err);
      // Check for common Firestore error codes
      if (err.code === 'permission-denied') {
        setError('System Permission Error: Please check database rules or contact admin.');
      } else {
        setError(err.message || 'Failed to login as Teacher');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await loginAdmin(email, password);
      onClose();
    } catch (err: any) {
      console.error('Admin Sign-in Error:', err);
      setError(err.message || 'Authentication failed. Please check credentials or connectivity.');
    } finally {
      setLoading(false);
    }
  };
  // Wait, I need a better way for Teacher login if it's not real Firebase Auth.
  // Actually, let's keep it simple: Admin login is real Firebase Auth.
  // Teacher login: we can either use a virtual email for them or just set a local state/token.
  // But useAuth hooks into onAuthStateChanged.
  // To keep it clean, I'll recommend Admin uses Email Auth.
  // If the user wants "by email not by Google", they definitely want email/pass.

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Staff Login</h2>
                  <p className="text-gray-500 font-medium">Access your portal securely.</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
                <button 
                  onClick={() => setType('ADMIN')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'ADMIN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Admin
                </button>
                <button 
                  onClick={() => setType('TEACHER')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'TEACHER' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Teacher
                </button>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-bold">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={type === 'ADMIN' ? handleAdminLogin : handleTeacherLogin} className="space-y-6">
                {type === 'ADMIN' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                          placeholder="admin@school.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Teacher Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="text"
                          required
                          value={teacherName}
                          onChange={e => setTeacherName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                          placeholder="Enter your full name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Teacher ID</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="text"
                          required
                          value={teacherId}
                          onChange={e => setTeacherId(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                          placeholder="T-001"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-tighter">
                      Use your teacher ID as your password if prompted elsewhere.
                    </p>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : `Login as ${type === 'ADMIN' ? 'Admin' : 'Teacher'}`}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
