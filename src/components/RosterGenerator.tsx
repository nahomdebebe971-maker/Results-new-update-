import React, { useState, useEffect } from 'react';
import { FileDown, Printer, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Subject, Grade, SchoolConfig } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const RosterGenerator: React.FC<{ config: SchoolConfig | null }> = ({ config }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchGrades = async () => {
      const gSnap = await getDocs(collection(db, 'grades'));
      setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
      const sSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    };
    fetchGrades();
  }, []);

  const fetchRosterData = async () => {
    if (!selectedGrade) return;
    setLoading(true);
    try {
      const [gName, gSec] = [selectedGrade.replace(/[^0-9]/g, ''), selectedGrade.replace(/[0-9]/g, '')];
      const q = query(
        collection(db, 'students'),
        where('grade', '==', gName),
        where('section', '==', gSec)
      );
      const sSnap = await getDocs(q);
      const fetchedStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      
      // Sort alphabetically A-Z by full name (ignoring case and extra spaces)
      fetchedStudents.sort((a, b) => {
        const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
      });

      setStudents(fetchedStudents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!students.length || !config) return;

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
    const studentsPerPage = 6;
    const pages = Math.ceil(students.length / studentsPerPage);

    for (let pIdx = 0; pIdx < pages; pIdx++) {
      if (pIdx > 0) doc.addPage();

      const startIdx = pIdx * studentsPerPage;
      const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);

      const currentGradeObj = grades.find(g => `${g.name}${g.section}` === selectedGrade);

      // --- PAGE HEADER ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(config.schoolName.toUpperCase(), 148, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`ACADEMIC YEAR: ${config.academicYear}`, 15, 25);
      doc.text(`GRADE & SECTION: ${selectedGrade}`, 148, 25, { align: 'center' });
      doc.text(`TOTAL STUDENTS: ${students.length}`, 282, 25, { align: 'right' });
      if (currentGradeObj?.homeroomTeacher) {
        doc.text(`HOMEROOM TEACHER: ${currentGradeObj.homeroomTeacher}`, 15, 30);
      }

      // --- MAIN TABLE ---
      const tableData: any[] = [];
      pageStudents.forEach((s, sIdx) => {
        const actualIdx = startIdx + sIdx + 1;
        
        // Term 1 Row
        const term1Row = [
          { content: actualIdx.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          { content: s.name, rowSpan: 3, styles: { valign: 'middle' } },
          { content: s.sex, rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          { content: s.age.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          'SEM 1'
        ];
        
        // Term 2 Row
        const term2Row = ['SEM 2'];
        
        // Average Row
        const aveRow = ['AVE'];

        subjects.forEach(sub => {
          const res = s.results?.[sub.id]; // Using ID now, wait existing code was names but types said ID?
          // The previous code had subjects.map(s => s.name.slice(0,3)) but results?[sub.name]
          // Let's use name to match existing logic if that's what's stored
          const resBySubject = s.results?.[sub.id] || s.results?.[sub.name];
          
          term1Row.push(resBySubject?.semester1?.toString() || '0');
          term2Row.push(resBySubject?.semester2?.toString() || '0');
          aveRow.push(resBySubject?.average?.toFixed(1) || '0');
        });

        term1Row.push(
          s.semester1?.total.toString() || '0',
          s.semester1?.average.toFixed(1) || '0',
          s.semester1?.rank.toString() || '0',
          s.semester1?.status || 'Pass'
        );

        term2Row.push(
          s.semester2?.total.toString() || '0',
          s.semester2?.average.toFixed(1) || '0',
          s.semester2?.rank.toString() || '0',
          s.semester2?.status || 'Pass'
        );

        aveRow.push(
          s.final?.total.toString() || '0',
          s.final?.average.toFixed(1) || '0',
          s.final?.rank.toString() || '0',
          s.final?.status || 'Pass'
        );

        tableData.push(term1Row, term2Row, aveRow);
      });

      autoTable(doc, {
        startY: 32,
        head: [[
          { content: 'S/N', rowSpan: 2 },
          { content: 'STUDENT NAME', rowSpan: 2 },
          { content: 'SEX', rowSpan: 2 },
          { content: 'AGE', rowSpan: 2 },
          { content: 'TERM', rowSpan: 2 },
          { content: 'SUBJECTS', colSpan: subjects.length, styles: { halign: 'center' } },
          { content: 'RESULT SUMMARY', colSpan: 4, styles: { halign: 'center' } }
        ], [
          ...subjects.map(s => ({ content: s.name.slice(0, 3), styles: { halign: 'center', fontSize: 7 } })),
          'TOT', 'AVG', 'RNK', 'STS'
        ]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.row.index % 3 === 2) { // Average row
             data.cell.styles.fillColor = [252, 252, 252];
             data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // --- FOOTER TABLES ---
      const footerStartY = (doc as any).lastAutoTable.finalY + 10;
      const footerTables = config.rosterFooterTables || [
        { title: 'Registered Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Passed Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Failed Students', fields: ['Male', 'Female', 'Total'] }
      ];

      const tableWidth = 85; 
      footerTables.forEach((ft, i) => {
        const xPos = 15 + (i * (tableWidth + 10));
        if (xPos + tableWidth > 282) return; // Limit to 3 tables per row or adjust

        autoTable(doc, {
          startY: footerStartY,
          margin: { left: xPos },
          tableWidth: tableWidth,
          head: [[{ content: ft.title, styles: { halign: 'center', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }]],
          body: ft.fields.map(f => [f + ': _________________']),
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 }
        });
      });
    }

    doc.save(`Roster_${selectedGrade}_Official.pdf`);
  };

  const exportExcel = async () => {
    if (!students.length || !config) return;

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Official Roster', {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9, // A4
        margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });

    worksheet.views = [{ showGridLines: true }];

    const hTeacher = grades.find(g => `${g.name}${g.section}` === selectedGrade)?.homeroomTeacher || 'N/A';
    const totalColumns = 11 + subjects.length;
    const summaryStartCol = 6 + subjects.length;

    const formatRange = (
      ws: any,
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      style: {
        font?: any;
        alignment?: any;
        fill?: any;
        border?: boolean;
      }
    ) => {
      for (let rIdx = startRow; rIdx <= endRow; rIdx++) {
        const row = ws.getRow(rIdx);
        for (let cIdx = startCol; cIdx <= endCol; cIdx++) {
          const cell = row.getCell(cIdx);
          if (style.font) cell.font = style.font;
          if (style.alignment) cell.alignment = style.alignment;
          if (style.fill) cell.fill = style.fill;
          if (style.border !== false) {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          }
        }
      }
    };

    const colConfigs: any[] = [
      { key: 'sn', width: 6 },
      { key: 'name', width: 26 },
      { key: 'sex', width: 6 },
      { key: 'age', width: 6 },
      { key: 'term', width: 8 }
    ];
    subjects.forEach(() => {
      colConfigs.push({ width: 9 });
    });
    colConfigs.push(
      { key: 'tot', width: 10 },
      { key: 'avg', width: 10 },
      { key: 'rnk', width: 8 },
      { key: 'sts', width: 11 },
      { key: 'cnd', width: 8 },
      { key: 'rmk', width: 15 }
    );
    worksheet.columns = colConfigs;

    const studentsPerPage = 6;
    const totalPages = Math.ceil(students.length / studentsPerPage);

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const startIdx = pIdx * studentsPerPage;
      const r = pIdx * 28 + 1;

      worksheet.mergeCells(r, 1, r, totalColumns);
      const titleCell = worksheet.getCell(r, 1);
      titleCell.value = config.schoolName.toUpperCase();
      worksheet.getRow(r).height = 28;
      formatRange(worksheet, r, 1, r, totalColumns, {
        font: { name: 'Arial', size: 16, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: false
      });

      worksheet.mergeCells(r + 1, 1, r + 1, totalColumns);
      const mottoCell = worksheet.getCell(r + 1, 1);
      mottoCell.value = (config.schoolMotto || 'Official Student Progress Report').toUpperCase();
      worksheet.getRow(r + 1).height = 18;
      formatRange(worksheet, r + 1, 1, r + 1, totalColumns, {
        font: { name: 'Arial', size: 9, italic: true, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: false
      });

      worksheet.mergeCells(r + 2, 1, r + 2, 4);
      worksheet.getCell(r + 2, 1).value = `Kutaa (Grade): ${selectedGrade}`;

      worksheet.mergeCells(r + 2, 5, r + 2, summaryStartCol - 1);
      worksheet.getCell(r + 2, 5).value = `Bara Barnoota (Academic Year): ${config.academicYear}`;

      worksheet.mergeCells(r + 2, summaryStartCol, r + 2, totalColumns);
      worksheet.getCell(r + 2, summaryStartCol).value = `Homeroom Teacher: ${hTeacher}`;

      worksheet.getRow(r + 2).height = 20;
      formatRange(worksheet, r + 2, 1, r + 2, totalColumns, {
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: false
      });

      worksheet.getRow(r + 3).height = 8;

      worksheet.mergeCells(r + 4, 1, r + 5, 1);
      worksheet.getCell(r + 4, 1).value = 'T/L\n(S/N)';

      worksheet.mergeCells(r + 4, 2, r + 5, 2);
      worksheet.getCell(r + 4, 2).value = 'Maqaa Guutuu\n(Full Name)';

      worksheet.mergeCells(r + 4, 3, r + 5, 3);
      worksheet.getCell(r + 4, 3).value = 'Saala\n(Sex)';

      worksheet.mergeCells(r + 4, 4, r + 5, 4);
      worksheet.getCell(r + 4, 4).value = 'Umrii\n(Age)';

      worksheet.mergeCells(r + 4, 5, r + 5, 5);
      worksheet.getCell(r + 4, 5).value = 'Seem\n(Term)';

      worksheet.mergeCells(r + 4, 6, r + 4, 5 + subjects.length);
      worksheet.getCell(r + 4, 6).value = 'Gosa Barnoota (Subject Courses)';

      worksheet.mergeCells(r + 4, summaryStartCol, r + 4, totalColumns);
      worksheet.getCell(r + 4, summaryStartCol).value = 'Academic Results Summary';

      subjects.forEach((sub, subIdx) => {
        worksheet.getCell(r + 5, 6 + subIdx).value = sub.name.toUpperCase();
      });

      worksheet.getCell(r + 5, summaryStartCol).value = 'Ida\'ama\n(Total)';
      worksheet.getCell(r + 5, summaryStartCol + 1).value = 'Averejii\n(Average)';
      worksheet.getCell(r + 5, summaryStartCol + 2).value = 'Sad.\n(Rank)';
      worksheet.getCell(r + 5, summaryStartCol + 3).value = 'G/Hafte\n(Status)';
      worksheet.getCell(r + 5, summaryStartCol + 4).value = 'Amala\n(Conduct)';
      worksheet.getCell(r + 5, summaryStartCol + 5).value = 'Yaada\n(Remarks)';

      worksheet.getRow(r + 4).height = 24;
      worksheet.getRow(r + 5).height = 24;

      formatRange(worksheet, r + 4, 1, r + 5, totalColumns, {
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF2FE' } }
      });

      for (let sIdx = 0; sIdx < studentsPerPage; sIdx++) {
        const studentIdx = startIdx + sIdx;
        const s = students[studentIdx];
        const sr = r + 6 + sIdx * 3;

        worksheet.getRow(sr).height = 19;
        worksheet.getRow(sr + 1).height = 19;
        worksheet.getRow(sr + 2).height = 19;

        worksheet.mergeCells(sr, 1, sr + 2, 1);
        worksheet.mergeCells(sr, 2, sr + 2, 2);
        worksheet.mergeCells(sr, 3, sr + 2, 3);
        worksheet.mergeCells(sr, 4, sr + 2, 4);
        worksheet.mergeCells(sr, summaryStartCol + 4, sr + 2, summaryStartCol + 4);
        worksheet.mergeCells(sr, summaryStartCol + 5, sr + 2, summaryStartCol + 5);

        worksheet.getCell(sr, 5).value = '1ffaa';
        worksheet.getCell(sr + 1, 5).value = '2ffaa';
        worksheet.getCell(sr + 2, 5).value = 'Ave';

        formatRange(worksheet, sr, 1, sr + 2, totalColumns, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle' }
        });

        formatRange(worksheet, sr + 2, 5, sr + 2, totalColumns - 2, {
          font: { name: 'Arial', size: 9, bold: true },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        });

        if (s) {
          worksheet.getCell(sr, 1).value = studentIdx + 1;
          worksheet.getCell(sr, 1).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, 2).value = s.name;
          worksheet.getCell(sr, 2).font = { name: 'Arial', size: 10, bold: true };
          worksheet.getCell(sr, 2).alignment = { horizontal: 'left', vertical: 'middle' };

          worksheet.getCell(sr, 3).value = s.sex;
          worksheet.getCell(sr, 4).value = s.age;

          subjects.forEach((sub, subIdx) => {
            const res = s.results?.[sub.id] || s.results?.[sub.name];
            worksheet.getCell(sr, 6 + subIdx).value = res?.semester1 ?? 0;
            worksheet.getCell(sr + 1, 6 + subIdx).value = res?.semester2 ?? 0;
            worksheet.getCell(sr + 2, 6 + subIdx).value = Number(res?.average?.toFixed(1) || 0);
          });

          worksheet.getCell(sr, summaryStartCol).value = s.semester1?.total ?? 0;
          worksheet.getCell(sr + 1, summaryStartCol).value = s.semester2?.total ?? 0;
          worksheet.getCell(sr + 2, summaryStartCol).value = s.final?.total ?? 0;
          worksheet.getCell(sr + 2, summaryStartCol).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, summaryStartCol + 1).value = Number(s.semester1?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 1, summaryStartCol + 1).value = Number(s.semester2?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 2, summaryStartCol + 1).value = Number(s.final?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 2, summaryStartCol + 1).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, summaryStartCol + 2).value = s.semester1?.rank ?? '-';
          worksheet.getCell(sr + 1, summaryStartCol + 2).value = s.semester2?.rank ?? '-';
          worksheet.getCell(sr + 2, summaryStartCol + 2).value = s.final?.rank ?? '-';
          worksheet.getCell(sr + 2, summaryStartCol + 2).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, summaryStartCol + 3).value = s.semester1?.status || 'Pass';
          worksheet.getCell(sr + 1, summaryStartCol + 3).value = s.semester2?.status || 'Pass';
          worksheet.getCell(sr + 2, summaryStartCol + 3).value = s.final?.status || 'Pass';
          worksheet.getCell(sr + 2, summaryStartCol + 3).font = { name: 'Arial', size: 9, bold: true };
          
          worksheet.getCell(sr, summaryStartCol + 4).value = '';
          worksheet.getCell(sr, summaryStartCol + 5).value = '';
        } else {
          worksheet.getCell(sr, 1).value = '';
          worksheet.getCell(sr, 2).value = '';
          worksheet.getCell(sr, 3).value = '';
          worksheet.getCell(sr, 4).value = '';
          
          subjects.forEach((_, subIdx) => {
            worksheet.getCell(sr, 6 + subIdx).value = '';
            worksheet.getCell(sr + 1, 6 + subIdx).value = '';
            worksheet.getCell(sr + 2, 6 + subIdx).value = '';
          });

          worksheet.getCell(sr, summaryStartCol).value = '';
          worksheet.getCell(sr + 1, summaryStartCol).value = '';
          worksheet.getCell(sr + 2, summaryStartCol).value = '';

          worksheet.getCell(sr, summaryStartCol + 1).value = '';
          worksheet.getCell(sr + 1, summaryStartCol + 1).value = '';
          worksheet.getCell(sr + 2, summaryStartCol + 1).value = '';

          worksheet.getCell(sr, summaryStartCol + 2).value = '';
          worksheet.getCell(sr + 1, summaryStartCol + 2).value = '';
          worksheet.getCell(sr + 2, summaryStartCol + 2).value = '';

          worksheet.getCell(sr, summaryStartCol + 3).value = '';
          worksheet.getCell(sr + 1, summaryStartCol + 3).value = '';
          worksheet.getCell(sr + 2, summaryStartCol + 3).value = '';

          worksheet.getCell(sr, summaryStartCol + 4).value = '';
          worksheet.getCell(sr, summaryStartCol + 5).value = '';
        }
      }

      const footerTables = config.rosterFooterTables || [
        { title: 'Registered Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Passed Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Failed Students', fields: ['Male', 'Female', 'Total'] }
      ];

      worksheet.getRow(r + 24).height = 18;
      worksheet.getRow(r + 25).height = 18;
      worksheet.getRow(r + 26).height = 20;

      let startCol = 2;
      footerTables.forEach((ft) => {
        const colCount = ft.fields.length;

        worksheet.mergeCells(r + 24, startCol, r + 24, startCol + colCount - 1);
        worksheet.getCell(r + 24, startCol).value = ft.title;

        formatRange(worksheet, r + 24, startCol, r + 24, startCol + colCount - 1, {
          font: { name: 'Arial', size: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
        });

        ft.fields.forEach((f, fidx) => {
          const fieldCol = startCol + fidx;

          const fCell = worksheet.getCell(r + 25, fieldCol);
          fCell.value = f;

          const bCell = worksheet.getCell(r + 26, fieldCol);
          bCell.value = '';

          formatRange(worksheet, r + 25, fieldCol, r + 26, fieldCol, {
            font: { name: 'Arial', size: 8, bold: true },
            alignment: { horizontal: 'center', vertical: 'middle' }
          });

          fCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });

        startCol += colCount + 2;
      });

      if (pIdx < totalPages - 1) {
        worksheet.getRow(r + 27).pageBreak = true;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Roster_${selectedGrade}_Official_Roster.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Grade for Roster</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
          >
            <option value="">Select Grade</option>
            {grades.map(g => (
              <option key={g.id} value={`${g.name}${g.section}`}>{g.name}{g.section}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={fetchRosterData}
          disabled={!selectedGrade || loading}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate Roster'}
        </button>
      </div>

      {students.length > 0 && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-900">Official Roster: {selectedGrade}</h3>
            <div className="flex gap-3">
              <button onClick={exportExcel} className="flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold border border-gray-100 hover:bg-gray-100 transition-all">
                <FileDown className="w-4 h-4" /> Export Excel
              </button>
              <button onClick={exportPDF} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
                <Printer className="w-4 h-4" /> Print PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400">S/N</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400">Full Name</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Sex</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Age</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 font-bold uppercase text-gray-400 text-center">Sem</th>
                  <th colSpan={subjects.length} className="p-2 border-b border-r border-gray-200 text-center font-bold uppercase text-gray-400">Subjects</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 text-center font-bold uppercase text-gray-400">Total</th>
                  <th rowSpan={2} className="p-2 border-r border-gray-200 text-center font-bold uppercase text-gray-400">Avg</th>
                  <th rowSpan={2} className="p-2 text-center font-bold uppercase text-gray-400">Rank</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {subjects.map(s => (
                    <th key={s.id} className="p-1 border-r border-gray-200 text-center font-bold text-[10px] text-gray-500">{s.name.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-gray-50/50">
                      <td rowSpan={3} className="p-2 border-r border-gray-200 font-bold text-center">{idx + 1}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 font-bold text-gray-900">{s.name}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 text-center">{s.sex}</td>
                      <td rowSpan={3} className="p-2 border-r border-gray-200 text-center">{s.age}</td>
                      <td className="p-1 border-r border-gray-200 text-[10px] font-bold text-gray-500">1st</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center font-medium">
                          {s.results?.[sub.id]?.semester1 || s.results?.[sub.name]?.semester1 || 0}
                        </td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester1?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester1?.average.toFixed(1)}</td>
                      <td className="p-1 text-center font-bold">{s.semester1?.rank}</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="p-1 border-r border-gray-200 text-[10px] font-bold text-gray-500">2nd</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center font-medium">
                          {s.results?.[sub.id]?.semester2 || s.results?.[sub.name]?.semester2 || 0}
                        </td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester2?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center font-bold">{s.semester2?.average.toFixed(1)}</td>
                      <td className="p-1 text-center font-bold">{s.semester2?.rank}</td>
                    </tr>
                    <tr className="bg-gray-50/30 hover:bg-gray-50/50 font-black">
                      <td className="p-1 border-r border-gray-200 text-[10px] uppercase">Ave</td>
                      {subjects.map(sub => (
                        <td key={sub.id} className="p-1 border-r border-gray-200 text-center">
                          {s.results?.[sub.id]?.average.toFixed(1) || s.results?.[sub.name]?.average.toFixed(1) || 0}
                        </td>
                      ))}
                      <td className="p-1 border-r border-gray-200 text-center border-t border-gray-200">{s.final?.total}</td>
                      <td className="p-1 border-r border-gray-200 text-center border-t border-gray-200">{s.final?.average.toFixed(1)}</td>
                      <td className="p-1 text-center border-t border-gray-200">{s.final?.rank}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
