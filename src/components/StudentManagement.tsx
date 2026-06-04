import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, GraduationCap, Loader2, Upload, 
  FileDown, Search, Filter, X, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { 
  collection, addDoc, deleteDoc, doc, onSnapshot, 
  query, orderBy, setDoc, getDocs, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade, Subject } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { generateTranscript } from '../lib/pdfTemplates';

interface ImportPreview {
  name: string;
  sex: 'M' | 'F';
  age: number;
  isValid: boolean;
  error?: string;
}

export const StudentManagement: React.FC = () => {
  const { config } = useSchoolConfig();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', sex: 'M' as 'M' | 'F', age: 18, grade: '', section: '' });
  
  // Bulk Import state
  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importGradeSearch, setImportGradeSearch] = useState({ grade: '', section: '' });
  
  useEffect(() => {
    const qS = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribeS = onSnapshot(qS, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    });

    const qG = query(collection(db, 'grades'));
    const unsubscribeG = onSnapshot(qG, (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    const qSub = query(collection(db, 'subjects'));
    const unsubscribeSub = onSnapshot(qSub, (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    return () => {
      unsubscribeS();
      unsubscribeG();
      unsubscribeSub();
    };
  }, []);

  const handleDownloadTranscript = async (student: Student) => {
    if (!config) {
      toast.error('School configuration not loaded.');
      return;
    }
    
    try {
      await generateTranscript(student, subjects, config);
      toast.success(`Generated transcript for ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF.');
    }
  };

  const generateId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `ST${num}`;
  };

  const parseTextLine = (line: string): ImportPreview | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Regex for: [num]. [name]. [sex]. [age]
    // Handles dots, spaces, varying cases
    // Example: 1. Nahom Debebe. M. 17
    const regex = /^\d*\.?\s*(.*?)\.\s*([MFmf])\.\s*(\d+)$/;
    const match = trimmed.match(regex);

    if (match) {
      const name = match[1].trim();
      const sex = match[2].toUpperCase() as 'M' | 'F';
      const age = parseInt(match[3]);
      
      return {
        name,
        sex,
        age,
        isValid: name.length > 2 && age > 0 && age < 100
      };
    }

    // Fallback for CSV-like if dots are missing but spaces exist: "Name M 18"
    const parts = trimmed.split(/[\s,.]+/).filter(Boolean);
    if (parts.length >= 3) {
      const ageStr = parts[parts.length - 1];
      const sexStr = parts[parts.length - 2].toUpperCase();
      const age = parseInt(ageStr);
      
      if (!isNaN(age) && (sexStr === 'M' || sexStr === 'F')) {
        const name = parts.slice(0, -2).join(' ');
        return {
          name,
          sex: sexStr as 'M' | 'F',
          age,
          isValid: name.length > 2
        };
      }
    }

    return {
      name: trimmed,
      sex: 'M',
      age: 0,
      isValid: false,
      error: 'Cannot parse format. Required: Name. Sex. Age'
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (!content) return;

      const results: ImportPreview[] = [];

      if (file.name.endsWith('.txt')) {
        const lines = (content as string).split('\n');
        lines.forEach(line => {
          const parsed = parseTextLine(line);
          if (parsed) results.push(parsed);
        });
      } else {
        const bstr = content;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        data.forEach(row => {
          const name = row.Name || row.name || '';
          const sex = (row.Sex || row.sex || 'M').toString().toUpperCase() as 'M' | 'F';
          const age = parseInt(row.Age || row.age) || 0;
          results.push({
            name,
            sex: (sex === 'M' || sex === 'F') ? sex : 'M',
            age,
            isValid: name.length > 2 && age > 0
          });
        });
      }

      setImportPreview(results);
      setShowImportDialog(true);
    };

    if (file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const finalizeImport = async () => {
    if (!importGradeSearch.grade || !importGradeSearch.section) {
      toast.error('Please select a grade and section for this import.');
      return;
    }

    setImporting(true);
    const validRows = importPreview.filter(p => p.isValid);
    const batchSize = 50;
    let successCount = 0;

    try {
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = validRows.slice(i, i + batchSize);
        
        chunk.forEach(p => {
          const studentId = generateId();
          batch.set(doc(db, 'students', studentId), {
            name: p.name,
            sex: p.sex,
            age: p.age,
            grade: importGradeSearch.grade,
            section: importGradeSearch.section,
            studentId,
            createdAt: new Date().toISOString(),
          });
          successCount++;
        });

        await batch.commit();
      }

      toast.success(`Succesfully imported ${successCount} students to Grade ${importGradeSearch.grade}${importGradeSearch.section}`);
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      console.error(err);
      toast.error('Import failed midway. Check your connection.');
    } finally {
      setImporting(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.grade) return;
    
    const studentId = generateId();
    try {
      await setDoc(doc(db, 'students', studentId), {
        ...formData,
        studentId,
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '', sex: 'M', age: 18, grade: '', section: '' });
      setShowAdd(false);
      toast.success('Student added successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add student.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Student Management</h2>
          <p className="text-gray-500 font-medium">Add students manually or import from file.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm cursor-pointer">
            <Upload className="w-5 h-5" /> Import Bulk
            <input type="file" className="hidden" accept=".xlsx,.csv,.txt" onChange={handleFileSelect} />
          </label>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Add Student
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        <button className="bg-white border border-gray-100 p-4 rounded-2xl text-gray-400 hover:text-indigo-600 transition-colors">
          <Filter className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {showImportDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black">Import Students Preview</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Review your data before finalizing</p>
                </div>
                <button onClick={() => setShowImportDialog(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 border-b border-gray-100 bg-indigo-50/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Grade</label>
                  <select 
                    value={importGradeSearch.grade}
                    onChange={e => setImportGradeSearch({ ...importGradeSearch, grade: e.target.value })}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
                  >
                    <option value="">Select Grade</option>
                    {[...new Set(grades.map(g => g.name))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Section</label>
                  <select 
                    value={importGradeSearch.section}
                    onChange={e => setImportGradeSearch({ ...importGradeSearch, section: e.target.value })}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
                  >
                    <option value="">Select Section</option>
                    {grades.filter(g => g.name === importGradeSearch.grade).map(g => (
                      <option key={g.id} value={g.section}>{g.section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-grow overflow-auto p-6">
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4 text-center">Sex</th>
                        <th className="px-6 py-4 text-center">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {importPreview.map((p, idx) => (
                        <tr key={idx} className={p.isValid ? 'bg-white' : 'bg-red-50/50'}>
                          <td className="px-6 py-3">
                            {p.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <div className="flex items-center gap-1 text-red-500 text-[10px] font-bold">
                                <AlertCircle className="w-3 h-3" /> Error
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 font-bold text-gray-700">{p.name || <span className="text-red-400 italic">Empty</span>}</td>
                          <td className="px-6 py-3 text-center text-xs font-mono">{p.sex}</td>
                          <td className="px-6 py-3 text-center text-xs font-mono">{p.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Valid: {importPreview.filter(p => p.isValid).length} • Invalid: {importPreview.filter(p => !p.isValid).length}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowImportDialog(false)} className="px-6 py-3 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
                  <button 
                    disabled={importing || importPreview.filter(p => p.isValid).length === 0}
                    onClick={finalizeImport}
                    className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Confirm Import
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-50/50"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sex</label>
                <select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value as 'M' | 'F' })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Age</label>
                <input type="number" value={formData.age} onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade</label>
                <select required value={formData.grade} onChange={e => {
                  const g = grades.find(gr => gr.name === e.target.value);
                  setFormData({ ...formData, grade: e.target.value });
                }} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="">Select Grade</option>
                  {[...new Set(grades.map(g => g.name))].map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Section</label>
                <select required value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                  <option value="">Select Section</option>
                  {grades.filter(g => g.name === formData.grade).map(g => (
                    <option key={g.id} value={g.section}>{g.section}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4 flex gap-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-grow py-4 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-grow py-4 bg-indigo-600 text-white rounded-xl font-bold">Save Student</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">ID</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Grade</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Section</th>
              <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">{s.name}</span>
                      <span className="text-[10px] uppercase font-bold text-gray-400">{s.sex} • {s.age} Yrs</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-4 font-mono text-sm font-bold text-gray-500">{s.studentId}</td>
                <td className="px-8 py-4 font-bold text-gray-700">{s.grade}</td>
                <td className="px-8 py-4 font-bold text-gray-700">{s.section}</td>
                <td className="px-8 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleDownloadTranscript(s)}
                      className="p-2 text-gray-300 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                      title="Download Transcript"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteDoc(doc(db, 'students', s.id))} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
