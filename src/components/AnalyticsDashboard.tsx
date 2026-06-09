import React, { useState, useEffect } from 'react';
import { 
  Loader2, TrendingUp, Users, Award, Target, BookOpen, 
  Settings, Download, FileSpreadsheet, FileDown, 
  Filter, ShieldAlert, BadgeInfo, RefreshCw, Layers, Edit3, Save, UserMinus,
  Trash2, Plus, ArrowUp, ArrowDown, ShieldCheck, AlertTriangle, Play
} from 'lucide-react';
import { getAnalytics, calculateAndSaveAnalytics } from '../services/analyticsService';
import { SchoolAnalytics, Student, Mark, Grade, Subject, SchoolConfig } from '../types';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line,
  AreaChart, Area
} from 'recharts';

export const AnalyticsDashboard: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'overview' | 'rankings' | 'subjects' | 'comparatives' | 'decision_dropout' | 'merit_list' | 'attendance_analytics'>('config');

  // advanced lazy load cache arrays
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<Mark[]>([]);
  const [isLazyLoadingAll, setIsLazyLoadingAll] = useState(false);

  // Master definitions for lazy loading dropdowns
  const [masterGrades, setMasterGrades] = useState<Grade[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);
  
  // Rankings search controls
  const [schoolRankSearch, setSchoolRankSearch] = useState('');
  const [gradeRankSearch, setGradeRankSearch] = useState('');
  const [selectedBatchGrade, setSelectedBatchGrade] = useState('All');

  // Dynamic Grade & Section lazy-loader states
  const [selectedSubGrade, setSelectedSubGrade] = useState('');
  const [selectedSubSection, setSelectedSubSection] = useState('');
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [classMarks, setClassMarks] = useState<Mark[]>([]);
  const [classLoading, setClassLoading] = useState(false);

  // Score range customization
  const [customRanges, setCustomRanges] = useState<{ id: string; label: string; min: number; max: number }[]>([
    { id: '1', label: '<50', min: 0, max: 49.9 },
    { id: '2', label: '50-75', min: 50, max: 74.9 },
    { id: '3', label: '75-90', min: 75, max: 89.9 },
    { id: '4', label: '90-100', min: 90, max: 100 }
  ]);
  const [cachedRanges, setCachedRanges] = useState<{ id: string; label: string; min: number; max: number }[] | null>(null);
  const [isEditingRanges, setIsEditingRanges] = useState(false);

  // Subject Average selection dynamic analysis
  const [avgGrade, setAvgGrade] = useState('');
  const [avgSection, setAvgSection] = useState('');
  const [avgSubject, setAvgSubject] = useState('');
  const [avgStats, setAvgStats] = useState<{ male: number; female: number; total: number } | null>(null);

  // Initialize and load static master collections and aggregated analytics summary
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // Fetch static helper list of grades & subjects for filters
        const gSnap = await getDocs(collection(db, 'grades'));
        const gradesList = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Grade[];
        setMasterGrades(gradesList);

        if (gradesList.length > 0) {
          setSelectedSubGrade(gradesList[0].name);
          setSelectedSubSection(gradesList[0].section);
          setAvgGrade(gradesList[0].name);
          setAvgSection(gradesList[0].section);
        }

        const sSnap = await getDocs(collection(db, 'subjects'));
        const subjectsList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Subject[];
        setMasterSubjects(subjectsList);
        if (subjectsList.length > 0) {
          setAvgSubject(subjectsList[0].id);
        }

        // Check if there is configured score ranges in general school configurations
        if (config?.analyticsRanges && config.analyticsRanges.length > 0) {
          const mapped = config.analyticsRanges.map((r: any, idx: number) => ({
            id: r.id || idx.toString(),
            label: r.label,
            min: parseFloat(r.min) || 0,
            max: parseFloat(r.max) || 0
          }));
          setCustomRanges(mapped);
        }

        const data = await getAnalytics();
        if (data) {
          setAnalytics(data);
          const loadedRanges = data.data?.scoreRangesUsed || [];
          if (loadedRanges.length > 0) {
            const mappedSaved = loadedRanges.map((r: any, idx: number) => ({
              id: r.id || idx.toString(),
              label: r.label,
              min: parseFloat(r.min) || 0,
              max: parseFloat(r.max) || 0
            }));
            setCustomRanges(mappedSaved);
            setCachedRanges(mappedSaved);
          }
        } else {
          setAnalytics(null);
          setCachedRanges(null);
        }
      } catch (err) {
        console.error(err);
        toast.error('Error seeding dashboard dependencies');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [config]);

  // Lazy loading function to load students & marks on-demand for specific grade + section
  useEffect(() => {
    if (!selectedSubGrade || !selectedSubSection) return;

    const fetchClassDataOnDemand = async () => {
      setClassLoading(true);
      try {
        // Fetch only specific students in that Grade and Section
        const sQuery = query(
          collection(db, 'students'),
          where('grade', '==', selectedSubGrade),
          where('section', '==', selectedSubSection)
        );
        const sSnap = await getDocs(sQuery);
        const fetchedStudents = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
        setClassStudents(fetchedStudents);

        // Fetch only related marks
        const mQuery = query(
          collection(db, 'marks'),
          where('grade', '==', selectedSubGrade),
          where('section', '==', selectedSubSection)
        );
        const mSnap = await getDocs(mQuery);
        const fetchedMarks = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Mark[];
        setClassMarks(fetchedMarks);

      } catch (err) {
        console.error('Error lazy loading class-level metrics:', err);
        toast.error('Failed to retrieve class details dynamically');
      } finally {
        setClassLoading(false);
      }
    };

    fetchClassDataOnDemand();
  }, [selectedSubGrade, selectedSubSection]);

  // Lazy load complete rosters for Merit rankings and Attendance computations
  useEffect(() => {
    if (activeSubTab !== 'merit_list' && activeSubTab !== 'attendance_analytics') return;
    if (allStudents.length > 0 && allMarks.length > 0) return;

    const fetchAllComprehensives = async () => {
      setIsLazyLoadingAll(true);
      try {
        const [stSnap, mrSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'marks'))
        ]);
        setAllStudents(stSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[]);
        setAllMarks(mrSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Mark[]);
      } catch (err) {
        console.error('Error fetching advanced datasets:', err);
        toast.error('Failed to resolve all school records.');
      } finally {
        setIsLazyLoadingAll(false);
      }
    };

    fetchAllComprehensives();
  }, [activeSubTab, allStudents.length, allMarks.length]);

  // Compute stats for Subject Average on dynamic picks
  useEffect(() => {
    if (!avgGrade || !avgSection || !avgSubject) return;

    const computeAvgStatOnDemand = async () => {
      try {
        const sQuery = query(
          collection(db, 'students'),
          where('grade', '==', avgGrade),
          where('section', '==', avgSection)
        );
        const sSnap = await getDocs(sQuery);
        const pupils = sSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];

        const mQuery = query(
          collection(db, 'marks'),
          where('grade', '==', avgGrade),
          where('section', '==', avgSection),
          where('subjectId', '==', avgSubject)
        );
        const mSnap = await getDocs(mQuery);
        const grades = mSnap.docs.map(d => d.data() as Mark);

        let mSum = 0, mCount = 0;
        let fSum = 0, fCount = 0;
        let tSum = 0, tCount = 0;

        grades.forEach(mk => {
          const student = pupils.find(p => p.studentId === mk.studentId);
          const score = (mk.semester1 + mk.semester2) / 2;
          tSum += score;
          tCount++;
          if (student) {
            if (student.sex === 'M') {
              mSum += score;
              mCount++;
            } else {
              fSum += score;
              fCount++;
            }
          }
        });

        setAvgStats({
          male: mCount > 0 ? mSum / mCount : 0,
          female: fCount > 0 ? fSum / fCount : 0,
          total: tCount > 0 ? tSum / tCount : 0
        });

      } catch (err) {
        console.error(err);
      }
    };

    computeAvgStatOnDemand();
  }, [avgGrade, avgSection, avgSubject]);

  // Keep avgSubject always synchronized with assigned subjects of the selected grade/section
  useEffect(() => {
    if (!avgGrade || !avgSection || masterGrades.length === 0 || masterSubjects.length === 0) return;
    const gr = masterGrades.find(g => g.name === avgGrade && g.section === avgSection);
    const filteredSubs = gr && gr.subjectIds && gr.subjectIds.length > 0
      ? masterSubjects.filter(sub => gr.subjectIds!.includes(sub.id))
      : masterSubjects;
    if (filteredSubs.length > 0) {
      if (!filteredSubs.some(sub => sub.id === avgSubject)) {
        setAvgSubject(filteredSubs[0].id);
      }
    }
  }, [avgGrade, avgSection, masterGrades, masterSubjects, avgSubject]);

  // Recalculates analytical aggregates and saves to Cloud Storage/Firestore
  const handleRecalculate = async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const rangesToSave = customRanges.map(cr => ({
        label: cr.label,
        min: cr.min,
        max: cr.max
      }));

      await calculateAndSaveAnalytics(rangesToSave);
      const updated = await getAnalytics();
      if (updated) {
        setAnalytics(updated);
        const loadedRanges = updated.data?.scoreRangesUsed || [];
        if (loadedRanges.length > 0) {
          const mappedSaved = loadedRanges.map((r: any, idx: number) => ({
            id: r.id || idx.toString(),
            label: r.label,
            min: parseFloat(r.min) || 0,
            max: parseFloat(r.max) || 0
          }));
          setCustomRanges(mappedSaved);
          setCachedRanges(mappedSaved);
        }
        if (!silent) toast.success('Analytics pipeline successfully generated and cached!');
      }
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Recalculation routine crashed');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  // Safe handler to update customizable ranges locally in state
  const handleSaveRanges = () => {
    setIsEditingRanges(false);
    for (let r of customRanges) {
      if (isNaN(r.min) || isNaN(r.max) || r.min < 0 || r.max > 100) {
        toast.error('Ranges must contain valid numbers between 0 and 100.');
        return;
      }
    }
    toast.success('Ranges updated locally! Recalculate analytics to apply.');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...customRanges];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setCustomRanges(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === customRanges.length - 1) return;
    const updated = [...customRanges];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setCustomRanges(updated);
  };

  const handleAddRange = () => {
    let lastMax = 0;
    if (customRanges.length > 0) {
      lastMax = customRanges[customRanges.length - 1].max;
    }
    const nextMin = Math.min(100, lastMax + 0.1);
    const nextMax = Math.min(100, nextMin + 15);
    const newRange = {
      id: Math.random().toString(),
      label: `${Math.round(nextMin)}-${Math.round(nextMax)}`,
      min: parseFloat(nextMin.toFixed(1)),
      max: parseFloat(nextMax.toFixed(1))
    };
    setCustomRanges([...customRanges, newRange]);
    toast.success('New score range added! Customize thresholds below.');
  };

  const handleDeleteRange = (id: string) => {
    setCustomRanges(customRanges.filter(r => r.id !== id));
    toast.error('Score range removed.');
  };

  const isOutOfDate = (() => {
    if (!analytics) return false;
    if (!cachedRanges) return false;
    if (customRanges.length !== cachedRanges.length) return true;
    for (let i = 0; i < customRanges.length; i++) {
      if (
        customRanges[i].label !== cachedRanges[i].label ||
        customRanges[i].min !== cachedRanges[i].min ||
        customRanges[i].max !== cachedRanges[i].max
      ) {
        return true;
      }
    }
    return false;
  })();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Initializing High-Performance Analytics Core...</p>
      </div>
    );
  }

  // Destructure cached indices with fallback safeguards so it doesn't crash on null analytics
  const schoolWideStats = analytics?.data?.schoolWideStats || {
    totalStudents: 0,
    totalMale: 0,
    totalFemale: 0,
    totalTeachers: 0,
    totalGrades: 0,
    totalSections: 0,
    passRate: 0,
    malePassRate: 0,
    femalePassRate: 0
  };
  const gradeComparison = analytics?.data?.gradeComparison || {};
  const genderPerformance = analytics?.data?.genderPerformance || {};
  const decisionReports = analytics?.data?.decisionReports || {
    bestPerformingGrades: [],
    bestPerformingSubjects: [],
    lowestPerformingGrades: [],
    lowestPerformingSubjects: []
  };
  const dropoutAnalysis = analytics?.data?.dropoutAnalysis || {
    schoolTotal: { total: 0, male: 0, female: 0 },
    byGrade: {},
    bySection: {}
  };
  const allStudentsRankData = analytics?.data?.allStudentsRankData || [];

  // Helpers to fetch unique Grade lists (9, 10, 11, 12 etc.)
  const distinctGradeLevels = Array.from(new Set(masterGrades.map(g => g.name))).sort((a, b) => Number(a) - Number(b));

  // 1. FILTERED UNIVERSAL TOP 20
  const globalPublishedTop20 = allStudentsRankData
    ? allStudentsRankData
        .filter(s => s.isPublished)
        .filter(s => s.name.toLowerCase().includes(schoolRankSearch.toLowerCase()) || s.studentId.toLowerCase().includes(schoolRankSearch.toLowerCase()))
        .sort((a, b) => b.average - a.average)
        .slice(0, 20)
    : [];

  // 2. BATCH LEVEL TOP 20
  const batchLevelTop20 = allStudentsRankData
    ? allStudentsRankData
        .filter(s => selectedBatchGrade === 'All' ? true : s.grade === selectedBatchGrade)
        .filter(s => s.name.toLowerCase().includes(gradeRankSearch.toLowerCase()) || s.studentId.toLowerCase().includes(gradeRankSearch.toLowerCase()))
        .sort((a, b) => b.average - a.average)
        .slice(0, 20)
    : [];

  // EXPORT HANDLERS - EXCEL & PDF EXPORTS WITH PROFESSIONALLY STYLED TABLES

  // EXCEL: Top 20 Global
  const exportTop25Excel = (list: any[], title: string) => {
    const dataRows = list.map((student, idx) => ({
      Rank: idx + 1,
      'Student ID': student.studentId,
      'Full Name': student.name,
      Grade: `Grade ${student.grade}${student.section}`,
      Gender: student.sex,
      'Average Score': student.average ? `${student.average.toFixed(1)}%` : '0%'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Top Performers");
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_Averages.xlsx`);
  };

  // PDF: Top 20 Global/Grade
  const exportTop25PDF = (list: any[], title: string) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(config?.schoolName || 'CHERCHER SECONDARY SCHOOL', 14, 15);
    doc.setFontSize(12);
    doc.text(title, 14, 22);
    doc.text(`Academic Year: ${config?.academicYear || '2016 E.C'}`, 14, 28);

    const headers = [['Rank', 'Student ID', 'Full Name', 'Grade & Section', 'Sex', 'Average Score']];
    const dataRows = list.map((s, idx) => [
      idx + 1,
      s.studentId,
      s.name,
      `Grade ${s.grade}${s.section}`,
      s.sex,
      s.average ? `${s.average.toFixed(1)}%` : '0%'
    ]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 34,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  // Helper to compute sub-records for Semester 1, Semester 2, or overall average per subject
  const getTermStats = (subMarks: Mark[], term: 'S1' | 'S2' | 'Avg') => {
    const getScore = (m: Mark) => {
      if (term === 'S1') return m.semester1;
      if (term === 'S2') return m.semester2;
      return (m.semester1 + m.semester2) / 2;
    };

    const maleMarks = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'M');
    const femaleMarks = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'F');

    const maleSum = maleMarks.reduce((acc, m) => acc + getScore(m), 0);
    const femaleSum = femaleMarks.reduce((acc, m) => acc + getScore(m), 0);
    const overallSum = subMarks.reduce((acc, m) => acc + getScore(m), 0);

    const maleAvg = maleMarks.length > 0 ? (maleSum / maleMarks.length) : null;
    const femaleAvg = femaleMarks.length > 0 ? (femaleSum / femaleMarks.length) : null;
    const overallAvg = subMarks.length > 0 ? (overallSum / subMarks.length) : null;

    const rangesCount = customRanges.map(range => {
      const matchingMarks = subMarks.filter(m => {
        const score = getScore(m);
        return score >= range.min && score <= range.max;
      });

      const mCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'M').length;
      const fCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'F').length;

      return {
        male: mCount,
        female: fCount,
        total: matchingMarks.length
      };
    });

    return {
      maleAvg,
      femaleAvg,
      overallAvg,
      rangesCount,
      maleCount: maleMarks.length,
      femaleCount: femaleMarks.length,
      totalCount: subMarks.length
    };
  };

  // EXCEL EXTRAS: Subject performance Matrix (English & Afaan Oromoo)
  const exportSubjectAnalysisExcel = (gradeSel: string, sectionSel: string) => {
    const matrixRows: any[] = [];
    
    // Add School Header Info
    matrixRows.push({ 'School Name': config?.schoolName || 'CHERCHER SECONDARY SCHOOL' });
    matrixRows.push({ 'Grade (Kutaa)': gradeSel, 'Section (Daree)': sectionSel });
    matrixRows.push({ 'Number of Students (Baayina Baratotaa)': classStudents.length });
    matrixRows.push({}); // spacing Empty row

    // Prepare Column names
    const heading = {
      Subject: 'Subject (Gosa Barnootaa)',
      Term: 'Term (Seem)',
      ...customRanges.reduce((acc, cr) => {
        return {
          ...acc,
          [`${cr.label} Male`]: `${cr.label} M`,
          [`${cr.label} Female`]: `${cr.label} F`,
          [`${cr.label} Total`]: `${cr.label} T`
        };
      }, {}),
      'Avg Male': 'Average M',
      'Avg Female': 'Average F',
      'Avg Total': 'Average T'
    };
    matrixRows.push(heading);

    const matchedGrade = masterGrades.find(g => g.name === gradeSel && g.section === sectionSel);
    const assignedSubjects = matchedGrade && matchedGrade.subjectIds && matchedGrade.subjectIds.length > 0
      ? masterSubjects.filter(sub => matchedGrade.subjectIds!.includes(sub.id))
      : masterSubjects;

    assignedSubjects.forEach(sub => {
      const subMarks = classMarks.filter(m => m.subjectId === sub.id);
      
      const s1Stats = getTermStats(subMarks, 'S1');
      const s2Stats = getTermStats(subMarks, 'S2');
      const avgStats = getTermStats(subMarks, 'Avg');

      const terms = [
        { label: 'S1 (Seem 1)', stats: s1Stats },
        { label: 'S2 (Seem 2)', stats: s2Stats },
        { label: 'Avg (Giddugaleessa)', stats: avgStats }
      ];

      terms.forEach((t, tIdx) => {
        const rowData: any = { 
          Subject: tIdx === 0 ? sub.name : '',
          Term: t.label
        };

        customRanges.forEach((range, rIdx) => {
          const rc = t.stats.rangesCount[rIdx];
          rowData[`${range.label} Male`] = rc.male;
          rowData[`${range.label} Female`] = rc.female;
          rowData[`${range.label} Total`] = rc.total;
        });

        rowData['Avg Male'] = t.stats.maleAvg !== null ? t.stats.maleAvg.toFixed(1) : '–';
        rowData['Avg Female'] = t.stats.femaleAvg !== null ? t.stats.femaleAvg.toFixed(1) : '–';
        rowData['Avg Total'] = t.stats.overallAvg !== null ? t.stats.overallAvg.toFixed(1) : '–';

        // Clean up double assignments
        delete rowData['Avg Female_1'];
        
        matrixRows.push(rowData);
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(matrixRows, { skipHeader: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subject Performance Analysis");
    XLSX.writeFile(workbook, `Subject_Analysis_${gradeSel}${sectionSel}.xlsx`);
  };

  // PDF EXPORT: Complete subject analysis bilingual sheet
  const exportSubjectAnalysisPDF = (gradeSel: string, sectionSel: string) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    doc.setFontSize(14);
    doc.text(config?.schoolName || 'CHERCHER SECONDARY SCHOOL', 14, 12);
    doc.setFontSize(10);
    doc.text(`SCHOOL PERFORMANCE ANALYSIS (XALXALA BU’AA BARNOOTA MANA BARUMSAA)`, 14, 18);
    doc.text(`Grade (Kutaa): ${gradeSel}  |  Section (Daree): ${sectionSel}  |  Students (Baay’ina): ${classStudents.length}`, 14, 24);

    // Dynamic headers based on customizable ranges
    const firstRowHeader = ['Subject (Gosa Barnootaa)', 'Term (Seem)'];
    customRanges.forEach(r => {
      firstRowHeader.push(r.label, '', '');
    });
    firstRowHeader.push('Average of Subject (Giddugaleessa Gosa Barnootaa)', '', '');

    const secondRowHeader = ['', ''];
    customRanges.forEach(() => {
      secondRowHeader.push('M', 'F', 'T');
    });
    secondRowHeader.push('Male', 'Female', 'Total');

    const bodyRows: any[] = [];
    const matchedGrade = masterGrades.find(g => g.name === gradeSel && g.section === sectionSel);
    const assignedSubjects = matchedGrade && matchedGrade.subjectIds && matchedGrade.subjectIds.length > 0
      ? masterSubjects.filter(sub => matchedGrade.subjectIds!.includes(sub.id))
      : masterSubjects;

    assignedSubjects.forEach(sub => {
      const subMarks = classMarks.filter(m => m.subjectId === sub.id);
      
      const s1Stats = getTermStats(subMarks, 'S1');
      const s2Stats = getTermStats(subMarks, 'S2');
      const avgStats = getTermStats(subMarks, 'Avg');

      const terms = [
        { label: 'S1 (Seem 1)', stats: s1Stats },
        { label: 'S2 (Seem 2)', stats: s2Stats },
        { label: 'Avg (Waliigala)', stats: avgStats }
      ];

      terms.forEach((t, tIdx) => {
        const rCells: any[] = [
          tIdx === 0 ? sub.name : '',
          t.label
        ];

        customRanges.forEach((range, rIdx) => {
          const rc = t.stats.rangesCount[rIdx];
          rCells.push(rc.male, rc.female, rc.total);
        });

        rCells.push(
          t.stats.maleAvg !== null ? t.stats.maleAvg.toFixed(1) : '–',
          t.stats.femaleAvg !== null ? t.stats.femaleAvg.toFixed(1) : '–',
          t.stats.overallAvg !== null ? t.stats.overallAvg.toFixed(1) : '–'
        );

        bodyRows.push(rCells);
      });
    });

    autoTable(doc, {
      head: [firstRowHeader, secondRowHeader],
      body: bodyRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
      columnStyles: { 
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 },
        1: { fontStyle: 'bold', fillColor: [248, 250, 252] }
      },
      headStyles: { fillColor: [55, 48, 163] }
    });

    doc.save(`Subject_Performance_Kutaa_${gradeSel}${sectionSel}.pdf`);
  };

  // Export Decesion Support/Dropout Analysis report to Excel
  const exportDecisionReportExcel = () => {
    const dataRows: any[] = [];
    dataRows.push({ 'School Decision-Making & Support Report': config?.schoolName || 'CHERCHER SECONDARY SCHOOL' });
    dataRows.push({ 'Academic Year': config?.academicYear || '2016 E.C' });
    dataRows.push({});

    dataRows.push({ 'Insight / Metric': 'Best Performing Grade', Value: decisionReports.bestPerformingGrades?.[0]?.gradeName || 'N/A' });
    dataRows.push({ 'Insight / Metric': 'Best Performing Subject', Value: decisionReports.bestPerformingSubjects?.[0]?.subjectName || 'N/A' });
    dataRows.push({ 'Insight / Metric': 'Overall Pass Rate', Value: `${(schoolWideStats?.passRate ?? 0).toFixed(1)}%` });
    dataRows.push({ 'Insight / Metric': 'Dropout Rate Count', Value: dropoutAnalysis?.schoolTotal?.total ?? 0 });
    dataRows.push({});

    dataRows.push({ Section: 'Dropout Analysis - Grade Batch Wise Distribution' });
    Object.keys(dropoutAnalysis?.byGrade || {}).forEach(gr => {
      dataRows.push({
        'Grade Level': `Grade ${gr}`,
        'Male Dropout': dropoutAnalysis?.byGrade?.[gr]?.male ?? 0,
        'Female Dropout': dropoutAnalysis?.byGrade?.[gr]?.female ?? 0,
        'Total Dropout': dropoutAnalysis?.byGrade?.[gr]?.total ?? 0
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Decision Support and Dropouts");
    XLSX.writeFile(workbook, "Decision_Support_Intelligence_Summary.xlsx");
  };

  // High-fidelity Merit list PDF report download
  const exportMeritListPDF = (title: string, data: any[]) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const schoolName = config?.schoolName || 'CHERCHER SECONDARY SCHOOL';
    const motto = config?.schoolMotto || 'KNOWLEDGE IS LIGHT';
    const academicYear = config?.academicYear || '2016 E.C';

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 37, 85);
    doc.text(schoolName.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text(motto.toUpperCase(), 105, 23, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text(title.toUpperCase(), 105, 30, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Academic Year: ${academicYear}   |   Date Generated: ${new Date().toLocaleDateString()}`, 105, 35, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 38, 195, 38);

    const body = data.map((item, idx) => [
      (idx + 1).toString(),
      item.studentId,
      item.name.toUpperCase(),
      item.sex,
      `${item.grade} - ${item.section}`,
      `${item.score.toFixed(1)}%`,
      item.passed ? 'PASSED' : 'FAILED'
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['RANK', 'STUDENT ID', 'STUDENT NAME', 'GENDER', 'GRADE & SECTION', 'TOTAL AVERAGE', 'STATUS']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 25 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 35 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 25 },
        6: { halign: 'center', cellWidth: 20 }
      },
      didDrawPage: (dp) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${dp.pageNumber} of ${pageCount}`, 105, 285, { align: 'center' });
      }
    });

    doc.save(`MeritList-${title.replace(/\s+/g, '-')}.pdf`);
  };

  // High-fidelity Attendance days PDF download
  const exportAttendancePDF = (title: string, data: any[]) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const schoolName = config?.schoolName || 'CHERCHER SECONDARY SCHOOL';
    const motto = config?.schoolMotto || 'KNOWLEDGE IS LIGHT';
    const academicYear = config?.academicYear || '2016 E.C';

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 37, 85);
    doc.text(schoolName.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text(motto.toUpperCase(), 105, 23, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text(title.toUpperCase(), 105, 30, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Academic Year: ${academicYear}   |   Date Generated: ${new Date().toLocaleDateString()}`, 105, 35, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 38, 195, 38);

    const body = data.map((item, idx) => [
      (idx + 1).toString(),
      item.studentId,
      item.name.toUpperCase(),
      item.sex,
      `${item.grade} - ${item.section}`,
      `${item.absent ?? 0} Guyyaa (Days)`,
      `${(100 - ((item.absent ?? 0) / 180 * 100)).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['S.NO', 'STUDENT ID', 'STUDENT NAME', 'GENDER', 'GRADE & SECTION', 'ABSENT DAYS', 'ATTENDANCE %']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 25 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 35 },
        5: { halign: 'center', cellWidth: 25 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
      }
    });

    doc.save(`AttendanceReport-${title.replace(/\s+/g, '-')}.pdf`);
  };

  // Setup dynamic Performance distribution datasets
  const dynamicDistData = customRanges.map(cr => {
    const count = allStudentsRankData
      ? allStudentsRankData.filter(s => s.average >= cr.min && s.average <= cr.max).length
      : 0;
    return {
      name: cr.label,
      value: count
    };
  });

  return (
    <div className="space-y-8 pb-12 animate-fade-in text-gray-900">
      
      {/* Dynamic Header with Recalculate options & syncing feedback */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-2xl text-white">
                <TrendingUp className="w-6 h-6" />
             </div>
             <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
               Analytics Dashboard <span className="text-gray-400 font-medium text-xs sm:text-base border-l pl-3 ml-2 border-gray-200">Giddugaleessa Qorannoo</span>
             </h2>
          </div>
          <p className="text-gray-500 font-medium italic mt-1 text-sm">
            High-fidelity bilingually supported insights, grade comparisons, dropout surveillance, and multi-variable analytics.
          </p>
        </div>

        {analytics && (
          <div className="self-start md:self-auto flex items-center gap-2 text-xs font-black text-gray-500 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-150">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span>Last Compiled: {new Date(analytics.updatedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* HORIZONTAL SECONDARY INTERNAL RAILS FOR INTENTIONAL ARCHITECTURE */}
      <div className="flex items-center overflow-x-auto gap-2 p-1 bg-gray-100/80 rounded-2xl max-w-full">
        <button 
          onClick={() => setActiveSubTab('config')} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeSubTab === 'config' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          ⚙️ Analytics Configuration & Ranges
        </button>
        <button 
          onClick={() => {
            if (!analytics) {
              toast.error('Analytical reports have not been generated yet. Please click "Calculate Analytics" first.');
              return;
            }
            setActiveSubTab('overview');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${!analytics ? 'opacity-40 cursor-not-allowed' : ''} ${activeSubTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          1. School Overview
        </button>
        <button 
          onClick={() => {
            if (!analytics) {
              toast.error('Analytical reports have not been generated yet.');
              return;
            }
            setActiveSubTab('rankings');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${!analytics ? 'opacity-40 cursor-not-allowed' : ''} ${activeSubTab === 'rankings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          2. Academic Rankings (Top 20)
        </button>
        <button 
          onClick={() => {
            if (!analytics) {
              toast.error('Analytical reports have not been generated yet.');
              return;
            }
            setActiveSubTab('subjects');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${!analytics ? 'opacity-40 cursor-not-allowed' : ''} ${activeSubTab === 'subjects' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          3. Subject Matrices (Bilingual)
        </button>
        <button 
          onClick={() => {
            if (!analytics) {
              toast.error('Analytical reports have not been generated yet.');
              return;
            }
            setActiveSubTab('comparatives');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${!analytics ? 'opacity-40 cursor-not-allowed' : ''} ${activeSubTab === 'comparatives' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900'}`}
        >
          4. Comparisons & Gender
        </button>
        <button 
          onClick={() => {
            if (!analytics) {
              toast.error('Analytical reports have not been generated yet.');
              return;
            }
            setActiveSubTab('decision_dropout');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${!analytics ? 'opacity-40 cursor-not-allowed' : ''} ${activeSubTab === 'decision_dropout' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900'}`}
        >
          5. Decision & Dropouts
        </button>
        <button 
          onClick={() => {
            setActiveSubTab('merit_list');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeSubTab === 'merit_list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900'}`}
        >
          🏅 6. Merit List
        </button>
        <button 
          onClick={() => {
            setActiveSubTab('attendance_analytics');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeSubTab === 'attendance_analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900'}`}
        >
          📅 7. Attendance (Hafte)
        </button>
        <button 
          onClick={() => {
            setActiveSubTab('top_students_publish');
          }} 
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeSubTab === 'top_students_publish' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900'}`}
        >
          🏆 8. Top Students Publish
        </button>
      </div>

      {/* TAB 0: ANALYTICS CONFIGURATION AND ORCHESTRATION */}
      {activeSubTab === 'config' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left/Main Column: Score Range Configuration */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" /> Score Range Configuration
                  </h3>
                  {!isEditingRanges ? (
                    <button 
                      onClick={() => setIsEditingRanges(true)}
                      className="text-xs bg-indigo-550 hover:bg-indigo-600 text-white bg-indigo-600 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Ranges
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleAddRange}
                        className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Range
                      </button>
                      <button 
                        onClick={handleSaveRanges}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Changes
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {customRanges.map((range, idx) => (
                    <div key={range.id || idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-gray-400">Range Label</span>
                          {!isEditingRanges ? (
                            <p className="font-bold text-gray-800 text-sm mt-0.5">{range.label}</p>
                          ) : (
                            <input 
                              className="bg-white px-2 py-1 border rounded text-xs font-bold w-full block mt-0.5 border-gray-300 focus:outline-indigo-500"
                              value={range.label} 
                              onChange={(e) => {
                                const updated = [...customRanges];
                                updated[idx].label = e.target.value;
                                setCustomRanges(updated);
                              }}
                            />
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-gray-400 block sm:text-right">Min Value (%)</span>
                          {!isEditingRanges ? (
                            <span className="font-bold text-xs text-indigo-600 block sm:text-right mt-1">{range.min}%</span>
                          ) : (
                            <input 
                              type="number" 
                              step="0.1"
                              className="bg-white p-1 border rounded text-xs w-full sm:text-right font-bold mt-0.5 border-gray-300 focus:outline-indigo-500"
                              value={range.min} 
                              onChange={(e) => {
                                const updated = [...customRanges];
                                updated[idx].min = parseFloat(e.target.value) || 0;
                                setCustomRanges(updated);
                              }}
                            />
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-gray-400 block sm:text-right">Max Value (%)</span>
                          {!isEditingRanges ? (
                            <span className="font-bold text-xs text-gray-650 block sm:text-right mt-1">{range.max}%</span>
                          ) : (
                            <input 
                              type="number" 
                              step="0.1"
                              className="bg-white p-1 border rounded text-xs w-full sm:text-right font-bold mt-0.5 border-gray-300 focus:outline-indigo-500"
                              value={range.max} 
                              onChange={(e) => {
                                const updated = [...customRanges];
                                updated[idx].max = parseFloat(e.target.value) || 0;
                                setCustomRanges(updated);
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Movement / Operations Drawer */}
                      {isEditingRanges && (
                        <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-gray-250">
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1 hover:bg-gray-200 text-gray-500 rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === customRanges.length - 1}
                            title="Move Down"
                            className="p-1 hover:bg-gray-200 text-gray-500 rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRange(range.id)}
                            title="Delete"
                            className="p-1 hover:bg-rose-100 text-rose-500 rounded transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isEditingRanges && (
                    <button
                      onClick={handleAddRange}
                      className="w-full py-3 border-2 border-dashed border-gray-205 hover:border-indigo-400 text-gray-400 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <Plus className="w-4 h-4" /> Add Custom Score Range
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl text-indigo-900 text-xs font-medium leading-relaxed mt-6 flex gap-2 border border-indigo-100">
                <BadgeInfo className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <span>Adjust thresholds to align reporting brackets for grade comparisons, bilingual matrices, and academic dashboards across 10,000+ roster sheets. Modifying these ranges will prompt high-fidelity cache recalculation.</span>
              </div>
            </div>

            {/* Right Column: Analytics Status and Calculation Launcher */}
            <div className="space-y-8">
              
              {/* Analytics Status Board */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between h-full min-h-[380px]">
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" /> Analytics Orchestration
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-1">Status Indicator</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${analytics ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse inline-block`} />
                        <h4 className="font-extrabold text-base text-gray-900 leading-none">
                          {analytics ? 'Generated' : 'Not Generated'}
                        </h4>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-1">Cache Timestamp</span>
                      <p className="font-mono text-xs text-gray-700 font-bold bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        {analytics?.updatedAt ? new Date(analytics.updatedAt).toLocaleString() : 'N/A - System Idle'}
                      </p>
                    </div>

                    {isOutOfDate && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-2.5 text-amber-905 text-xs font-bold leading-normal">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <span>Analytics are out of date. Recalculate analytics to apply the new score ranges.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  {!analytics ? (
                    <button
                      onClick={() => handleRecalculate()}
                      disabled={syncing}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
                    >
                      {syncing ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4 fill-white text-white" />}
                      {syncing ? 'Generating cached results...' : 'Calculate Analytics'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRecalculate()}
                      disabled={syncing}
                      className={`w-full py-4 font-extrabold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider text-xs ${isOutOfDate ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                    >
                      {syncing ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />}
                      {syncing ? 'Updating cached entries...' : 'Refresh Analytics'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {analytics && !isOutOfDate && (
            <div className="mt-4 p-8 bg-gradient-to-br from-indigo-50/20 to-emerald-55/20 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-950 text-base">Explore Compiled Intelligence Roster</h4>
                <p className="text-gray-500 text-xs">The analytical reports compiles school-wide rankings, bilingual averages, comparisons, and dropout surveillance maps perfectly aligned with configured ranges.</p>
              </div>
              <button
                onClick={() => setActiveSubTab('overview')}
                className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center gap-2 whitespace-nowrap self-stretch md:self-auto justify-center"
              >
                Go to School Overview <TrendingUp className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: GENERAL SCHOOL PERFORMANCE CARDS AND SUMMARY */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <MetricCard label="Total Students" subLabel="Barattoota Waliigalaa" value={schoolWideStats.totalStudents} icon={Users} color="indigo" />
            <MetricCard label="Male Students" subLabel="Barattoota Dhiira" value={schoolWideStats.totalMale} icon={Users} color="blue" />
            <MetricCard label="Female Students" subLabel="Barattoota Dubartii" value={schoolWideStats.totalFemale} icon={Users} color="rose" />
            <MetricCard label="Total Teachers" subLabel="Barsiisota Waliigalaa" value={schoolWideStats.totalTeachers} icon={Award} color="emerald" />
            <MetricCard label="Total Grades" subLabel="Kutaalee Waliigalaa" value={schoolWideStats.totalGrades} icon={Layers} color="purple" />
            <MetricCard label="Total Sections" subLabel="Daree Barnootaa" value={schoolWideStats.totalSections} icon={Layers} color="amber" />
            <MetricCard label="School Pass Rate" subLabel="Darbiinsa Waliigalaa" value={`${(schoolWideStats?.passRate ?? 0).toFixed(1)}%`} icon={Target} color="emerald" />
            <MetricCard label="Male Pass Rate" subLabel="Dhiira Darbe" value={`${(schoolWideStats?.malePassRate ?? 0).toFixed(1)}%`} icon={Target} color="indigo" />
            <MetricCard label="Female Pass'd" subLabel="Dubartoota Darbe" value={`${(schoolWideStats?.femalePassRate ?? 0).toFixed(1)}%`} icon={Target} color="rose" />
            <MetricCard label="Dropped Out" subLabel="Barnoota Addaan Kutan" value={dropoutAnalysis?.schoolTotal?.total ?? 0} icon={UserMinus} color="red" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Student Performance Distribution */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm xl:col-span-2">
              <h3 className="text-base font-black text-gray-950 uppercase tracking-wide flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-indigo-600" /> General Score Range Distribution
              </h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicDistData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748B', fontWeight: 600, fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: '#F1F5F9', radius: 8 }} />
                    <Bar dataKey="value" fill="#4F46E5" radius={[12, 12, 0, 0]}>
                      {dynamicDistData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#EF4444' : index === 1 ? '#F59E0B' : index === 2 ? '#3B82F6' : '#10B981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Configured Ranges Display / Edit Panel */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-600" /> Active Range Schema
                  </h3>
                  <button 
                    onClick={() => setActiveSubTab('config')}
                    className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1"
                  >
                    Configure Schema ⚙️
                  </button>
                </div>

                <div className="space-y-4">
                  {customRanges.map((range, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                      <div className="flex-grow">
                        <span className="text-[9px] uppercase font-black tracking-widest text-gray-400">Range Label</span>
                        <p className="font-bold text-gray-800 text-xs mt-0.5">{range.label}</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-[9px] uppercase font-black text-gray-400 block pb-0.5">Min Cap</span>
                          <span className="font-black text-xs text-indigo-600">{range.min}%</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-gray-400 block pb-0.5">Max Cap</span>
                          <span className="font-black text-xs text-gray-650">{range.max}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-indigo-50/50 rounded-xl text-indigo-750 text-[11px] font-medium leading-relaxed mt-6 flex gap-2">
                <BadgeInfo className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <span>Custom score ranges are used globally to evaluate academic rosters, bilingual summaries, and grade comparison matrices. Click "Configure Schema" to customize.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UNIVERSAL & GRADE TOP 20 STUDENTS WITH EXCEL & PDF GENERATOR EXPORTS */}
      {activeSubTab === 'rankings' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Universal Top 20 (Published results only) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-50 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Universal Top 20 Students
                </h3>
                <p className="text-xs font-bold text-gray-450 uppercase tracking-widest mt-0.5">Only Published results are evaluated</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportTop25Excel(globalPublishedTop20, "Chercher School Universal Top 20")}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                </button>
                <button 
                  onClick={() => exportTop25PDF(globalPublishedTop20, "School-Wide Top 20")}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                >
                  <FileDown className="w-4 h-4 text-red-500" /> PDF
                </button>
              </div>
            </div>

            <div className="relative">
              <input 
                type="text" 
                placeholder="Search Universal Rank list by Name or ID..." 
                value={schoolRankSearch}
                onChange={(e) => setSchoolRankSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-105 rounded-xl px-4 py-3 placeholder-gray-400 font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="slice-list space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {globalPublishedTop20.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white hover:shadow border border-transparent hover:border-gray-100 transition-all">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx < 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-400'}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm">{s.name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.studentId} • Grade {s.grade}{s.section}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-indigo-600">{(s.average ?? 0).toFixed(1)}%</span>
                    <span className="block text-[8px] uppercase tracking-widest font-black text-gray-300">Merit Avg</span>
                  </div>
                </div>
              ))}
              {globalPublishedTop20.length === 0 && (
                <p className="text-center font-bold text-gray-400 py-10">No matching published results found.</p>
              )}
            </div>
          </div>

          {/* Grade Batch Top 20 (Combines 11A, 11B, 11C...) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-50 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Top Students By Grade Level
                </h3>
                <p className="text-xs font-bold text-gray-450 uppercase tracking-widest mt-0.5">Combines all letter section rosters</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportTop25Excel(batchLevelTop20, `Grade ${selectedBatchGrade} Top 20`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                </button>
                <button 
                  onClick={() => exportTop25PDF(batchLevelTop20, `Grade ${selectedBatchGrade} Top 20`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                >
                  <FileDown className="w-4 h-4 text-red-500" /> PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Grade Level</label>
                <select 
                  className="w-full p-3 bg-gray-50 border border-gray-105 rounded-xl font-bold text-sm outline-none"
                  value={selectedBatchGrade}
                  onChange={(e) => setSelectedBatchGrade(e.target.value)}
                >
                  <option value="All">All Grades (Combined)</option>
                  {distinctGradeLevels.map(lvl => (
                    <option key={lvl} value={lvl}>Grade {lvl}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Filter By Student Name</label>
                <input 
                  type="text" 
                  placeholder="Type student name..." 
                  value={gradeRankSearch}
                  onChange={(e) => setGradeRankSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-105 rounded-xl px-4 py-3 placeholder-gray-400 font-medium text-sm outline-none"
                />
              </div>
            </div>

            <div className="slice-list space-y-3 max-h-[460px] overflow-y-auto pr-2">
              {batchLevelTop20.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white hover:shadow border border-transparent hover:border-gray-100 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-650 flex items-center justify-center font-black text-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm">{s.name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.studentId} • Grade {s.grade}{s.section}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-indigo-600">{(s.average ?? 0).toFixed(1)}%</span>
                    <span className="block text-[8px] uppercase tracking-widest font-black text-gray-300">Merit Avg</span>
                  </div>
                </div>
              ))}
              {batchLevelTop20.length === 0 && (
                <p className="text-center font-bold text-gray-400 py-10">No students found. Filter published grades above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBJECT PERFORMANCE & AVERAGE ANALYSES WITH CUSTOM RANGE MATRICES AND BILINGUAL LABELS */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-8">
          
          {/* Section 1: Dynamic Subject performance Bilingual Grid with responsive cells */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-gray-50 pb-6">
              <div>
                <h3 className="text-lg font-black text-gray-950 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> Bilingual Subject Performance Analysis
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">XALXALA BU’AA BARNOOTA MANA BARUMSAA</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-gray-400">Kutaa</label>
                  <select 
                    value={selectedSubGrade} 
                    onChange={e => setSelectedSubGrade(e.target.value)}
                    className="p-2.5 bg-gray-50 border border-gray-105 rounded-xl font-bold text-xs"
                  >
                    {Array.from(new Set(masterGrades.map(g => g.name))).map(n => (
                      <option key={n} value={n}>Grade {n}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-gray-400">Daree</label>
                  <select 
                    value={selectedSubSection} 
                    onChange={e => setSelectedSubSection(e.target.value)}
                    className="p-2.5 bg-gray-50 border border-gray-105 rounded-xl font-bold text-xs"
                  >
                    {masterGrades.filter(g => g.name === selectedSubGrade).map(g => (
                      <option key={g.id} value={g.section}>Section {g.section}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                  <button 
                    onClick={() => exportSubjectAnalysisExcel(selectedSubGrade, selectedSubSection)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                  </button>
                  <button 
                    onClick={() => exportSubjectAnalysisPDF(selectedSubGrade, selectedSubSection)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-xs font-black uppercase text-gray-600 tracking-wider transition-all"
                  >
                    <FileDown className="w-4 h-4 text-red-500" /> PDF
                  </button>
                </div>
              </div>
            </div>

            {/* School details banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 text-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">School Name / Mana Barumsaa</span>
                <p className="font-extrabold text-indigo-750 text-sm">{config?.schoolName || 'CHERCHER SECONDARY SCHOOL'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Class Metadata / Kutaa & Daree</span>
                <p className="font-bold text-gray-750">Grade {selectedSubGrade} • Section {selectedSubSection}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Class Students / Baayina Baratotaa</span>
                <p className="font-extrabold text-gray-900 text-sm">{classStudents.length} Pupils <span className="text-gray-400 font-medium">({classStudents.filter(s => s.sex === 'M').length} M, {classStudents.filter(s => s.sex === 'F').length} F)</span></p>
              </div>
            </div>

            {classLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-indigo-650 w-10 h-10" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Aggregating Subject matrices dynamically...</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-center text-xs min-w-[800px]">
                  <thead>
                    <tr className="bg-indigo-900 text-white border-b border-indigo-950">
                      <th className="px-4 py-3 text-left border-r border-indigo-950" rowSpan={2}>Subject (Gosa Barnootaa)</th>
                      <th className="px-2 py-3 text-center border-r border-indigo-950" rowSpan={2}>Term (Seem)</th>
                      {customRanges.map((range, idx) => (
                        <th key={idx} className="px-2 py-3 border-r border-indigo-950" colSpan={3}>
                          Range ({range.label})
                        </th>
                      ))}
                      <th className="px-2 py-3 border-indigo-950" colSpan={3}>
                        Average of Subject (Giddugaleessa Gosa Barnootaa)
                      </th>
                    </tr>
                    <tr className="bg-indigo-850 text-indigo-100 border-b border-indigo-950 text-[10px]">
                      {customRanges.map((_, i) => (
                        <React.Fragment key={i}>
                          <th className="px-1 py-2 border-r border-indigo-950">M</th>
                          <th className="px-1 py-1 border-r border-indigo-950">F</th>
                          <th className="px-1 py-1 border-r border-indigo-900 bg-indigo-900/40">Total</th>
                        </React.Fragment>
                      ))}
                      <th className="px-2 py-1 border-r border-indigo-950">Male</th>
                      <th className="px-2 py-1 border-r border-indigo-950">Female</th>
                      <th className="px-2 py-1 bg-indigo-900/40">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const matchedGrade = masterGrades.find(g => g.name === selectedSubGrade && g.section === selectedSubSection);
                      const filteredSubjects = matchedGrade && matchedGrade.subjectIds && matchedGrade.subjectIds.length > 0
                        ? masterSubjects.filter(sub => matchedGrade.subjectIds!.includes(sub.id))
                        : masterSubjects;
                      return filteredSubjects.map(sub => {
                        const subMarks = classMarks.filter(m => m.subjectId === sub.id);
                        
                        const s1Stats = getTermStats(subMarks, 'S1');
                        const s2Stats = getTermStats(subMarks, 'S2');
                        const avgStats = getTermStats(subMarks, 'Avg');

                        const terms = [
                          { label: 'S1 (Seem 1)', stats: s1Stats },
                          { label: 'S2 (Seem 2)', stats: s2Stats },
                          { label: 'Avg (Waliigala)', stats: avgStats }
                        ];

                        return (
                          <React.Fragment key={sub.id}>
                            {terms.map((t, tIdx) => (
                              <tr key={t.label} className="hover:bg-gray-50 transition-colors border-b last:border-b-2">
                                {tIdx === 0 && (
                                  <td className="px-4 py-3 text-left font-black border-r text-gray-900 bg-gray-50/50 align-middle" rowSpan={3}>
                                    {sub.name}
                                  </td>
                                )}
                                <td className="px-2 py-3 text-center border-r text-gray-600 font-bold bg-indigo-50/10 whitespace-nowrap">
                                  {t.label}
                                </td>
                                {customRanges.map((range, rIdx) => {
                                  const rc = t.stats.rangesCount[rIdx];
                                  return (
                                    <React.Fragment key={rIdx}>
                                      <td className="px-2 py-3 text-gray-500 border-r text-[11px]">{rc.male}</td>
                                      <td className="px-2 py-3 text-gray-500 border-r text-[11px]">{rc.female}</td>
                                      <td className="px-2 py-3 font-extrabold text-gray-900 border-r bg-gray-50/30 text-[11px]">{rc.total}</td>
                                    </React.Fragment>
                                  );
                                })}
                                <td className="px-2 py-3 border-r font-bold text-gray-600 text-[11px]">{t.stats.maleAvg !== null ? t.stats.maleAvg.toFixed(1) : '–'}</td>
                                <td className="px-2 py-3 border-r font-bold text-gray-600 text-[11px]">{t.stats.femaleAvg !== null ? t.stats.femaleAvg.toFixed(1) : '–'}</td>
                                <td className="px-2 py-3 font-extrabold text-indigo-900 bg-indigo-50/30 text-[11px]">{t.stats.overallAvg !== null ? t.stats.overallAvg.toFixed(1) : '–'}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Subject Average Analysis details with Dynamic interactive chart */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-gray-950 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-indigo-600" /> Subject Average Insights Builder
                </h3>
                <p className="text-gray-400 font-bold text-xs mt-0.5 uppercase tracking-widest">Select target subject and class records</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Grade (Kutaa)</label>
                  <select 
                    value={avgGrade} 
                    onChange={e => setAvgGrade(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-xs"
                  >
                    {distinctGradeLevels.map(lvl => (
                      <option key={lvl} value={lvl}>Grade {lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Section (Daree)</label>
                  <select 
                    value={avgSection} 
                    onChange={e => setAvgSection(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-xs"
                  >
                    {masterGrades.filter(g => g.name === avgGrade).map(g => (
                      <option key={g.id} value={g.section}>Section {g.section}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Subject (Gosa Barnootaa)</label>
                  <select 
                    value={avgSubject} 
                    onChange={e => setAvgSubject(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-xs"
                  >
                    {(() => {
                      const matchedGrade = masterGrades.find(g => g.name === avgGrade && g.section === avgSection);
                      const filteredSubs = matchedGrade && matchedGrade.subjectIds && matchedGrade.subjectIds.length > 0
                        ? masterSubjects.filter(sub => matchedGrade.subjectIds!.includes(sub.id))
                        : masterSubjects;
                      return filteredSubs.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              {avgStats ? (
                <div className="space-y-6 pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-2xl">
                      <span className="text-[9px] font-black text-indigo-650 uppercase tracking-wider block">Male Average</span>
                      <span className="text-xl font-black text-indigo-700 mt-1 block">{(avgStats.male ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-2xl">
                      <span className="text-[9px] font-black text-rose-650 uppercase tracking-wider block">Female Average</span>
                      <span className="text-xl font-black text-rose-700 mt-1 block">{(avgStats.female ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="bg-gray-50 p-4 border border-gray-100 rounded-2xl">
                      <span className="text-[9px] font-black text-gray-650 tracking-wider uppercase block">Total Average</span>
                      <span className="text-xl font-black text-gray-900 mt-1 block">{(avgStats.total ?? 0).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Interactive progress bar representation */}
                  <div className="space-y-3 bg-gray-50 p-6 rounded-2xl">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-700">
                        <span>Male (Dhiira) Gap Summary</span>
                        <span>{(avgStats.male ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-250 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${avgStats.male ?? 0}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-700">
                        <span>Female (Dubartii) Gap Summary</span>
                        <span>{(avgStats.female ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-250 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: `${avgStats.female ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-10">No scores posted yet matching this subject combo.</p>
              )}
            </div>

            {/* Static Subject Overview charts */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-gray-950 flex items-center gap-2 mb-6">
                  <Target className="w-5 h-5 text-indigo-600" /> Subject Average Visualizer
                </h3>
                <div className="h-64 flex items-center justify-center">
                  {avgStats ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Male (Dhiira)', avg: avgStats.male, color: '#4F46E5' },
                        { name: 'Female (Dubartii)', avg: avgStats.female, color: '#F43F5E' },
                        { name: 'Class Total', avg: avgStats.total, color: '#10B981' }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                          <Cell fill="#4F46E5" />
                          <Cell fill="#F43F5E" />
                          <Cell fill="#10B981" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 font-bold">Chart will appear after variables are resolved above.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GRADE BATCH COMPARISONS & GENDER GAPS ANALYSES */}
      {activeSubTab === 'comparatives' && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Grade Comparison Chart & data table */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-gray-950 flex items-center gap-2 mb-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Grade comparison analysis (Grade 9–12)
                </h3>
                <p className="text-xs text-gray-450 uppercase tracking-widest font-bold">Compares core averages and pass/fail distribution</p>
              </div>

              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(gradeComparison).map(([gr, data]: [string, any]) => ({
                    name: `Grade ${gr}`,
                    avg: data.average,
                    pass: data.passRate,
                    fail: data.failRate
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis label={{ value: '% Ratio / Average', angle: -90, position: 'insideLeft', textAnchor: 'middle', style: {fontWeight: 'bold', fill: '#64748B'} }} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avg" name="Averages (%)" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pass" name="Pass Rate (%)" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparative table */}
              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-center text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-400 uppercase font-black text-[9px] tracking-widest">
                      <th className="px-4 py-3 text-left">Grade level</th>
                      <th className="px-4 py-3">Total Students</th>
                      <th className="px-4 py-3">Combined Avg</th>
                      <th className="px-4 py-3">Pass Rate</th>
                      <th className="px-4 py-3">Fail Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-bold text-gray-700">
                    {Object.entries(gradeComparison).map(([gr, data]: [string, any]) => (
                      <tr key={gr} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-left font-black text-gray-900">Grade {gr}</td>
                        <td className="px-4 py-3">{data.totalStudents} pupils</td>
                        <td className="px-4 py-3 text-indigo-650">{(data.average ?? 0).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-emerald-600">{(data.passRate ?? 0).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-red-500">{(data.failRate ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gender Performance Analysis (Grades and Subject mappings) */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-gray-950 flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-rose-500" /> Gender gap Performance overview
                </h3>
                <p className="text-xs text-gray-450 uppercase tracking-widest font-bold">Male vs Female average performance differences</p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs uppercase tracking-widest font-black text-indigo-700 mb-4">Grade-Wise Gender Gap</h4>
                  <div className="space-y-3">
                    {Object.keys(genderPerformance.grades).map(gr => {
                      const data = genderPerformance.grades[gr];
                      return (
                        <div key={gr} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-sm text-gray-900">Grade {gr}</span>
                            <div className="flex items-center gap-4 text-[10px] text-gray-450 mt-1 font-bold">
                              <span>Male: {(data.maleAverage ?? 0).toFixed(1)}%</span>
                              <span>Female: {(data.femaleAverage ?? 0).toFixed(1)}%</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${(data.difference ?? 0) >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                            {(data.difference ?? 0) >= 0 ? `+${(data.difference ?? 0).toFixed(1)}` : (data.difference ?? 0).toFixed(1)}% M Gap
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-widest font-black text-rose-700 mb-4">Subject-Wise Gender Gap</h4>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                    {Object.keys(genderPerformance.subjects).map(subId => {
                      const d = genderPerformance.subjects[subId];
                      return (
                        <div key={subId} className="p-3 bg-gray-55 rounded-xl border border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-xs text-gray-950 block">{d.subjectName}</span>
                            <span className="text-[10px] text-gray-400 font-bold block mt-0.5">M: {(d.maleAverage ?? 0).toFixed(1)}% • F: {(d.femaleAverage ?? 0).toFixed(1)}%</span>
                          </div>
                          <span className={`text-xs font-black ${(d.difference ?? 0) >= 0 ? 'text-indigo-650' : 'text-rose-600'}`}>
                            {(d.difference ?? 0) >= 0 ? `+${(d.difference ?? 0).toFixed(1)}` : (d.difference ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DECISION SUPPORT RECOMMENDATIONS & COMPREHENSIVE DROPOUT REGISTERS WITH GRADES/SECTION MATRIX */}
      {activeSubTab === 'decision_dropout' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Decision Support Intelligence Summaries */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <BadgeInfo className="w-5 h-5 text-indigo-650" /> Administrative Decision Intelligence Reports
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Automated recommendations for school coordinators</p>
              </div>
              <button 
                onClick={exportDecisionReportExcel}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
              >
                <Download className="w-4 h-4" /> Export Excel Intelligence
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-gray-50 p-6 rounded-3xl border space-y-4">
                <h4 className="text-xs uppercase font-black tracking-widest text-indigo-700">Subject Diagnostics</h4>
                <div className="space-y-3 text-sm font-bold">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">Highest Avg Subject</span>
                    <span className="text-emerald-600 uppercase tracking-wider">{decisionReports.bestPerformingSubjects?.[0]?.subjectName || 'None'} ({decisionReports.bestPerformingSubjects?.[0]?.average?.toFixed(1) ?? '0.0'}%)</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">Lowest Avg Subject</span>
                    <span className="text-rose-600 uppercase tracking-wider">{decisionReports.lowestPerformingSubjects?.[0]?.subjectName || 'None'} ({decisionReports.lowestPerformingSubjects?.[0]?.average?.toFixed(1) ?? '0.0'}%)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium leading-relaxed pt-2">
                    📌 **Insight Intervention Protocol**: Subject {decisionReports.lowestPerformingSubjects?.[0]?.subjectName || 'None'} presents the maximum performance friction. Intervene with tutorial campaigns and teacher-peer guidance programs for this curriculum element.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border space-y-4">
                <h4 className="text-xs uppercase font-black tracking-widest text-purple-700">Grade Batch Diagnostics</h4>
                <div className="space-y-3 text-sm font-bold">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">Highest Performing Batch</span>
                    <span className="text-emerald-600">{decisionReports.bestPerformingGrades?.[0]?.gradeName || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">Lowest Performing Batch</span>
                    <span className="text-rose-600">{decisionReports.lowestPerformingGrades?.[0]?.gradeName || 'None'}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium leading-relaxed pt-2">
                    📌 **Batch Diagnostic Action**: Set up focus groups or allocate extra coaching staff to the {decisionReports.lowestPerformingGrades?.[0]?.gradeName || 'None'} system. High visibility analysis shows they lags behind overall campus velocity.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Dropout Diagnostics and Audits per Grade/Section */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-500" /> Dropout Surveillance & Audit Registry
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Defined as zero scores (Semester 1 = 0 AND Semester 2 = 0) in any subject
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-red-600 block">Total Campus Dropouts</span>
                  <p className="text-4xl font-extrabold text-red-700 mt-2">{(dropoutAnalysis?.schoolTotal?.total ?? 0)} Students</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center mt-6">
                  <div className="bg-white p-3 rounded-xl border border-red-100">
                    <span className="text-[8px] uppercase font-black text-gray-400">Male</span>
                    <p className="font-extrabold text-gray-800 text-sm">{(dropoutAnalysis?.schoolTotal?.male ?? 0)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-red-100">
                    <span className="text-[8px] uppercase font-black text-gray-400">Female</span>
                    <p className="font-extrabold text-gray-800 text-sm">{(dropoutAnalysis?.schoolTotal?.female ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Dropout by Grade level */}
              <div className="bg-white p-6 rounded-3xl border space-y-4">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 block">Dropout Distribution by Grade</span>
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2">
                  {Object.keys(dropoutAnalysis?.byGrade || {}).map(gr => (
                    <div key={gr} className="flex justify-between items-center text-xs font-bold font-mono">
                      <span className="text-gray-600">Grade {gr}</span>
                      <span className="text-red-600">{(dropoutAnalysis?.byGrade?.[gr]?.total ?? 0)} cases <span className="text-gray-400 font-medium">({(dropoutAnalysis?.byGrade?.[gr]?.male ?? 0)}M, {(dropoutAnalysis?.byGrade?.[gr]?.female ?? 0)}F)</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dropout by Section */}
              <div className="bg-white p-6 rounded-3xl border space-y-4">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 block">Dropout Distribution by Section</span>
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2">
                  {Object.keys(dropoutAnalysis?.bySection || {}).map(sec => (
                    <div key={sec} className="flex justify-between items-center text-xs font-semibold font-mono">
                      <span className="text-gray-600">Grade {sec}</span>
                      <span className="text-red-500 font-bold">{(dropoutAnalysis?.bySection?.[sec]?.total ?? 0)} cases <span className="text-gray-400 text-[10px]">({(dropoutAnalysis?.bySection?.[sec]?.male ?? 0)}M, {(dropoutAnalysis?.bySection?.[sec]?.female ?? 0)}F)</span></span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* TAB 6: OFFICIAL COMPREHENSIVE MERIT LISTS ENGINE */}
      {activeSubTab === 'merit_list' && (
        <div className="space-y-8 animate-fade-in text-gray-950">
          {/* Config filters */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="text-xl font-black text-indigo-950 flex items-center gap-2">
                🏆 Official Merit Rank System
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                KOBEE KUTAA GILAALII BU’AA BARATTOOTAA WALTA’AA
              </p>
            </div>

            <button 
              onClick={() => handleRecalculate(false)} 
              disabled={syncing}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Refresh Lists
            </button>
          </div>

          {isLazyLoadingAll ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-gray-50 shadow-sm">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="text-gray-400 font-extrabold text-sm uppercase tracking-widest">Compiling Full Campus Rosters (10,000+)...</p>
            </div>
          ) : (
            <MeritListCalculator 
              students={allStudents} 
              marks={allMarks} 
              grades={masterGrades} 
              subjects={masterSubjects} 
              config={config} 
              exportPDF={exportMeritListPDF} 
            />
          )}
        </div>
      )}

      {/* TAB 7: CAMPUS ATTENDANCE ANALYTICS ENGINE */}
      {activeSubTab === 'attendance_analytics' && (
        <div className="space-y-8 animate-fade-in text-gray-950">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-xl font-black text-indigo-950 flex items-center gap-2">
                📅 Campus Attendance (Hafte) Analytics
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                XALXALA HAWIIDHA HAFFE (ABSENTEEISM REPORT)
              </p>
            </div>
          </div>

          {isLazyLoadingAll ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-gray-50 shadow-sm">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="text-gray-400 font-extrabold text-sm uppercase tracking-widest">Compiling Full Attendance Registers...</p>
            </div>
          ) : (
            <AttendanceAnalyticsSection 
              students={allStudents} 
              grades={masterGrades} 
              config={config} 
              exportPDF={exportAttendancePDF} 
            />
          )}
        </div>
      )}

      {activeSubTab === 'top_students_publish' && (
        <Top5RankingsPublishSection 
          allStudentsRankData={allStudentsRankData} 
        />
      )}

    </div>
  );
};

/* ==============================================
   ADMIN CONTROLLED TOP 5 HONORS BOARD PUBLISHER
   ============================================== */
const Top5RankingsPublishSection: React.FC<{ allStudentsRankData: any[] }> = ({ allStudentsRankData }) => {
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedStudents, setPublishedStudents] = useState<any[]>([]);

  // Fetch current published configuration state from database
  useEffect(() => {
    const fetchCurrentStatus = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfiguration', 'topStudentsRanking'));
        if (snap.exists()) {
          const data = snap.data();
          setIsPublished(data.published || false);
          setPublishedStudents(data.students || []);
        }
      } catch (err) {
        console.error("Failed to read top student state:", err);
      }
    };
    fetchCurrentStatus();
  }, []);

  // Compute live local top 5 students from current active records
  const dynamicTop5 = [...allStudentsRankData]
    .sort((a, b) => b.average - a.average)
    .slice(0, 5)
    .map(s => ({
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      section: s.section,
      average: s.average
    }));

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await setDoc(doc(db, 'systemConfiguration', 'topStudentsRanking'), {
        published: true,
        students: dynamicTop5,
        updatedAt: new Date().toISOString()
      });
      setIsPublished(true);
      setPublishedStudents(dynamicTop5);
      toast.success("Successfully published Top 5 Students to the Student Portal Honors Board!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish rankings.");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await setDoc(doc(db, 'systemConfiguration', 'topStudentsRanking'), {
        published: false,
        students: [],
        updatedAt: new Date().toISOString()
      });
      setIsPublished(false);
      setPublishedStudents([]);
      toast.success("Successfully unpublished / withdrew Top 5 Students from Student Portal.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to withdraw rankings.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-gray-950">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-xl font-black text-indigo-950 flex items-center gap-2">
            🏆 Top Student Ranking Publisher
          </h3>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Admin Controlled Honors Board Publishing Tool
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider border ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            Status: {isPublished ? '🔴 Published Live' : 'Draft / Hidden'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Dynamic live ranks */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h4 className="text-lg font-black text-indigo-950">Dynamic Live Rankings (Top 5)</h4>
            <p className="text-xs text-gray-400 font-medium">Auto-derived from current active entries inside the records database</p>
          </div>

          <div className="divide-y divide-gray-50 border-t border-b border-gray-50">
            {dynamicTop5.length > 0 ? (
              dynamicTop5.map((student, idx) => (
                <div key={student.studentId} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-extrabold text-sm text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{student.studentId} • Grade {student.grade}{student.section}</p>
                    </div>
                  </div>
                  <span className="text-base font-black text-indigo-600">{student.average.toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <p className="text-sm font-bold text-gray-400 py-6 text-center">No student records found to compute ranking.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handlePublish}
              disabled={publishing || dynamicTop5.length === 0}
              className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-755 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-100 transition-all cursor-pointer disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Publish to Student Portal
            </button>
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              className="px-6 py-4 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-gray-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              Unpublish / Withdraw
            </button>
          </div>
        </div>

        {/* Right Column: Currently Published Honors Preview */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h4 className="text-lg font-black text-indigo-950 font-sans">Active Published Preview</h4>
            <p className="text-xs text-gray-400 font-medium">As shown inside the Student Portal Honors Board preview card</p>
          </div>

          {isPublished && publishedStudents.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                {publishedStudents.map((student, idx) => (
                  <div key={student.studentId} className="flex flex-col items-center justify-center p-3 bg-indigo-50/10 rounded-2xl border border-indigo-50 text-center">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center mb-2">
                      {idx + 1}
                    </span>
                    <p className="font-black text-[10px] text-gray-900 line-clamp-1">{student.name}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Gr {student.grade}{student.section}</p>
                    <span className="text-xs font-black text-amber-600 mt-2">{student.average.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-xs font-bold leading-relaxed flex items-center gap-2">
                <span>🏆 The above snapshot is verified and currently active on the main student portal.</span>
              </div>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-3 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
              <Award className="w-12 h-12 text-gray-300" />
              <div>
                <p className="font-extrabold text-sm text-gray-400 uppercase tracking-widest">Honors Board Hidden</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">Student Portal will show "Top Student Ranking Not Yet Published" preview.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   ADVANCED RE-USABLE MERIT ENGINE COMPONENT
   ========================================== */
interface MeritListCalculatorProps {
  students: Student[];
  marks: Mark[];
  grades: Grade[];
  subjects: Subject[];
  config: SchoolConfig | null;
  exportPDF: (title: string, data: any[]) => void;
}

const MeritListCalculator: React.FC<MeritListCalculatorProps> = ({
  students,
  marks,
  grades,
  subjects,
  config,
  exportPDF
}) => {
  const [selectedGradeGroup, setSelectedGradeGroup] = useState('All');
  const [selectedLimit, setSelectedLimit] = useState(10);
  const [filterType, setFilterType] = useState<'overall' | 'boys' | 'girls' | 'by_section' | 'by_grade'>('overall');

  // Compute live ranks client side
  const meritRanks = React.useMemo(() => {
    if (students.length === 0 || marks.length === 0) return [];

    let filtered = students;
    if (selectedGradeGroup !== 'All') {
      filtered = students.filter(s => s.grade === selectedGradeGroup);
    }

    // Map averages using strict assigned grade subject checks
    const computedList = filtered.map(student => {
      const studentMarks = marks.filter(m => m.studentId === student.studentId);
      const studentGradeObj = grades.find(g => g.name === student.grade && g.section === student.section);
      const assignedSubjectIds = studentGradeObj?.subjectIds || [];

      if (assignedSubjectIds.length === 0) return null;

      let scoreSum = 0;
      let matchedCount = 0;

      assignedSubjectIds.forEach(subId => {
        const mk = studentMarks.find(m => m.subjectId === subId);
        if (mk) {
          scoreSum += (mk.semester1 + mk.semester2) / 2;
          matchedCount++;
        }
      });

      const averageScore = matchedCount > 0 ? scoreSum / assignedSubjectIds.length : 0;
      const passThreshold = config?.passMark ?? 50;

      return {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        sex: student.sex,
        grade: student.grade,
        section: student.section,
        score: averageScore,
        passed: averageScore >= passThreshold
      };
    }).filter(Boolean) as any[];

    // Sort descending by averageScore
    const sorted = [...computedList].sort((a, b) => b.score - a.score);

    // Apply Filter Toggles
    if (filterType === 'boys') {
      return sorted.filter(s => s.sex === 'M').slice(0, selectedLimit);
    } else if (filterType === 'girls') {
      return sorted.filter(s => s.sex === 'F').slice(0, selectedLimit);
    } else if (filterType === 'by_section') {
      // Group by section, choose top student from each section
      const map: Record<string, any> = {};
      sorted.forEach(s => {
        const key = `${s.grade}${s.section}`;
        if (!map[key]) map[key] = s;
      });
      return Object.values(map).sort((a, b) => b.score - a.score);
    } else if (filterType === 'by_grade') {
      // Group by grade, choose top student from each grade
      const map: Record<string, any> = {};
      sorted.forEach(s => {
        if (!map[s.grade]) map[s.grade] = s;
      });
      return Object.values(map).sort((a, b) => b.score - a.score);
    } else {
      return sorted.slice(0, selectedLimit);
    }
  }, [students, marks, grades, selectedGradeGroup, selectedLimit, filterType, config]);

  const reportTitle = React.useMemo(() => {
    const scope = selectedGradeGroup === 'All' ? 'School-Wide' : `Grade ${selectedGradeGroup}`;
    const typeLabel = 
      filterType === 'boys' ? 'Top Boys' :
      filterType === 'girls' ? 'Top Girls' :
      filterType === 'by_section' ? 'Top Student per Section' :
      filterType === 'by_grade' ? 'Top Student per Grade' : `Top ${selectedLimit} Overall`;
    return `${scope} Merit Rank List - ${typeLabel}`;
  }, [selectedGradeGroup, selectedLimit, filterType]);

  const exportExcel = () => {
    const dataRows = meritRanks.map((item, idx) => ({
      'Rank': idx + 1,
      'Student ID': item.studentId,
      'Student Name': item.name.toUpperCase(),
      'Gender': item.sex,
      'Grade & Section': `${item.grade} - ${item.section}`,
      'Total Average (%)': parseFloat(item.score.toFixed(2)),
      'Status': item.passed ? 'PASSED' : 'FAILED'
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Merit List');
    XLSX.writeFile(wb, `${reportTitle.replace(/\s+/g, '-')}.xlsx`);
    toast.success('Excel Merit list exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Search filters toolbar */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grade Group</label>
          <select 
            value={selectedGradeGroup} 
            onChange={e => setSelectedGradeGroup(e.target.value)}
            className="w-full p-3.5 bg-gray-50 border border-gray-150 rounded-2xl font-bold text-xs outline-none"
          >
            <option value="All">All Combined Grades</option>
            {Array.from(new Set(grades.map(g => g.name))).map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Limit Rows</label>
          <select 
            value={selectedLimit} 
            onChange={e => setSelectedLimit(Number(e.target.value))}
            className="w-full p-3.5 bg-gray-50 border border-gray-150 rounded-2xl font-bold text-xs outline-none"
          >
            <option value={10}>Top 10 Ranks</option>
            <option value={20}>Top 20 Ranks</option>
            <option value={50}>Top 50 Ranks</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Toggle Ranks</label>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value as any)}
            className="w-full p-3.5 bg-gray-50 border border-gray-150 rounded-2xl font-bold text-xs outline-none"
          >
            <option value="overall">Top Overall Students</option>
            <option value="boys">Top Boys Only</option>
            <option value="girls">Top Girls Only</option>
            <option value="by_section">Top Student per Section</option>
            <option value="by_grade">Top Student per Grade</option>
          </select>
        </div>

        <div className="flex gap-2 items-end">
          <button 
            onClick={exportExcel}
            className="flex-grow p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-emerald-100"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button 
            onClick={() => exportPDF(reportTitle, meritRanks)}
            className="flex-grow p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Ranks Table Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <h4 className="font-extrabold text-indigo-950 text-sm italic">{reportTitle.toUpperCase()}</h4>
          <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Verified records compiled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/50 border-b border-gray-100 text-gray-400 text-[10px] font-black tracking-wider uppercase">
                <th className="px-6 py-4 text-center">Rank</th>
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4 text-center">Gender</th>
                <th className="px-6 py-4 text-center">Grade & Section</th>
                <th className="px-6 py-4 text-right">Composite Average</th>
                <th className="px-6 py-4 text-center">Academic Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {meritRanks.map((item, idx) => (
                <tr key={item.id} className="hover:bg-indigo-50/20 transition-all font-bold">
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      idx === 1 ? 'bg-slate-150 text-gray-700 border border-gray-200' :
                      idx === 2 ? 'bg-orange-100 text-orange-850' : 'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-black text-indigo-600 text-xs">{item.studentId}</td>
                  <td className="px-6 py-4 text-gray-800 uppercase tracking-tight">{item.name}</td>
                  <td className="px-6 py-4 text-center text-xs text-gray-500">{item.sex}</td>
                  <td className="px-6 py-4 text-center text-xs text-gray-600">Grade {item.grade} - {item.section}</td>
                  <td className="px-6 py-4 text-right text-sm text-indigo-950 font-extrabold">{item.score.toFixed(2)}%</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      item.passed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {item.passed ? 'Passed' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
              {meritRanks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">No rankings dataset resolved. Click refresh.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ===================================================
   ADVANCED RE-USABLE ATTENDANCE ANALYTICS COMPONENT
   =================================================== */

interface AttendanceAnalyticsSectionProps {
  students: Student[];
  grades: Grade[];
  config: SchoolConfig | null;
  exportPDF: (title: string, data: any[]) => void;
}

const AttendanceAnalyticsSection: React.FC<AttendanceAnalyticsSectionProps> = ({
  students,
  grades,
  config,
  exportPDF
}) => {
  // Compute analytics locally
  const analyticsData = React.useMemo(() => {
    if (students.length === 0) return null;

    const totalStudents = students.length;
    let totalAbsentDays = 0;
    let maleAbsents = 0;
    let femaleAbsents = 0;
    let maleCount = 0;
    let femaleCount = 0;

    // Brackets
    let bracket0_5 = 0;
    let bracket6_10 = 0;
    let bracket11_15 = 0;
    let bracket16_plus = 0;

    // Grades map
    const gradeAbsentsMap: Record<string, { totalAbs: number; count: number }> = {};

    students.forEach(s => {
      const abs = s.absent ?? 0;
      totalAbsentDays += abs;

      if (s.sex === 'M') {
        maleAbsents += abs;
        maleCount++;
      } else {
        femaleAbsents += abs;
        femaleCount++;
      }

      // Brackets checks
      if (abs <= 5) bracket0_5++;
      else if (abs <= 10) bracket6_10++;
      else if (abs <= 15) bracket11_15++;
      else bracket16_plus++;

      // Grades accumulation
      const grKey = s.grade;
      if (!gradeAbsentsMap[grKey]) {
        gradeAbsentsMap[grKey] = { totalAbs: 0, count: 0 };
      }
      gradeAbsentsMap[grKey].totalAbs += abs;
      gradeAbsentsMap[grKey].count++;
    });

    const avgAbsentDays = totalAbsentDays / totalStudents;
    const attendancePercentage = Math.max(0, Math.min(100, (1 - (avgAbsentDays / 180)) * 100));

    // Compile grade breakdown array
    const gradeBreakdownList = Object.keys(gradeAbsentsMap).map(gr => {
      const item = gradeAbsentsMap[gr];
      const avgAbs = item.totalAbs / item.count;
      const rate = Math.max(0, Math.min(100, (1 - (avgAbs / 180)) * 100));
      return {
        grade: gr,
        avgAbs: parseFloat(avgAbs.toFixed(1)),
        rate: parseFloat(rate.toFixed(1)),
        count: item.count,
        totalAbsents: item.totalAbs
      };
    }).sort((a, b) => b.avgAbs - a.avgAbs); // sorted by worse absence first

    const mostAbsentGrade = gradeBreakdownList.length > 0 ? gradeBreakdownList[0].grade : 'None';
    const leastAbsentGrade = gradeBreakdownList.length > 0 ? gradeBreakdownList[gradeBreakdownList.length - 1].grade : 'None';

    // Roster 10 most absent students list
    const topAbsentStudents = [...students]
      .sort((a, b) => (b.absent ?? 0) - (a.absent ?? 0))
      .slice(0, 10);

    return {
      totalStudents,
      totalAbsentDays,
      avgAbsentDays,
      attendancePercentage,
      maleAvg: maleCount > 0 ? maleAbsents / maleCount : 0,
      femaleAvg: femaleCount > 0 ? femaleAbsents / femaleCount : 0,
      mostAbsentGrade,
      leastAbsentGrade,
      gradeBreakdownList,
      topAbsentStudents,
      bracketData: [
        { name: '0-5 Days Absences', value: bracket0_5, color: '#10B981' },
        { name: '6-10 Days Absences', value: bracket6_10, color: '#3B82F6' },
        { name: '11-15 Days Absences', value: bracket11_15, color: '#F59E0B' },
        { name: '16+ Days Absences', value: bracket16_plus, color: '#EF4444' }
      ]
    };
  }, [students]);

  const handleExportExcel = () => {
    if (!analyticsData) return;
    const records = analyticsData.topAbsentStudents.map((item, idx) => ({
      'S.No': idx + 1,
      'Student ID': item.studentId,
      'Student Name': item.name.toUpperCase(),
      'Gender': item.sex,
      'Grade': item.grade,
      'Section': item.section,
      'Absent Days': item.absent ?? 0,
      'Attendance Rate (%)': parseFloat((100 - ((item.absent ?? 0) / 180 * 100)).toFixed(1))
    }));
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absent Registrars');
    XLSX.writeFile(wb, `Attendance-Absentees-Roster.xlsx`);
    toast.success('Attendance Excel summary compiled successfully!');
  };

  if (!analyticsData) {
    return (
      <div className="p-12 text-center text-gray-400 italic font-bold">
        No campus students data registered. Please populate students and record "Hafte".
      </div>
    );
  }

  return (
    <div className="space-y-8 text-gray-950">
      {/* Cards stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-105 shadow-sm">
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">Total Absent Days Sum</span>
          <p className="text-3xl font-black text-indigo-950 tracking-tight mt-3">{analyticsData.totalAbsentDays} Days</p>
          <span className="text-[9px] text-gray-400 font-bold block mt-1 uppercase">Across entire Chercher census</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-105 shadow-sm">
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">Average Absence Days / Pupil</span>
          <p className="text-3xl font-black text-indigo-650 tracking-tight mt-3">{analyticsData.avgAbsentDays.toFixed(1)} Days</p>
          <span className="text-[9px] text-indigo-400 font-bold block mt-1 uppercase">Average loss of academic velocity</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-105 shadow-sm">
          <span className="text-[10px] uppercase font-black text-emerald-650 tracking-wider block">Attendance Integrity Rate</span>
          <p className="text-3xl font-black text-emerald-600 tracking-tight mt-3">{analyticsData.attendancePercentage.toFixed(1)}%</p>
          <span className="text-[9px] text-emerald-500 font-bold block mt-1 uppercase">Standard 180 calendar days benchmark</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-105 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">Surveillance Grade Extreme</span>
            <div className="flex gap-4 mt-2 font-bold text-xs uppercase">
              <div>
                <span className="text-[8px] text-red-500 block">Lowest</span>
                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">Grade {analyticsData.mostAbsentGrade}</span>
              </div>
              <div className="border-l pl-3">
                <span className="text-[8px] text-emerald-500 block">Highest</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Grade {analyticsData.leastAbsentGrade}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genders averages compares card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="font-extrabold text-sm uppercase text-gray-800 tracking-wide border-b pb-3 mb-4">Gender Attendance Variance</h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100 font-bold text-sm">
              <span className="text-gray-500">Boys (Male Averaged Absences)</span>
              <span className="text-indigo-600">{analyticsData.maleAvg.toFixed(1)} Days</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100 font-bold text-sm">
              <span className="text-gray-500">Girls (Female Averaged Absences)</span>
              <span className="text-rose-600">{analyticsData.femaleAvg.toFixed(1)} Days</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 bg-gray-50/40 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 leading-normal text-center font-semibold">
            📊 **Gender Action Surveillance Summary**: Boys average {analyticsData.maleAvg.toFixed(1)} absent terms compared to girls who average {analyticsData.femaleAvg.toFixed(1)} intervals. Disparities indicate social, agricultural or transport issues. Set up counsel actions to keep students in classroom seats.
          </p>
        </div>
      </div>

      {/* Recharts Analytics distribution visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Distribution brackets pie chart */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400 mb-6">Attendance Brackets Distribution</h4>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.bracketData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analyticsData.bracketData.map((entry, idx) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Students`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-4 text-[10px] font-bold uppercase grid grid-cols-2 gap-2">
            {analyticsData.bracketData.map(bracket => (
              <div key={bracket.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: bracket.color }} />
                <span className="text-gray-600">{bracket.name}: {bracket.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grade attendance line metric */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400 mb-6 font-mono">Absent Days Averages across Grade cohorts</h4>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.gradeBreakdownList}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="grade" tick={{ fill: '#64748b', fontWeight: 600, fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="D" />
                <Tooltip />
                <Area type="monotone" dataKey="avgAbs" stroke="#4f46e5" fill="#e0e7ff" strokeWidth={3.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lists Splitter Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* TOP 10 Absent list */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/55">
            <h4 className="font-extrabold text-indigo-950 text-sm">Top 10 Most Absent Students Registered</h4>
            <div className="flex gap-2">
              <button onClick={handleExportExcel} className="p-2 hover:bg-gray-200.5 text-gray-500 rounded bg-gray-100 border border-gray-200 text-[10px] font-black uppercase">
                Excel
              </button>
              <button 
                onClick={() => exportPDF('Top 10 Most Absent Students', analyticsData.topAbsentStudents)} 
                className="p-2 hover:bg-indigo-700 text-white rounded bg-indigo-600 text-[10px] font-black uppercase"
              >
                PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-100/50 text-gray-405 text-[9px] uppercase tracking-wider font-extrabold border-b border-gray-50">
                  <th className="px-6 py-3 text-center">S.No</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3 text-center">Gender</th>
                  <th className="px-6 py-3 text-center">Grade</th>
                  <th className="px-6 py-3 text-right">Absent Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-xs text-gray-800">
                {analyticsData.topAbsentStudents.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-red-50/20 transition-all">
                    <td className="px-6 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-3 uppercase font-extrabold">{item.name}</td>
                    <td className="px-6 py-3 text-center">{item.sex}</td>
                    <td className="px-6 py-3 text-center">Grade {item.grade}{item.section}</td>
                    <td className="px-6 py-3 text-right font-mono text-red-600 font-extrabold">{item.absent ?? 0} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grade Breakdowns tabular overview */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-gray-50 bg-gray-50/55">
            <h4 className="font-extrabold text-indigo-950 text-sm">Attendance Summary by Grade level</h4>
          </div>

          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-100/50 text-gray-405 text-[9px] uppercase tracking-wider font-extrabold border-b border-gray-50">
                  <th className="px-6 py-3">Grade Level</th>
                  <th className="px-6 py-3 text-center">Total Students</th>
                  <th className="px-6 py-3 text-center">Total Absents</th>
                  <th className="px-6 py-3 text-right">Averaged Absences</th>
                  <th className="px-6 py-3 text-right">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-xs text-gray-800">
                {analyticsData.gradeBreakdownList.map(item => (
                  <tr key={item.grade} className="h-10 hover:bg-indigo-50/10">
                    <td className="px-6 py-3 uppercase font-extrabold">Grade {item.grade}</td>
                    <td className="px-6 py-3 text-center font-mono">{item.count}</td>
                    <td className="px-6 py-3 text-center font-mono">{item.totalAbsents}</td>
                    <td className="px-6 py-3 text-right font-mono">{item.avgAbs.toFixed(1)} Days</td>
                    <td className="px-6 py-3 text-right font-mono text-emerald-600 font-extrabold">{item.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};


// Unified Metric card for clean design
const MetricCard = ({ label, subLabel, value, icon: Icon, color }: { label: string; subLabel: string; value: string | number; icon: any; color: string }) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-105 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest italic">{subLabel}</p>
        </div>
        <div className={`p-2 rounded-xl ${colors[color] || 'bg-gray-50'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-4">{value}</h3>
    </div>
  );
};
