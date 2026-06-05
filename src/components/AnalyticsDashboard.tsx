import React, { useState, useEffect } from 'react';
import { 
  Loader2, TrendingUp, Users, Award, Target, BookOpen, 
  Settings, Download, FileSpreadsheet, FileDown, 
  Filter, ShieldAlert, BadgeInfo, RefreshCw, Layers, Edit3, Save, UserMinus,
  Trash2, Plus, ArrowUp, ArrowDown, ShieldCheck, AlertTriangle, Play
} from 'lucide-react';
import { getAnalytics, calculateAndSaveAnalytics } from '../services/analyticsService';
import { SchoolAnalytics, Student, Mark, Grade, Subject, SchoolConfig } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line 
} from 'recharts';

export const AnalyticsDashboard: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'overview' | 'rankings' | 'subjects' | 'comparatives' | 'decision_dropout'>('config');

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

    masterSubjects.forEach(sub => {
      const subMarks = classMarks.filter(m => m.subjectId === sub.id);
      const rowData: any = { Subject: sub.name };

      customRanges.forEach(range => {
        const matchingMarks = subMarks.filter(m => {
          const score = (m.semester1 + m.semester2) / 2;
          return score >= range.min && score <= range.max;
        });

        const maleCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'M').length;
        const femaleCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'F').length;

        rowData[`${range.label} Male`] = maleCount;
        rowData[`${range.label} Female`] = femaleCount;
        rowData[`${range.label} Total`] = matchingMarks.length;
      });

      // Averages
      const maleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'M');
      const femaleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'F');

      const maleS = maleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
      const femaleS = femaleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
      const overallS = subMarks.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);

      rowData['Avg Male'] = maleTotals.length > 0 ? (maleS / maleTotals.length).toFixed(1) : '–';
      rowData['Avg Female'] = femaleTotals.length > 0 ? (femaleS / femaleTotals.length).toFixed(1) : '–';
      rowData['Avg Total'] = subMarks.length > 0 ? (overallS / subMarks.length).toFixed(1) : '–';

      matrixRows.push(rowData);
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
    const mainHeaderColspan = 1 + (customRanges.length * 3) + 3;
    const firstRowHeader = ['Subject (Gosa Barnootaa)'];
    customRanges.forEach(r => {
      firstRowHeader.push(r.label, '', '');
    });
    firstRowHeader.push('Average of Subject (Giddugaleessa Gosa Barnootaa)', '', '');

    const secondRowHeader = [''];
    customRanges.forEach(() => {
      secondRowHeader.push('M', 'F', 'T');
    });
    secondRowHeader.push('Male', 'Female', 'Total');

    const bodyRows = masterSubjects.map(sub => {
      const subMarks = classMarks.filter(m => m.subjectId === sub.id);
      const rCells: any[] = [sub.name];

      customRanges.forEach(range => {
        const matchingMarks = subMarks.filter(m => {
          const score = (m.semester1 + m.semester2) / 2;
          return score >= range.min && score <= range.max;
        });

        const maleCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'M').length;
        const femaleCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'F').length;

        rCells.push(maleCount, femaleCount, matchingMarks.length);
      });

      // Averages
      const maleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'M');
      const femaleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'F');

      const maleS = maleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
      const femaleS = femaleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
      const overallS = subMarks.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);

      rCells.push(
        maleTotals.length > 0 ? (maleS / maleTotals.length).toFixed(1) : '–',
        femaleTotals.length > 0 ? (femaleS / femaleTotals.length).toFixed(1) : '–',
        subMarks.length > 0 ? (overallS / subMarks.length).toFixed(1) : '–'
      );

      return rCells;
    });

    autoTable(doc, {
      head: [firstRowHeader, secondRowHeader],
      body: bodyRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
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
                    {masterSubjects.map(sub => {
                      const subMarks = classMarks.filter(m => m.subjectId === sub.id);
                      
                      const maleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'M');
                      const femaleTotals = subMarks.filter(m => classStudents.find(x => x.studentId === m.studentId)?.sex === 'F');

                      const maleS = maleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
                      const femaleS = femaleTotals.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);
                      const overallS = subMarks.reduce((a, b) => a + (b.semester1 + b.semester2) / 2, 0);

                      return (
                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-left font-black border-r text-gray-900">{sub.name}</td>
                          {customRanges.map((range, rIdx) => {
                            const matchingMarks = subMarks.filter(m => {
                              const score = (m.semester1 + m.semester2) / 2;
                              return score >= range.min && score <= range.max;
                            });

                            const mCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'M').length;
                            const fCount = matchingMarks.filter(m => classStudents.find(s => s.studentId === m.studentId)?.sex === 'F').length;

                            return (
                              <React.Fragment key={rIdx}>
                                <td className="px-1 py-3 text-gray-500 border-r">{mCount}</td>
                                <td className="px-1 py-3 text-gray-500 border-r">{fCount}</td>
                                <td className="px-1 py-3 font-extrabold text-gray-900 border-r bg-gray-50/50">{matchingMarks.length}</td>
                              </React.Fragment>
                            );
                          })}
                          <td className="px-2 py-3 border-r font-bold text-gray-600">{maleTotals.length > 0 ? (maleS / maleTotals.length).toFixed(1) : '–'}</td>
                          <td className="px-2 py-3 border-r font-bold text-gray-600">{femaleTotals.length > 0 ? (femaleS / femaleTotals.length).toFixed(1) : '–'}</td>
                          <td className="px-2 py-3 font-extrabold text-indigo-650 bg-indigo-50/30">{subMarks.length > 0 ? (overallS / subMarks.length).toFixed(1) : '–'}</td>
                        </tr>
                      );
                    })}
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
                    {masterSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
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
