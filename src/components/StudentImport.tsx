import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, CheckCircle2, AlertCircle, Loader2, HelpCircle, 
  Map, FileSpreadsheet, ChevronRight, FileText, Database, ArrowRight,
  RefreshCw, Check, Percent
} from 'lucide-react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Grade } from '../types';
import { read, utils } from 'xlsx';
import { toast } from 'react-hot-toast';

interface StudentImportProps {
  isOpen: boolean;
  onClose: () => void;
  grades: Grade[];
  students: Student[];
}

interface FileRow {
  [key: string]: any;
}

interface ParsedRecord {
  name: string;
  sex: 'M' | 'F';
  age: number;
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  imported: number;
  skipped: number;
  failed: number;
}

export const StudentImport: React.FC<StudentImportProps> = ({ isOpen, onClose, grades, students }) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1); // 1: Info, 2: Upload & Map, 3: Preview & Validate, 4: Execute
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]); // holds raw parsed row objects or arrays
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ name: string; sex: string; age: string }>({
    name: '',
    sex: '',
    age: ''
  });
  const [hasHeaders, setHasHeaders] = useState(true);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Execution states
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect columns when rawRows or headers change
  useEffect(() => {
    if (fileHeaders.length === 0) return;

    const findBestMatch = (targets: string[]): string => {
      for (const target of targets) {
        const match = fileHeaders.find(h => h.toLowerCase().trim() === target.toLowerCase());
        if (match) return match;
      }
      // Fuzzy substring matching
      for (const target of targets) {
        const match = fileHeaders.find(h => h.toLowerCase().includes(target.toLowerCase()));
        if (match) return match;
      }
      return '';
    };

    const nameCol = findBestMatch(['full name', 'fullname', 'student name', 'studentname', 'name', 'student', 'nama']);
    const sexCol = findBestMatch(['sex', 'gender', 'g', 's', 'sex/gender']);
    const ageCol = findBestMatch(['age', 'student age', 'studentage', 'yrs', 'years']);

    setColumnMapping({
      name: nameCol || fileHeaders[0] || '',
      sex: sexCol || fileHeaders[1] || '',
      age: ageCol || fileHeaders[2] || ''
    });
  }, [fileHeaders]);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // File selection change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Convert Excel / Sheet rows to a cleaner format
  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsAnalyzing(true);
    setActiveStep(2);

    try {
      const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      const reader = new FileReader();

      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          setIsAnalyzing(false);
          toast.error("Could not read file data.");
          return;
        }

        try {
          if (extension === '.json') {
            const jsonText = new TextDecoder().decode(data as ArrayBuffer);
            const parsed = JSON.parse(jsonText);
            let items: any[] = [];
            
            if (Array.isArray(parsed)) {
              items = parsed;
            } else if (parsed.students && Array.isArray(parsed.students)) {
              items = parsed.students;
            } else {
              items = [parsed];
            }

            if (items.length > 0) {
              const headers = Object.keys(items[0]);
              setFileHeaders(headers);
              setRawRows(items);
            } else {
              throw new Error("Empty array in JSON file.");
            }
          } else if (extension === '.txt') {
            const text = new TextDecoder().decode(data as ArrayBuffer);
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const items: any[] = [];

            lines.forEach((line, idx) => {
              // Custom pattern: 1. Nahom Debebe. M. 17
              const regex = /^\d*\.?\s*(.*?)\.\s*([MFmf])\.\s*(\d+)$/;
              const match = line.match(regex);
              if (match) {
                items.push({
                  'Full Name': match[1].trim(),
                  'Sex': match[2].toUpperCase(),
                  'Age': parseInt(match[3])
                });
              } else {
                // Try comma or pipe separation
                const parts = line.split(/[,|\t]/);
                if (parts.length >= 3) {
                  items.push({
                    'Full Name': parts[0].trim(),
                    'Sex': parts[1].trim().toUpperCase(),
                    'Age': parseInt(parts[2].trim()) || 0
                  });
                } else {
                  items.push({
                    'Full Name': line,
                    'Sex': 'M',
                    'Age': 0,
                    'isUnparseable': true
                  });
                }
              }
            });

            setFileHeaders(['Full Name', 'Sex', 'Age']);
            setRawRows(items);
          } else {
            // XLS, XLSX, CSV, TSV (all processed by SheetJS read)
            const workbook = read(new Uint8Array(data as ArrayBuffer), { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Read rows as array of arrays first to fetch raw headers and allow clean index-mapping
            const sheetRows = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            if (sheetRows.length === 0) {
              throw new Error("Selected sheet is empty.");
            }

            const headerRow = sheetRows[0].map((h, idx) => h?.toString().trim() || `Column_${idx + 1}`);
            setFileHeaders(headerRow);

            // Convert to parsed row objects mapping index to header key
            const formattedRows = sheetRows.slice(1).map(row => {
              const obj: any = {};
              headerRow.forEach((header, index) => {
                obj[header] = row[index] !== undefined ? row[index] : '';
              });
              return obj;
            });

            setRawRows(formattedRows);
          }
          toast.success("File analyzed! Review column mappings below.");
        } catch (err: any) {
          console.error("File parse error:", err);
          toast.error(`Error parsing file: ${err.message || 'Check format settings'}`);
          setFile(null);
        } finally {
          setIsAnalyzing(false);
        }
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read selection.");
      setIsAnalyzing(false);
    }
  };

  // Perform multi-column record validations
  const analyzeAndValidate = () => {
    if (!columnMapping.name) {
      toast.error("Please configure the Full Name column mapping.");
      return;
    }

    setIsAnalyzing(true);
    const results: ParsedRecord[] = [];
    const localNames = new Set<string>();

    rawRows.forEach((row, idx) => {
      // Extract raw values
      const rawName = row[columnMapping.name];
      const rawSex = columnMapping.sex ? row[columnMapping.sex] : '';
      const rawAge = columnMapping.age ? row[columnMapping.age] : '';

      const name = rawName ? rawName.toString().trim() : '';
      let sex: 'M' | 'F' = 'M';
      let age = 0;
      const errors: string[] = [];

      // Name Checks
      if (!name) {
        errors.push("Missing student name");
      } else if (name.length < 3) {
        errors.push("Name must be at least 3 characters");
      }

      // Sex / Gender Checks
      if (rawSex) {
        const cleanSex = rawSex.toString().trim().toUpperCase();
        if (cleanSex === 'M' || cleanSex === 'MALE') {
          sex = 'M';
        } else if (cleanSex === 'F' || cleanSex === 'FEMALE') {
          sex = 'F';
        } else {
          errors.push(`Invalid gender value: "${rawSex}"`);
        }
      } else {
        errors.push("Missing gender field");
      }

      // Age Checks
      if (rawAge !== undefined && rawAge !== '') {
        const parsedAge = parseInt(rawAge.toString().trim());
        if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 100) {
          errors.push(`Invalid student age: "${rawAge}"`);
        } else {
          age = parsedAge;
        }
      } else {
        errors.push("Missing age details");
      }

      // Skip row if completely blank
      if (!name && !rawSex && !rawAge) {
        return; // ignore empty row
      }

      let isDuplicate = false;
      const cleanLowerName = name.toLowerCase().replace(/\s+/g, ' ');

      // Check sheet duplicate
      if (localNames.has(cleanLowerName)) {
        isDuplicate = true;
        errors.push("Duplicate student in import sheet");
      } else {
        localNames.add(cleanLowerName);
      }

      // Check database duplicate (matching grade and section and same student name)
      if (selectedGrade && selectedSection) {
        const dbDuplicate = students.some(s => 
          s.name.toLowerCase().replace(/\s+/g, ' ') === cleanLowerName &&
          s.grade === selectedGrade &&
          s.section === selectedSection
        );
        if (dbDuplicate) {
          isDuplicate = true;
          errors.push(`Already registered in database for ${selectedGrade}-${selectedSection}`);
        }
      }

      results.push({
        name,
        sex,
        age,
        rowNumber: idx + 2, // header takes up row 1
        isValid: errors.length === 0,
        errors,
        isDuplicate
      });
    });

    setParsedRecords(results);
    setIsAnalyzing(false);
    setActiveStep(3);
    toast.success(`Data validation finished for ${results.length} rows.`);
  };

  const generateId = (existingIds: string[]) => {
    const digits = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `ST${digits}`;
  };

  // Perform batch writes in chunks of 100 entries to optimize writes
  const handleFinalizeImport = async () => {
    if (!selectedGrade || !selectedSection) {
      toast.error("Grade and Section must be selected.");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setActiveStep(4);

    const validRows = parsedRecords.filter(r => r.isValid && !r.isDuplicate);
    const skipped = parsedRecords.filter(r => r.isDuplicate).length;
    const failed = parsedRecords.filter(r => !r.isValid).length;
    const total = parsedRecords.length;

    const chunkSize = 100;
    let successCount = 0;
    const existingIds = students.map(s => s.studentId);

    try {
      const totalChunks = Math.ceil(validRows.length / chunkSize);

      for (let i = 0; i < validRows.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = validRows.slice(i, i + chunkSize);

        chunk.forEach(record => {
          let studentId = generateId(existingIds);
          // ensure uniqueness locally
          while (existingIds.includes(studentId)) {
            studentId = generateId(existingIds);
          }
          existingIds.push(studentId);

          const studentRef = doc(db, 'students', studentId);
          batch.set(studentRef, {
            id: studentId,
            studentId: studentId,
            name: record.name,
            sex: record.sex,
            age: record.age,
            grade: selectedGrade,
            section: selectedSection,
            createdAt: new Date().toISOString()
          });
          successCount++;
        });

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / validRows.length) * 100));
      }

      setImportSummary({
        total,
        valid: validRows.length,
        invalid: failed,
        imported: successCount,
        skipped,
        failed: failed + (validRows.length - successCount)
      });
      toast.success("Student directory upgraded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Database connection lost midway. Verify your security permissions.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-gray-100 dark:border-gray-800 transition-colors">
        
        {/* Header bar */}
        <div className="p-6 bg-gray-950 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black leading-tight">Advanced Student Directory Importer</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Automated Multi-Format System</p>
            </div>
          </div>
          <button 
            disabled={isImporting} 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Dynamic Wizard Progress Indicator */}
        <div className="bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-8 py-4 flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-400 shrink-0">
          <div className="flex items-center gap-6 w-full max-w-3xl mx-auto">
            <div className={`flex items-center gap-2 ${activeStep >= 1 ? 'text-indigo-650 dark:text-indigo-400 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${activeStep === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-700'}`}>1</span>
              <span>Class Directory</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <div className={`flex items-center gap-2 ${activeStep >= 2 ? 'text-indigo-650 dark:text-indigo-400 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${activeStep === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-700'}`}>2</span>
              <span>File Map</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <div className={`flex items-center gap-2 ${activeStep >= 3 ? 'text-indigo-650 dark:text-indigo-400 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${activeStep === 3 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-700'}`}>3</span>
              <span>Verification</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <div className={`flex items-center gap-2 ${activeStep >= 4 ? 'text-indigo-650 dark:text-indigo-400 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${activeStep === 4 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-700'}`}>4</span>
              <span>Database Sync</span>
            </div>
          </div>
        </div>

        {/* Wizard Panel Content Area */}
        <div className="flex-grow overflow-y-auto p-8 bg-gray-50/50 dark:bg-gray-950/20">
          
          {/* STEP 1: CONFIGURE GRADE & SECTION TARGET */}
          {activeStep === 1 && (
            <div className="max-w-xl mx-auto space-y-8 py-6">
              <div className="text-center space-y-2">
                <GradientClassBadge className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 mx-auto rounded-2xl flex items-center justify-center" />
                <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Set Destination Directory</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">All student profiles being parsed will reside inside this designated class folder.</p>
              </div>

              <div className="bg-white dark:bg-gray-905 border border-gray-100 dark:border-gray-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select Academic Grade</label>
                  <select 
                    value={selectedGrade}
                    onChange={e => {
                      setSelectedGrade(e.target.value);
                      setSelectedSection('');
                    }}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="">-- Select Grade --</option>
                    {[...new Set(grades.map(g => g.name))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select Target Section</label>
                  <select 
                    value={selectedSection}
                    disabled={!selectedGrade}
                    onChange={e => setSelectedSection(e.target.value)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">-- Choose Section --</option>
                    {grades.filter(g => g.name === selectedGrade).map(g => (
                      <option key={g.id} value={g.section}>{g.section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  disabled={!selectedGrade || !selectedSection}
                  onClick={() => setActiveStep(2)}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/40 text-white text-xs font-black uppercase tracking-wider rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-transform active:scale-95 cursor-pointer"
                >
                  Proceed To Selection <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD & FIELD MAPPING */}
          {activeStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-8 py-2">
              
              {/* Back Button */}
              <button 
                onClick={() => setActiveStep(1)} 
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              >
                ← Back
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                
                {/* File Drop Drag Area */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="text-left space-y-1">
                    <h4 className="text-lg font-black text-indigo-950 dark:text-white leading-tight">Drop Academic Manifest</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium pb-2">We support spreadsheet tables, documents, data lists, or objects.</p>
                  </div>

                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-3 border-dashed rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-4 cursor-pointer select-none transition-all ${
                      dragActive 
                        ? 'border-indigo-650 bg-indigo-50/20' 
                        : 'border-gray-200 dark:border-gray-800 hover:border-indigo-400 bg-white dark:bg-gray-901'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept=".xlsx,.xls,.csv,.tsv,.json,.txt" 
                      onChange={handleFileChange} 
                    />
                    
                    {isAnalyzing ? (
                      <div className="space-y-3">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                        <p className="text-xs font-black text-indigo-505 uppercase tracking-widest">Parsing File Internals...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 hover:scale-105 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 transition-transform">
                          <Upload className="w-6 h-6 text-indigo-505 inline" />
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-gray-800 dark:text-gray-200">Drag file here or select browser directory...</p>
                          <p className="text-[10px] text-gray-400 font-bold tracking-wider mt-1.5 uppercase">
                            Supports XLS, XLSX, CSV, TSV, JSON, TXT
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {file && (
                    <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-indigo-600 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{file.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Size: {(file.size / 1024).toFixed(1)} KB   |   Rows Found: {rawRows.length}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setFile(null);
                          setRawRows([]);
                          setFileHeaders([]);
                        }} 
                        className="p-1 px-2.5 hover:bg-red-50 text-red-500 font-black text-xs rounded-lg border border-red-100 hover:scale-105 transition-all cursor-pointer"
                      >
                        Reset Source
                      </button>
                    </div>
                  )}
                </div>

                {/* Column Mapping Panel */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
                  <div>
                    <h5 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <Map className="w-4 h-4 text-indigo-550" /> Column Mapping
                    </h5>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">
                      Align document headers with the student directory database architecture.
                    </p>
                  </div>

                  {fileHeaders.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 border-dashed">
                      Pending Source Upload
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Name Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Full Name Field *</label>
                        <select 
                          value={columnMapping.name}
                          onChange={e => setColumnMapping({ ...columnMapping, name: e.target.value })}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-bold text-xs"
                        >
                          <option value="">-- Choose Field --</option>
                          {fileHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sex Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Gender / Sex *</label>
                        <select 
                          value={columnMapping.sex}
                          onChange={e => setColumnMapping({ ...columnMapping, sex: e.target.value })}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-bold text-xs"
                        >
                          <option value="">-- Choose Field --</option>
                          {fileHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Age Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Student Age *</label>
                        <select 
                          value={columnMapping.age}
                          onChange={e => setColumnMapping({ ...columnMapping, age: e.target.value })}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-bold text-xs"
                        >
                          <option value="">-- Choose Field --</option>
                          {fileHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="pt-4 flex">
                        <button
                          disabled={!columnMapping.name || isAnalyzing}
                          onClick={analyzeAndValidate}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Validate & Filter Records
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW AND VALIDATION DECK */}
          {activeStep === 3 && (
            <div className="space-y-6">
              
              {/* Toolbar */}
              <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setActiveStep(2)} 
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-100 cursor-pointer"
                >
                  ← Map Schema
                </button>
                <div className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-4">
                  <span>Total Parsed: <b className="text-indigo-650 dark:text-indigo-400">{parsedRecords.length}</b></span>
                  <span>Valid: <b className="text-emerald-500">{parsedRecords.filter(p => p.isValid).length}</b></span>
                  <span>Review Priority: <b className="text-red-500">{parsedRecords.filter(p => !p.isValid).length}</b></span>
                </div>
              </div>

              {/* Validation List Table */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm flex-grow">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-950 text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-widest border-b border-gray-100 dark:border-gray-805">
                      <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Row</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4 text-center">Sex</th>
                        <th className="px-6 py-4 text-center">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {parsedRecords.map((p, idx) => (
                        <tr key={idx} className={p.isValid ? 'bg-white dark:bg-gray-900 hover:bg-gray-50' : p.isDuplicate ? 'bg-amber-50/20 dark:bg-amber-950/5' : 'bg-red-50/20 dark:bg-red-950/5'}>
                          <td className="px-6 py-3.5">
                            {p.isValid ? (
                              <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase">
                                <CheckCircle2 className="w-4 h-4 shrink-0" /> Stable
                              </div>
                            ) : p.isDuplicate ? (
                              <div className="flex items-center gap-1 text-amber-600 text-[10px] font-black uppercase">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Enrolled / Duplicate
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-500 text-[10px] font-black uppercase">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Corrupted
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-[10px] text-gray-400 font-bold">{p.rowNumber}</td>
                          <td className="px-6 py-3.5 font-bold text-gray-700 dark:text-gray-200">
                            {p.name || <span className="text-red-400 italic">Empty Text</span>}
                            {p.errors.length > 0 && (
                              <span className="block text-[9px] font-extrabold text-red-450 mt-1 space-y-0.5">
                                {p.errors.map((e, index) => (
                                  <span key={index} className="block">• {e}</span>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-center text-xs font-mono font-black">{p.sex}</td>
                          <td className="px-6 py-3.5 text-center text-xs font-mono font-black">{p.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Validated directory size: {parsedRecords.filter(p => p.isValid && !p.isDuplicate).length} stable profiles ready.
                </span>
                <button
                  disabled={parsedRecords.filter(p => p.isValid && !p.isDuplicate).length === 0}
                  onClick={handleFinalizeImport}
                  className="px-8 py-4 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  Write To Database
                </button>
              </div>

            </div>
          )}

          {/* STEP 4: PROGRESS BAR & WRITE SUMMARY */}
          {activeStep === 4 && (
            <div className="max-w-xl mx-auto space-y-8 py-6">
              
              {isImporting ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-8 text-center space-y-6 shadow-sm">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">Writing Student Directory...</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Integrating verified batch documents securely</p>
                  </div>
                  
                  {/* Progress Indicator */}
                  <div className="space-y-2">
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3.5 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-gray-400">
                      <span>{progress}% Finished</span>
                      <span>Batch Sync Active</span>
                    </div>
                  </div>
                </div>
              ) : importSummary ? (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-930 border border-emerald-100 dark:border-emerald-900/50 rounded-3xl p-8 text-center space-y-6 shadow-sm">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-150">
                      <CheckCircle2 className="w-10 h-10 inline" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Sync Completed Successfully!</h4>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{selectedGrade} - {selectedSection} Updated</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Total Evaluated</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-gray-100 mt-1 block">{importSummary.total}</span>
                      </div>
                      <div className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-2xl">
                        <span className="text-[9px] font-black text-indigo-550 uppercase tracking-widest block">Imported Profiles</span>
                        <span className="text-xl font-mono font-black text-indigo-650 dark:text-indigo-400 mt-1 block">{importSummary.imported}</span>
                      </div>
                      <div className="bg-amber-50/20 border border-amber-100/30 p-4 rounded-2xl">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Skipped / Failed</span>
                        <span className="text-xl font-mono font-black text-amber-700 dark:text-amber-500 mt-1 block">{importSummary.skipped + importSummary.failed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setActiveStep(1);
                        setFile(null);
                        setRawRows([]);
                        setParsedRecords([]);
                        setImportSummary(null);
                        onClose();
                      }}
                      className="px-10 py-4 bg-gray-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white leading-tight font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-gray-805 transition-all cursor-pointer"
                    >
                      Return To Students Catalog
                    </button>
                  </div>
                </div>
              ) : null}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

// Lucide icon helper mapping
const GradientClassBadge = ({ className }: { className?: string }) => (
  <div className={className}>
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
    </svg>
  </div>
);
