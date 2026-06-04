import React, { useState } from 'react';
import { Search, Download, FileText, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, SemesterSummary } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { generateStudentTranscript } from '../lib/pdfGenerator';

export const StudentPortal: React.FC = () => {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { config } = useSchoolConfig();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setError('');
    setStudent(null);

    try {
      if (!config?.resultsPublished) {
        setError('Results are not published yet. Please check back later.');
        setLoading(false);
        return;
      }

      const docRef = doc(db, 'students', studentId.trim().toUpperCase());
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setStudent(snap.data() as Student);
      } else {
        setError('Student ID not found. Please verify and try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Welcome to the Student Portal
          </h1>
          <p className="text-gray-500">
            Enter your Student ID to view your transcript and results.
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-6">
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Enter Student ID (e.g. ST4959)"
            className="w-full pl-12 pr-32 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none text-lg font-medium"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Search'}
          </button>
        </form>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}

          {student && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 pt-4"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
                  <p className="text-gray-500 font-medium">ID: {student.studentId} • Grade {student.grade}{student.section}</p>
                </div>
                <button 
                  onClick={() => config && student && generateStudentTranscript(student, config)}
                  className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-all text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Transcript
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResultCard title="Semester 1" data={student.semester1} accent="indigo" />
                <ResultCard title="Semester 2" data={student.semester2} accent="blue" />
                <ResultCard title="Final Result" data={student.final} accent="emerald" />
              </div>

              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Sem 1</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Sem 2</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(student.results || {}).map(([subId, m]) => {
                      const marks = m as { semester1: number; semester2: number; average: number };
                      return (
                        <tr key={subId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{subId}</td>
                          <td className="px-6 py-4 text-gray-600">{marks.semester1}</td>
                          <td className="px-6 py-4 text-gray-600">{marks.semester2}</td>
                          <td className="px-6 py-4">
                            <span className={`font-bold ${marks.average >= (config?.passMark || 50) ? 'text-green-600' : 'text-red-600'}`}>
                              {marks.average.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && !student && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-600" />
            <p className="text-gray-500 font-medium">Searching Result...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const ResultCard = ({ title, data, accent }: { title: string, data?: SemesterSummary, accent: 'indigo' | 'blue' | 'emerald' }) => {
  const colors = {
    indigo: 'text-indigo-600 border-indigo-100',
    blue: 'text-blue-600 border-blue-100',
    emerald: 'text-emerald-600 border-emerald-100'
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${colors[accent]} bg-white shadow-sm`}>
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-widest">{title}</h3>
      {data ? (
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-gray-900">{data.average.toFixed(1)}%</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${data.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {data.status}
            </span>
          </div>
          <div className="flex justify-between text-xs font-medium text-gray-500 pt-1">
            <span>Rank: {data.rank}</span>
            <span>Total: {data.total}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm font-medium italic">Not Available</p>
      )}
    </div>
  );
}
