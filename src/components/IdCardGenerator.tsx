import React, { useState, useEffect } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, SchoolConfig, Grade } from '../types';
import { 
  X, Printer, Loader2, Search, IdCard, Users, CheckCircle2, AlertCircle, FileDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSingleStudentIdCardPdf, generateBulkStudentIdCardsPdf } from '../lib/pdfGenerator';

interface IdCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  grades: Grade[];
  config: SchoolConfig | null;
}

export const IdCardGenerator: React.FC<IdCardGeneratorProps> = ({
  isOpen,
  onClose,
  students,
  grades,
  config
}) => {
  const [scope, setScope] = useState<'single' | 'grade' | 'section' | 'all'>('single');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [stSearch, setStSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // Search filtered students for dropdown
  const filteredSearchList = students.filter(s => 
    s.name.toLowerCase().includes(stSearch.toLowerCase()) || 
    s.studentId.toLowerCase().includes(stSearch.toLowerCase())
  ).slice(0, 8);

  // Re-calculate selected students whenever selections change
  useEffect(() => {
    if (scope === 'single') {
      const found = students.find(s => s.id === selectedStudentId);
      setSelectedStudents(found ? [found] : []);
    } else if (scope === 'grade') {
      const match = students.filter(s => s.grade === selectedGrade);
      setSelectedStudents(match);
    } else if (scope === 'section') {
      const match = students.filter(s => s.grade === selectedGrade && s.section === selectedSection);
      setSelectedStudents(match);
    } else {
      setSelectedStudents(students);
    }
  }, [scope, selectedStudentId, selectedGrade, selectedSection, students]);

  const [isExporting, setIsExporting] = useState(false);

  // Handle caching and PDF export
  const handleExportPdf = async () => {
    if (selectedStudents.length === 0) {
      toast.error('No students selected for card export.');
      return;
    }

    setIsExporting(true);
    const academicYear = config?.academicYear || '2026';
    const schoolName = config?.schoolName || 'CHERCHER SECONDARY SCHOOL';

    try {
      // First, ensure all verification credentials are in Firestore
      const batchSize = 100;
      for (let i = 0; i < selectedStudents.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = selectedStudents.slice(i, i + batchSize);

        chunk.forEach(student => {
          const verificationId = `ID-${student.studentId}-${academicYear}`;
          const vRef = doc(db, 'verificationCache', verificationId);

          batch.set(vRef, {
            verificationId,
            documentType: 'Student ID Card',
            studentId: student.studentId,
            studentName: student.name,
            grade: student.grade,
            section: student.section,
            sex: student.sex || 'M',
            age: student.age || 15,
            academicYear: academicYear,
            schoolName: schoolName,
            dateGenerated: new Date().toISOString(),
            status: 'Verified'
          });
        });

        await batch.commit();
      }

      toast.success(`Registered verification hashes. Generating high-resolution PDF...`);

      if (scope === 'single') {
        await generateSingleStudentIdCardPdf(selectedStudents[0], config!);
      } else if (scope === 'grade') {
        await generateBulkStudentIdCardsPdf(selectedStudents, config!, `Grade-${selectedGrade}-ID-Cards.pdf`);
      } else if (scope === 'section') {
        await generateBulkStudentIdCardsPdf(selectedStudents, config!, `Section-${selectedGrade}${selectedSection}-ID-Cards.pdf`);
      } else {
        await generateBulkStudentIdCardsPdf(selectedStudents, config!, 'All-Student-ID-Cards.pdf');
      }

      toast.success('PDF document compiled and downloaded!');
    } catch (err) {
      console.error('Error generating PDF cards:', err);
      toast.error('Failed to create PDF. Check school credentials.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle caching and print trigger
  const handleGenerateAndPrint = async () => {
    if (selectedStudents.length === 0) {
      toast.error('No students selected for card generation.');
      return;
    }

    setIsGenerating(true);
    const academicYear = config?.academicYear || '2026';
    const schoolName = config?.schoolName || 'CHERCHER SECONDARY SCHOOL';

    try {
      const batchSize = 100;
      for (let i = 0; i < selectedStudents.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = selectedStudents.slice(i, i + batchSize);

        chunk.forEach(student => {
          const verificationId = `ID-${student.studentId}-${academicYear}`;
          const vRef = doc(db, 'verificationCache', verificationId);

          batch.set(vRef, {
            verificationId,
            documentType: 'Student ID Card',
            studentId: student.studentId,
            studentName: student.name,
            grade: student.grade,
            section: student.section,
            sex: student.sex,
            age: student.age,
            academicYear: academicYear,
            schoolName: schoolName,
            dateGenerated: new Date().toISOString(),
            status: 'Verified'
          });
        });

        await batch.commit();
      }

      toast.success(`Successfully pre-cached ${selectedStudents.length} ID Cards! Opening print container...`);
      setShowPrintView(true);
    } catch (err) {
      console.error('Error caching ID verification records:', err);
      toast.error('Failed to register verification signatures. Check firewall.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Printable styles injected directly for window.print() */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #id-print-area, #id-print-area * {
            visibility: visible;
          }
          #id-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {showPrintView ? (
        <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="p-6 bg-gray-900 text-white flex justify-between items-center no-print">
            <div>
              <h3 className="text-xl font-black">Official Printable ID Cards</h3>
              <p className="text-xs text-indigo-400 font-bold mt-1 uppercase tracking-widest">Double check alignment before initiating printer</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPrintView(false)} 
                className="px-4 py-2 border border-gray-700 rounded-xl text-xs font-bold hover:bg-white/10 cursor-pointer"
              >
                Back To Settings
              </button>
              <button
                disabled={isExporting}
                onClick={handleExportPdf}
                className="px-5 py-2 bg-emerald-605 bg-emerald-600 text-white border-none rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export PDF
              </button>
              <button 
                onClick={handleTriggerPrint} 
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-2 hover:bg-indigo-700 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Trigger System Print
              </button>
            </div>
          </div>

          <div className="flex-grow p-8 overflow-y-auto bg-gray-100 dark:bg-gray-950">
            <div id="id-print-area" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedStudents.map(student => {
                const verificationId = `ID-${student.studentId}-${config?.academicYear || '2026'}`;
                const verificationUrl = `${window.location.origin}${window.location.pathname}#verify-${verificationId}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

                return (
                  <div 
                    key={student.id} 
                    className="w-[3.375in] h-[2.125in] bg-white border border-gray-300 shadow-lg rounded-2xl relative overflow-hidden flex flex-col pr-[0.8in] p-3 text-gray-900 select-none mx-auto mb-4 bg-[radial-gradient(#f8fafc_1px,transparent_1px)] [background-size:16px_16px]"
                    style={{ pageBreakInside: 'avoid', contentVisibility: 'auto' }}
                  >
                    {/* Header bar */}
                    <div className="flex items-center gap-2 border-b border-indigo-50 pb-1.5 mb-2 shrink-0">
                      <img 
                        src={config?.schoolLogo || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=120'} 
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 object-cover rounded-lg bg-indigo-50 border border-indigo-100" 
                        alt="Sch" 
                      />
                      <div className="min-w-0">
                        <h4 className="text-[9px] font-black tracking-tight text-indigo-900 uppercase truncate">
                          {config?.schoolName || 'CHERCHER SECONDARY SCHOOL'}
                        </h4>
                        <p className="text-[6px] font-bold text-gray-400 uppercase tracking-widest truncate">
                          {config?.schoolMotto || 'KNOWLEDGE IS LIGHT'}
                        </p>
                      </div>
                    </div>

                    {/* Card Content Grid */}
                    <div className="flex-grow flex gap-2.5 min-w-0">
                      {/* Photo Placeholder */}
                      <div className="w-[0.9in] h-[1.1in] bg-gray-50 border border-gray-100 rounded-xl flex flex-col items-center justify-center shrink-0 relative overflow-hidden group">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center font-bold text-xs uppercase mb-1 shadow-inner">
                          {student.name.charAt(0)}
                        </div>
                        <span className="text-[6px] uppercase font-black tracking-widest text-gray-400">STUDENT</span>
                        <div className="absolute inset-x-0 bottom-0 bg-gray-900/5 py-0.5 text-center border-t border-gray-100">
                          <span className="text-[5px] font-mono font-bold text-gray-500">PHOTO</span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex flex-col justify-between min-w-0 py-0.5">
                        <div className="space-y-0.5">
                          <span className="text-[5px] uppercase font-black text-gray-400 tracking-wider">FULL NAME</span>
                          <h5 className="text-[10px] font-black text-indigo-950 tracking-tight leading-tight uppercase truncate">
                            {student.name}
                          </h5>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <div>
                            <span className="text-[4px] uppercase font-bold text-gray-400 block">GRADE / SECTION</span>
                            <span className="text-[7px] font-black text-gray-800 uppercase">{student.grade} - {student.section}</span>
                          </div>
                          <div>
                            <span className="text-[4px] uppercase font-bold text-gray-400 block">ACADEMIC YEAR</span>
                            <span className="text-[7px] font-black text-indigo-600 font-mono">{config?.academicYear || '2026/27'}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[4px] uppercase font-bold text-gray-400 block">ISSUED STUDENT ID</span>
                          <span className="text-[8px] font-mono font-black text-indigo-600 tracking-wide">{student.studentId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Decal Card Verification side panel */}
                    <div className="absolute right-0 top-0 bottom-0 w-[0.75in] bg-gray-50 border-l border-gray-100 p-1 flex flex-col items-center justify-center gap-1">
                      <img 
                        src={qrUrl} 
                        alt="Verification QR" 
                        className="w-[0.55in] h-[0.55in] bg-white p-0.5 border border-gray-100 rounded-md shrink-0 select-none" 
                      />
                      <span className="text-[4px] font-mono font-bold text-gray-400 text-center uppercase tracking-tighter">
                        Scan to verify
                      </span>
                    </div>

                    {/* Bottom Status Ribbon */}
                    <div className="absolute bottom-1.5 left-3 text-[5px] font-mono font-bold text-indigo-400/80 tracking-tighter select-none">
                      REF: {verificationId}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="p-6 bg-gray-950 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                <IdCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black leading-tight">Student ID Card Generator</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">High Security Digital Badges</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Scope Selection Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Filter Scope</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'single', label: 'Single', icon: Search },
                  { id: 'grade', label: 'Grade', icon: Users },
                  { id: 'section', label: 'Section', icon: Users },
                  { id: 'all', label: 'All Students', icon: CheckCircle2 }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setScope(item.id as any)}
                    className={`p-3.5 rounded-2xl border text-xs font-bold leading-tight flex flex-col items-center justify-center gap-2 transition-all ${
                      scope === item.id 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/60 dark:text-indigo-400' 
                        : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Filters Inputs based on Scope */}
            {scope === 'single' && (
              <div className="space-y-2 relative">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Find Student</label>
                <div className="relative">
                  <input
                    type="text"
                    value={stSearch}
                    onChange={e => setStSearch(e.target.value)}
                    placeholder="Type student name or ID..."
                    className="w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-sm"
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {stSearch && (
                  <div className="absolute top-[100%] inset-x-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-gray-50">
                    {filteredSearchList.map(st => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSelectedStudentId(st.id);
                          setStSearch(st.name);
                        }}
                        className="w-full p-3.5 text-left text-sm font-semibold hover:bg-indigo-50/50 flex justify-between items-center"
                      >
                        <span className="font-bold text-gray-800">{st.name}</span>
                        <span className="font-mono text-xs text-gray-400">{st.studentId} • {st.grade}{st.section}</span>
                      </button>
                    ))}
                    {filteredSearchList.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400 font-bold">No students found</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(scope === 'grade' || scope === 'section') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Grade</label>
                  <select
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Choose Grade</option>
                    {[...new Set(grades.map(g => g.name))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {scope === 'section' && (
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Section</label>
                    <select
                      value={selectedSection}
                      onChange={e => setSelectedSection(e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="">Choose Section</option>
                      {grades.filter(g => g.name === selectedGrade).map(g => (
                        <option key={g.id} value={g.section}>{g.section}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Selection metrics info box */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 text-sm">Selection Registered</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  We resolved <strong className="text-indigo-600 font-extrabold">{selectedStudents.length}</strong> student documents matching this target. Generating badges creates automatic security records.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Ready: {selectedStudents.length} Badging Profiles
            </span>
            <div className="flex gap-4">
              <button 
                onClick={onClose} 
                className="px-5 py-3 border border-gray-200 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all text-gray-600 cursor-pointer"
              >
                Close
              </button>
              
              <button
                disabled={isGenerating || isExporting || selectedStudents.length === 0}
                onClick={handleExportPdf}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" /> Export as PDF
                  </>
                )}
              </button>

              <button
                disabled={isGenerating || isExporting || selectedStudents.length === 0}
                onClick={handleGenerateAndPrint}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Preparing...
                  </>
                ) : (
                  <>
                    <IconsIdCard className="w-4 h-4" /> Cache & Print
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Fallback Helper for Lucide icon
const IconsIdCard = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 10h4" />
    <path d="M7 14h4" />
    <circle cx="16" cy="12" r="2" />
  </svg>
);
