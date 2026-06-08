import React, { useState, useEffect } from 'react';
import { FileDown, Printer, Loader2, Award, Users, BookOpen, GraduationCap } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Subject, Grade, SchoolConfig } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Resilient gender checker
export const isMaleGender = (sex: string): boolean => {
  const s = sex?.trim().toUpperCase() || 'M';
  return s.startsWith('M') || s.startsWith('DHI');
};

// Check for dropout status (where Semester 1 = 0 AND Semester 2 = 0 for at least one subject)
export const isStudentDropout = (s: Student, subjectsList: Subject[]): boolean => {
  if (!subjectsList || subjectsList.length === 0 || !s.results) return false;
  return subjectsList.some(sub => {
    const res = s.results?.[sub.id] || s.results?.[sub.name];
    if (res === undefined) return false;
    const s1 = res.semester1 ?? 0;
    const s2 = res.semester2 ?? 0;
    return s1 === 0 && s2 === 0;
  });
};

// Helper to translate status beautifully in Oromo
export const getTranslatedStatus = (s: Student, sem: 'sem1' | 'sem2' | 'final', subjectsList: Subject[], passMark: number): string => {
  if (isStudentDropout(s, subjectsList)) {
    return 'Addaan Kute'; // Dropout
  }
  let status = 'Pass';
  if (sem === 'sem1') {
    status = s.semester1?.status || (s.semester1 && s.semester1.average >= passMark ? 'Pass' : 'Fail') || 'Pass';
  } else if (sem === 'sem2') {
    status = s.semester2?.status || (s.semester2 && s.semester2.average >= passMark ? 'Pass' : 'Fail') || 'Pass';
  } else {
    status = s.final?.status || (s.final && s.final.average >= passMark ? 'Pass' : 'Fail') || 'Pass';
  }
  
  const norm = status?.trim().toUpperCase();
  if (norm === 'PASS' || norm === 'DARBE' || norm === 'DARBEE') return 'Darbe';
  if (norm === 'FAIL' || norm === 'KUFE' || norm === 'KUFEE') return 'Kufe';
  if (norm === 'DROPOUT' || norm === 'ADDAAN KUTE' || norm === 'ADDAAN KUTAAN') return 'Addaan Kute';
  return status;
};

export const generateRosterPDF = (students: Student[], subjects: Subject[], config: SchoolConfig, selectedGrade: string, grades: Grade[]) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
  const studentsPerPage = 6;
  const pages = Math.ceil(students.length / studentsPerPage);
  const passMark = config.passMark || 50;

  for (let pIdx = 0; pIdx < pages; pIdx++) {
    if (pIdx > 0) doc.addPage();

    const startIdx = pIdx * studentsPerPage;
    const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);
    const currentGradeObj = grades.find(g => `${g.name}${g.section}` === selectedGrade);

    // --- PAGE HEADER ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(27, 38, 59);
    doc.text(config.schoolName.toUpperCase(), 148, 14, { align: 'center' });
    
    doc.setFontSize(8.5);
    doc.setTextColor(80, 90, 100);
    doc.text(`BARA BARNOOTAA (ACADEMIC YEAR): ${config.academicYear}`, 15, 23);
    doc.text(`KUTAA & DAMEE (GRADE & SECTION): ${selectedGrade}`, 148, 23, { align: 'center' });
    doc.text(`WAL-IDA'AMA BARATOOTA (TOTAL GRADE STUDENTS): ${students.length}`, 282, 23, { align: 'right' });
    
    if (currentGradeObj?.homeroomTeacher) {
      doc.text(`BARSIISAA GORSAA (HOMEROOM TEACHER): ${currentGradeObj.homeroomTeacher}`, 15, 28);
    }

    // --- COMPACTED CORE RESULTS TABLE ---
    const tableData: any[] = [];
    pageStudents.forEach((s, idx) => {
      const actualIdx = startIdx + idx + 1;
      const s1Status = getTranslatedStatus(s, 'sem1', subjects, passMark);
      const s2Status = getTranslatedStatus(s, 'sem2', subjects, passMark);
      const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

      // Term 1 Row (using clean Oromo term descriptions '1ffaa2ffaaAve')
      const term1Row: any[] = [
        { content: actualIdx.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
        { content: s.name, rowSpan: 3, styles: { valign: 'middle', fontStyle: 'bold' } },
        { content: isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii', rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
        { content: (s.age || 0).toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
        { content: '1ffaa' }
      ];

      const term2Row = ['2ffaa'];
      const aveRow = ['Ave'];

      // Subjects scores
      subjects.forEach(sub => {
        const mark = s.results?.[sub.id] || s.results?.[sub.name];
        
        term1Row.push(mark?.semester1 !== undefined ? mark.semester1.toString() : '-');
        term2Row.push(mark?.semester2 !== undefined ? mark.semester2.toString() : '-');
        aveRow.push(mark?.average !== undefined ? mark.average.toFixed(1) : '-');
      });

      // Roster Summaries (IDA, AVE, SAD, G/H, conduct, absence)
      term1Row.push(
        s.semester1?.total.toString() || '0',
        s.semester1?.average?.toFixed(1) || '0',
        s.semester1?.rank.toString() || '0',
        s1Status,
        { content: s.conduct || 'A', rowSpan: 3, styles: { valign: 'middle' as const, halign: 'center' as const, fontStyle: 'bold' as const } },
        { content: (s.absent ?? 0).toString(), rowSpan: 3, styles: { valign: 'middle' as const, halign: 'center' as const, fontStyle: 'bold' as const } }
      );

      term2Row.push(
        s.semester2?.total.toString() || '0',
        s.semester2?.average?.toFixed(1) || '0',
        s.semester2?.rank.toString() || '0',
        s2Status
      );

      aveRow.push(
        (s.semester1 && s.semester2 ? ((s.semester1.total + s.semester2.total)/2).toFixed(1) : s.final?.total?.toFixed(1) || '0'),
        s.final?.average?.toFixed(1) || '0',
        s.final?.rank.toString() || '0',
        finalStatus
      );

      tableData.push(term1Row, term2Row, aveRow);
    });

    autoTable(doc, {
      startY: 31,
      head: [[
        { content: 'T/L\n(S/N)', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'MAQAA GUUTUU\n(STUDENT FULL NAME)', rowSpan: 2, styles: { valign: 'middle' as const } },
        { content: 'SAALA\n(SEX)', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'UMRII\n(AGE)', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'SEEM\n(TERM)', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'GOSA BARNOOTAA (SUBJECT COURSES)', colSpan: subjects.length, styles: { halign: 'center' as const } },
        { content: 'WALIIGALA BARNOOTAA (ACADEMIC RESULTS SUMMARY)', colSpan: 6, styles: { halign: 'center' as const } }
      ], [
        ...subjects.map(s => ({ content: s.name.toUpperCase().slice(0, 3), styles: { halign: 'center' as const, fontSize: 6.8 } })),
        'IDA', 'AVE', 'SAD', 'G/H', 'AMALA', 'HAFTE'
      ]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [27, 38, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.row.index % 3 === 2) { // Average row
           data.cell.styles.fillColor = [252, 252, 252];
           data.cell.styles.fontStyle = 'bold';
        }
        // Highlight status
        if (data.column.index === (5 + subjects.length + 3)) {
          const rawText = data.cell.text[0];
          if (rawText === 'Darbe') {
            data.cell.styles.textColor = [34, 139, 34]; // green
          } else if (rawText === 'Kufe') {
            data.cell.styles.textColor = [220, 20, 60]; // crimson
          } else if (rawText === 'Addaan Kute') {
            data.cell.styles.textColor = [230, 90, 30]; // orange
          }
        }
      }
    });

    // --- EXCLUSIVE 4 STATISTICS TABLES FOOTER ---
    let regM = 0, regF = 0, regT = 0;
    let passM = 0, passF = 0, passT = 0;
    let failM = 0, failF = 0, failT = 0;
    let dropM = 0, dropF = 0, dropT = 0;

    pageStudents.forEach(s => {
      const isMale = isMaleGender(s.sex);
      const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

      if (isMale) {
        regM++;
        if (finalStatus === 'Addaan Kute') dropM++;
        else if (finalStatus === 'Darbe') passM++;
        else failM++;
      } else {
        regF++;
        if (finalStatus === 'Addaan Kute') dropF++;
        else if (finalStatus === 'Darbe') passF++;
        else failF++;
      }
    });
    regT = regM + regF;
    passT = passM + passF;
    failT = failM + failF;
    dropT = dropM + dropF;

    // Render 4 Dynamic Oromo Tables side-by-side
    const footerStartY = (doc as any).lastAutoTable.finalY + 6;
    const tWidth = 58;
    const gap = 8;

    const footerData = [
      { title: "Barattoota Galma'an\n(Registered Students)", m: regM, f: regF, t: regT },
      { title: "Barattoota Darban\n(Passed Students)", m: passM, f: passF, t: passT },
      { title: "Barattoota Kufan\n(Failed Students)", m: failM, f: failF, t: failT },
      { title: "Barattoota Addaan Kutan\n(Dropout Students)", m: dropM, f: dropF, t: dropT }
    ];

    footerData.forEach((ft, i) => {
      const xPos = 15 + i * (tWidth + gap);
      if (xPos + tWidth > 285) return;

      autoTable(doc, {
        startY: footerStartY,
        margin: { left: xPos },
        tableWidth: tWidth,
        head: [
          [{ content: ft.title, colSpan: 3, styles: { halign: 'center', fillColor: [240, 243, 246], textColor: [27, 38, 59], fontStyle: 'bold', fontSize: 7, cellPadding: 1 } }],
          [
            { content: 'Dhiira\n(Male)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } },
            { content: 'Dubartii\n(Female)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } },
            { content: 'Ida\'ama\n(Total)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } }
          ]
        ],
        body: [
          [
            { content: ft.m.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', textColor: [27, 38, 59] } },
            { content: ft.f.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', textColor: [27, 38, 59] } },
            { content: ft.t.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', fillColor: [248, 249, 250], textColor: [27, 38, 59] } }
          ]
        ],
        theme: 'grid',
        styles: { cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 }
      });
    });
  }

  doc.save(`Roster_${selectedGrade}_Official.pdf`);
};

export const generateRosterExcel = async (students: Student[], subjects: Subject[], config: SchoolConfig, selectedGrade: string, grades: Grade[]) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Official Roster', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
      fitToPage: true,
      fitToWidth: 1,
    }
  });

  const studentsPerPage = 6;
  const totalPages = Math.ceil(students.length / studentsPerPage);
  const hTeacher = grades.find(g => `${g.name}${g.section}` === selectedGrade)?.homeroomTeacher || 'N/A';
  const passMark = config.passMark || 50;

  // Utility to style ranges easily in code
  const formatRange = (ws: any, r1: number, c1: number, r2: number, c2: number, styles: any) => {
    for (let ri = r1; ri <= r2; ri++) {
      for (let ci = c1; ci <= c2; ci++) {
        const cell = ws.getCell(ri, ci);
        if (styles.font) cell.font = styles.font;
        if (styles.alignment) cell.alignment = styles.alignment;
        if (styles.fill) cell.fill = styles.fill;
        if (styles.border) cell.border = styles.border;
      }
    }
  };

  const totalColumns = 11 + subjects.length;

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const startIdx = pIdx * studentsPerPage;
    const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);
    const r = pIdx * 30 + 1; // page offset rows

    // Header Title
    worksheet.mergeCells(r, 1, r, totalColumns);
    const titleCell = worksheet.getCell(r, 1);
    titleCell.value = `${config.schoolName.toUpperCase()} - OFFICIAL ACADEMIC ROSTER`;
    formatRange(worksheet, r, 1, r, totalColumns, {
      font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1B263B' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });
    worksheet.getRow(r).height = 25;

    // Sub-header stats row
    worksheet.mergeCells(r + 1, 1, r + 1, totalColumns);
    const subTitleCell = worksheet.getCell(r + 1, 1);
    subTitleCell.value = `ACADEMIC YEAR: ${config.academicYear}   |   GRADE & SECTION: ${selectedGrade}   |   HOMEROOM TEACHER: ${hTeacher}   |   TOTAL GRADE STUDENTS: ${students.length}`;
    formatRange(worksheet, r + 1, 1, r + 1, totalColumns, {
      font: { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4F5A64' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });
    worksheet.getRow(r + 1).height = 18;

    // Primary Complex headers setup
    worksheet.getRow(r + 3).height = 22;
    worksheet.getRow(r + 4).height = 22;

    // Merge static columns
    const staticColPairs = [
      { col: 1, label: 'T/L (S/N)' },
      { col: 2, label: 'MAQAA GUUTUU (STUDENT FULL NAME)' },
      { col: 3, label: 'SAALA (SEX)' },
      { col: 4, label: 'UMRII (AGE)' },
      { col: 5, label: 'SEEM (TERM)' }
    ];

    staticColPairs.forEach(pair => {
      worksheet.mergeCells(r + 3, pair.col, r + 4, pair.col);
      const cell = worksheet.getCell(r + 3, pair.col);
      cell.value = pair.label;
    });

    // Subjects Grouped Header
    const subjectsStartCol = 6;
    const subjectsEndCol = 5 + subjects.length;
    worksheet.mergeCells(r + 3, subjectsStartCol, r + 3, subjectsEndCol);
    worksheet.getCell(r + 3, subjectsStartCol).value = 'GOSA BARNOOTAA (SUBJECT COURSES)';

    subjects.forEach((sub, sidx) => {
      worksheet.getCell(r + 4, subjectsStartCol + sidx).value = sub.name.toUpperCase().slice(0, 3);
    });

    // Academic Summaries Grouped Header
    const summaryStartCol = subjectsEndCol + 1;
    worksheet.mergeCells(r + 3, summaryStartCol, r + 3, summaryStartCol + 3);
    worksheet.getCell(r + 3, summaryStartCol).value = 'WALIIGALA BARNOOTAA (ACADEMIC RESULTS SUMMARY)';

    const summaryLabels = ['IDA (TOT)', 'AVE (AVG)', 'SAD (RNK)', 'G/H (ST)', 'AMALA (CON)', 'HAFTE (ABS)'];
    summaryLabels.forEach((label, lidx) => {
      if (lidx < 4) {
        worksheet.getCell(r + 4, summaryStartCol + lidx).value = label;
      } else {
        // AMALA and HAFTE spans all three sub-rows
        worksheet.mergeCells(r + 3, summaryStartCol + lidx, r + 4, summaryStartCol + lidx);
        worksheet.getCell(r + 3, summaryStartCol + lidx).value = label;
      }
    });

    formatRange(worksheet, r + 3, 1, r + 4, totalColumns, {
      font: { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B263B' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    });

    // Fill Page Students rows
    pageStudents.forEach((s, sidx) => {
      const sr = r + 5 + sidx * 3; // Student row start (each has 3 sub-rows)
      const actualIdx = startIdx + sidx + 1;

      formatRange(worksheet, sr, 1, sr + 2, totalColumns, {
        font: { name: 'Arial', size: 8.5 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        }
      });

      // Horizontal Row spans for student details
      worksheet.mergeCells(sr, 1, sr + 2, 1);
      worksheet.getCell(sr, 1).value = actualIdx;

      worksheet.mergeCells(sr, 2, sr + 2, 2);
      worksheet.getCell(sr, 2).value = s.name;
      worksheet.getCell(sr, 2).alignment = { horizontal: 'left', vertical: 'middle' };

      worksheet.mergeCells(sr, 3, sr + 2, 3);
      worksheet.getCell(sr, 3).value = isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii';

      worksheet.mergeCells(sr, 4, sr + 2, 4);
      worksheet.getCell(sr, 4).value = s.age || 0;

      // Uniquely style average sub-row background color
      formatRange(worksheet, sr + 2, 1, sr + 2, totalColumns, {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      });

      // Semester Terms labels
      worksheet.getCell(sr, 5).value = '1ffaa';
      worksheet.getCell(sr + 1, 5).value = '2ffaa';
      worksheet.getCell(sr + 2, 5).value = 'Ave';

      // Fill Subject scores
      subjects.forEach((sub, subIdx) => {
        const mark = s.results?.[sub.id] || s.results?.[sub.name];
        worksheet.getCell(sr, subjectsStartCol + subIdx).value = mark?.semester1 !== undefined ? mark.semester1 : '-';
        worksheet.getCell(sr + 1, subjectsStartCol + subIdx).value = mark?.semester2 !== undefined ? mark.semester2 : '-';
        worksheet.getCell(sr + 2, subjectsStartCol + subIdx).value = mark?.average !== undefined ? Number(mark.average.toFixed(1)) : '-';
      });

      // Fill Summaries
      worksheet.getCell(sr, summaryStartCol).value = s.semester1?.total ?? 0;
      worksheet.getCell(sr + 1, summaryStartCol).value = s.semester2?.total ?? 0;
      worksheet.getCell(sr + 2, summaryStartCol).value = (s.semester1 && s.semester2) ? Number(((s.semester1.total + s.semester2.total) / 2).toFixed(1)) : (s.final?.total ?? 0);

      worksheet.getCell(sr, summaryStartCol + 1).value = Number(s.semester1?.average?.toFixed(1) || 0);
      worksheet.getCell(sr + 1, summaryStartCol + 1).value = Number(s.semester2?.average?.toFixed(1) || 0);
      worksheet.getCell(sr + 2, summaryStartCol + 1).value = Number(s.final?.average?.toFixed(1) || 0);

      worksheet.getCell(sr, summaryStartCol + 2).value = s.semester1?.rank ?? '-';
      worksheet.getCell(sr + 1, summaryStartCol + 2).value = s.semester2?.rank ?? '-';
      worksheet.getCell(sr + 2, summaryStartCol + 2).value = s.final?.rank ?? '-';

      const s1Stat = getTranslatedStatus(s, 'sem1', subjects, passMark);
      const s2Stat = getTranslatedStatus(s, 'sem2', subjects, passMark);
      const fStat = getTranslatedStatus(s, 'final', subjects, passMark);

      worksheet.getCell(sr, summaryStartCol + 3).value = s1Stat;
      worksheet.getCell(sr + 1, summaryStartCol + 3).value = s2Stat;
      worksheet.getCell(sr + 2, summaryStartCol + 3).value = fStat;

      // AMALA Conduct is row-spanned across 3 rows
      worksheet.mergeCells(sr, summaryStartCol + 4, sr + 2, summaryStartCol + 4);
      worksheet.getCell(sr, summaryStartCol + 4).value = s.conduct || 'A';

      // HAFTE Absents is row-spanned across 3 rows
      worksheet.mergeCells(sr, summaryStartCol + 5, sr + 2, summaryStartCol + 5);
      worksheet.getCell(sr, summaryStartCol + 5).value = s.absent ?? 0;
    });

    // Write Page Roster footer tables
    let regM = 0, regF = 0, regT = 0;
    let passM = 0, passF = 0, passT = 0;
    let failM = 0, failF = 0, failT = 0;
    let dropM = 0, dropF = 0, dropT = 0;

    pageStudents.forEach(s => {
      const isMale = isMaleGender(s.sex);
      const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

      if (isMale) {
        regM++;
        if (finalStatus === 'Addaan Kute') dropM++;
        else if (finalStatus === 'Darbe') passM++;
        else failM++;
      } else {
        regF++;
        if (finalStatus === 'Addaan Kute') dropF++;
        else if (finalStatus === 'Darbe') passF++;
        else failF++;
      }
    });
    regT = regM + regF;
    passT = passM + passF;
    failT = failM + failF;
    dropT = dropM + dropF;

    const pageFooterData = [
      { title: "Barattoota Galma'an\n(Registered Students)", m: regM, f: regF, t: regT },
      { title: "Barattoota Darban\n(Passed Students)", m: passM, f: passF, t: passT },
      { title: "Barattoota Kufan\n(Failed Students)", m: failM, f: failF, t: failT },
      { title: "Barattoota Addaan Kutan\n(Dropout Students)", m: dropM, f: dropF, t: dropT }
    ];

    worksheet.getRow(r + 24).height = 24;
    worksheet.getRow(r + 25).height = 18;
    worksheet.getRow(r + 26).height = 20;

    let startCol = 2;
    pageFooterData.forEach((ft) => {
      const colCount = 3;

      worksheet.mergeCells(r + 24, startCol, r + 24, startCol + colCount - 1);
      const cell = worksheet.getCell(r + 24, startCol);
      cell.value = ft.title;

      formatRange(worksheet, r + 24, startCol, r + 24, startCol + colCount - 1, {
        font: { name: 'Arial', size: 8, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      });

      const fields = [
        { label: 'Dhiira (M)', val: ft.m },
        { label: 'Dubartii (F)', val: ft.f },
        { label: 'Waliigala (T)', val: ft.t }
      ];

      fields.forEach((f, fidx) => {
        const fieldCol = startCol + fidx;

        const fCell = worksheet.getCell(r + 25, fieldCol);
        fCell.value = f.label;

        const bCell = worksheet.getCell(r + 26, fieldCol);
        bCell.value = f.val;
      });

      formatRange(worksheet, r + 24, startCol, r + 26, startCol + colCount - 1, {
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        font: { name: 'Arial', size: 8 }
      });

      // Special highlight for values
      formatRange(worksheet, r + 26, startCol, r + 26, startCol + colCount - 1, {
        font: { name: 'Arial', size: 9, bold: true }
      });

      startCol += colCount + 1; // plus gap col
    });

    if (pIdx < totalPages - 1) {
      if (worksheet.getRow(r + 27)) {
        worksheet.getRow(r + 27).addPageBreak();
      }
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
      const fetchedStudents = sSnap.docs.map(d => {
        const data = d.data();
        let needsUpdate = false;
        const conduct = data.conduct !== undefined ? data.conduct : (needsUpdate = true, 'A');
        const absent = data.absent !== undefined ? data.absent : (needsUpdate = true, 0);
        
        if (needsUpdate) {
          import('firebase/firestore').then(({ doc, updateDoc }) => {
            updateDoc(doc(db, 'students', d.id), { conduct, absent }).catch(err => 
              console.error('Error migrating student:', d.id, err)
            );
          });
        }
        
        return {
          id: d.id,
          ...data,
          conduct,
          absent
        } as Student;
      });
      
      // Sort alphabetically A-Z by full student name
      fetchedStudents.sort((a, b) => {
        const nameA = a.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameB = b.name.trim().replace(/\s+/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
      });

      setStudents(fetchedStudents);
    } catch (err) {
      console.error("Error retrieving roster students:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!students.length || !config) return;

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
    const studentsPerPage = 6;
    const pages = Math.ceil(students.length / studentsPerPage);
    const passMark = config.passMark || 50;

    for (let pIdx = 0; pIdx < pages; pIdx++) {
      if (pIdx > 0) doc.addPage();

      const startIdx = pIdx * studentsPerPage;
      const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);
      const currentGradeObj = grades.find(g => `${g.name}${g.section}` === selectedGrade);

      // --- PAGE HEADER ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(27, 38, 59);
      doc.text(config.schoolName.toUpperCase(), 148, 14, { align: 'center' });
      
      doc.setFontSize(8.5);
      doc.setTextColor(80, 90, 100);
      doc.text(`BARA BARNOOTAA (ACADEMIC YEAR): ${config.academicYear}`, 15, 23);
      doc.text(`KUTAA & DAMEE (GRADE & SECTION): ${selectedGrade}`, 148, 23, { align: 'center' });
      doc.text(`WAL-IDA'AMA BARATOOTA (TOTAL GRADE STUDENTS): ${students.length}`, 282, 23, { align: 'right' });
      
      if (currentGradeObj?.homeroomTeacher) {
        doc.text(`BARSIISAA GORSAA (HOMEROOM TEACHER): ${currentGradeObj.homeroomTeacher}`, 15, 28);
      }

      // --- MAIN TABLE ---
      const tableData: any[] = [];
      pageStudents.forEach((s, sIdx) => {
        const actualIdx = startIdx + sIdx + 1;
        
        // Localized statuses based on Oromo rules
        const s1Status = getTranslatedStatus(s, 'sem1', subjects, passMark);
        const s2Status = getTranslatedStatus(s, 'sem2', subjects, passMark);
        const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

        // Term 1 Row (using clean Oromo term descriptions '1ffaa2ffaaAve')
        const term1Row: any[] = [
          { content: actualIdx.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          { content: s.name, rowSpan: 3, styles: { valign: 'middle', fontStyle: 'bold' } },
          { content: isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii', rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          { content: s.age.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
          '1ffaa'
        ];
        
        // Term 2 Row
        const term2Row = ['2ffaa'];
        
        // Average Row
        const aveRow = ['Ave'];

        subjects.forEach(sub => {
          const res = s.results?.[sub.id] || s.results?.[sub.name];
          term1Row.push(res?.semester1?.toString() || '0');
          term2Row.push(res?.semester2?.toString() || '0');
          aveRow.push(res?.average?.toFixed(1) || '0');
        });

        term1Row.push(
          s.semester1?.total.toString() || '0',
          s.semester1?.average?.toFixed(1) || '0',
          s.semester1?.rank.toString() || '0',
          s1Status,
          { content: s.conduct || 'A', rowSpan: 3, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } },
          { content: (s.absent ?? 0).toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } }
        );

        term2Row.push(
          s.semester2?.total.toString() || '0',
          s.semester2?.average?.toFixed(1) || '0',
          s.semester2?.rank.toString() || '0',
          s2Status
        );

        aveRow.push(
          (s.semester1 && s.semester2 ? ((s.semester1.total + s.semester2.total)/2).toFixed(1) : s.final?.total?.toFixed(1) || '0'),
          s.final?.average?.toFixed(1) || '0',
          s.final?.rank.toString() || '0',
          finalStatus
        );

        tableData.push(term1Row, term2Row, aveRow);
      });

      autoTable(doc, {
        startY: 31,
        head: [[
          { content: 'T/L\n(S/N)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'MAQAA GUUTUU\n(STUDENT FULL NAME)', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'SAALA\n(SEX)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'UMRII\n(AGE)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'SEEM\n(TERM)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'GOSA BARNOOTAA (SUBJECT COURSES)', colSpan: subjects.length, styles: { halign: 'center' } },
          { content: 'WALIIGALA BARNOOTAA (ACADEMIC RESULTS SUMMARY)', colSpan: 6, styles: { halign: 'center' } }
        ], [
          ...subjects.map(s => ({ content: s.name.toUpperCase().slice(0, 3), styles: { halign: 'center', fontSize: 6.8 } })),
          'IDA', 'AVE', 'SAD', 'G/H', 'AMALA', 'HAFTE'
        ]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [27, 38, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.row.index % 3 === 2) { // Average row
             data.cell.styles.fillColor = [252, 252, 252];
             data.cell.styles.fontStyle = 'bold';
          }
          // Highlight status
          if (data.column.index === (5 + subjects.length + 3)) {
            const rawText = data.cell.text[0];
            if (rawText === 'Darbe') {
              data.cell.styles.textColor = [34, 139, 34]; // green
            } else if (rawText === 'Kufe') {
              data.cell.styles.textColor = [220, 20, 60]; // crimson
            } else if (rawText === 'Addaan Kute') {
              data.cell.styles.textColor = [230, 90, 30]; // orange
            }
          }
        }
      });

      // --- PAGE-BASED DYNAMIC CALCULATIONS ---
      let regM = 0, regF = 0, regT = 0;
      let passM = 0, passF = 0, passT = 0;
      let failM = 0, failF = 0, failT = 0;
      let dropM = 0, dropF = 0, dropT = 0;

      pageStudents.forEach(s => {
        const isMale = isMaleGender(s.sex);
        const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

        if (isMale) {
          regM++;
          if (finalStatus === 'Addaan Kute') dropM++;
          else if (finalStatus === 'Darbe') passM++;
          else failM++;
        } else {
          regF++;
          if (finalStatus === 'Addaan Kute') dropF++;
          else if (finalStatus === 'Darbe') passF++;
          else failF++;
        }
      });
      regT = regM + regF;
      passT = passM + passF;
      failT = failM + failF;
      dropT = dropM + dropF;

      // Render 4 Dynamic Oromo Tables side-by-side
      const footerStartY = (doc as any).lastAutoTable.finalY + 6;
      const tWidth = 58;
      const gap = 8;

      const footerData = [
        { title: "Barattoota Galma'an\n(Registered Students)", m: regM, f: regF, t: regT },
        { title: "Barattoota Darban\n(Passed Students)", m: passM, f: passF, t: passT },
        { title: "Barattoota Kufan\n(Failed Students)", m: failM, f: failF, t: failT },
        { title: "Barattoota Addaan Kutan\n(Dropout Students)", m: dropM, f: dropF, t: dropT }
      ];

      footerData.forEach((ft, i) => {
        const xPos = 15 + i * (tWidth + gap);
        if (xPos + tWidth > 285) return;

        autoTable(doc, {
          startY: footerStartY,
          margin: { left: xPos },
          tableWidth: tWidth,
          head: [
            [{ content: ft.title, colSpan: 3, styles: { halign: 'center', fillColor: [240, 243, 246], textColor: [27, 38, 59], fontStyle: 'bold', fontSize: 7, cellPadding: 1 } }],
            [
              { content: 'Dhiira\n(Male)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } },
              { content: 'Dubartii\n(Female)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } },
              { content: 'Ida\'ama\n(Total)', styles: { halign: 'center', fontSize: 6.5, fillColor: [255, 255, 255], textColor: [27, 38, 59], fontStyle: 'bold' } }
            ]
          ],
          body: [
            [
              { content: ft.m.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', textColor: [27, 38, 59] } },
              { content: ft.f.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', textColor: [27, 38, 59] } },
              { content: ft.t.toString(), styles: { halign: 'center', fontSize: 8, fontStyle: 'bold', fillColor: [248, 249, 250], textColor: [27, 38, 59] } }
            ]
          ],
          theme: 'grid',
          styles: { cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 }
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
    const passMark = config.passMark || 50;

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
      const pageStudents = students.slice(startIdx, startIdx + studentsPerPage);
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
          // Calculate actual statuses
          const s1Stat = getTranslatedStatus(s, 'sem1', subjects, passMark);
          const s2Stat = getTranslatedStatus(s, 'sem2', subjects, passMark);
          const fStat = getTranslatedStatus(s, 'final', subjects, passMark);

          worksheet.getCell(sr, 1).value = studentIdx + 1;
          worksheet.getCell(sr, 1).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, 2).value = s.name;
          worksheet.getCell(sr, 2).font = { name: 'Arial', size: 10, bold: true };
          worksheet.getCell(sr, 2).alignment = { horizontal: 'left', vertical: 'middle' };

          worksheet.getCell(sr, 3).value = isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii';
          worksheet.getCell(sr, 4).value = s.age;

          subjects.forEach((sub, subIdx) => {
            const res = s.results?.[sub.id] || s.results?.[sub.name];
            worksheet.getCell(sr, 6 + subIdx).value = res?.semester1 ?? 0;
            worksheet.getCell(sr + 1, 6 + subIdx).value = res?.semester2 ?? 0;
            worksheet.getCell(sr + 2, 6 + subIdx).value = Number(res?.average?.toFixed(1) || 0);
          });

          worksheet.getCell(sr, summaryStartCol).value = s.semester1?.total ?? 0;
          worksheet.getCell(sr + 1, summaryStartCol).value = s.semester2?.total ?? 0;
          worksheet.getCell(sr + 2, summaryStartCol).value = (s.semester1 && s.semester2) ? Number(((s.semester1.total + s.semester2.total) / 2).toFixed(1)) : (s.final?.total ?? 0);
          worksheet.getCell(sr + 2, summaryStartCol).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, summaryStartCol + 1).value = Number(s.semester1?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 1, summaryStartCol + 1).value = Number(s.semester2?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 2, summaryStartCol + 1).value = Number(s.final?.average?.toFixed(1) || 0);
          worksheet.getCell(sr + 2, summaryStartCol + 1).font = { name: 'Arial', size: 9, bold: true };

          worksheet.getCell(sr, summaryStartCol + 2).value = s.semester1?.rank ?? '-';
          worksheet.getCell(sr + 1, summaryStartCol + 2).value = s.semester2?.rank ?? '-';
          worksheet.getCell(sr + 2, summaryStartCol + 2).value = s.final?.rank ?? '-';
          worksheet.getCell(sr + 2, summaryStartCol + 2).font = { name: 'Arial', size: 9, bold: true };

          // Use the dynamic bilingual Oromo statuses in cells
          worksheet.getCell(sr, summaryStartCol + 3).value = s1Stat;
          worksheet.getCell(sr + 1, summaryStartCol + 3).value = s2Stat;
          worksheet.getCell(sr + 2, summaryStartCol + 3).value = fStat;
          worksheet.getCell(sr + 2, summaryStartCol + 3).font = { name: 'Arial', size: 9, bold: true };
          
          worksheet.getCell(sr, summaryStartCol + 4).value = s.conduct || 'A';
          worksheet.getCell(sr, summaryStartCol + 5).value = s.absent !== undefined ? `${s.absent} Guyyaa` : '0 Guyyaa';
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

      // --- PAGE-SPECIFIC EXCEL CALCULATIONS ---
      let regM = 0; let regF = 0; let regT = 0;
      let passM = 0; let passF = 0; let passT = 0;
      let failM = 0; let failF = 0; let failT = 0;
      let dropM = 0; let dropF = 0; let dropT = 0;

      pageStudents.forEach(s => {
        const isMale = isMaleGender(s.sex);
        const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

        if (isMale) {
          regM++;
          if (finalStatus === 'Addaan Kute') dropM++;
          else if (finalStatus === 'Darbe') passM++;
          else failM++;
        } else {
          regF++;
          if (finalStatus === 'Addaan Kute') dropF++;
          else if (finalStatus === 'Darbe') passF++;
          else failF++;
        }
      });
      regT = regM + regF;
      passT = passM + passF;
      failT = failM + failF;
      dropT = dropM + dropF;

      const pageFooterData = [
        { title: "Barattoota Galma'an\n(Registered Students)", m: regM, f: regF, t: regT },
        { title: "Barattoota Darban\n(Passed Students)", m: passM, f: passF, t: passT },
        { title: "Barattoota Kufan\n(Failed Students)", m: failM, f: failF, t: failT },
        { title: "Barattoota Addaan Kutan\n(Dropout Students)", m: dropM, f: dropF, t: dropT }
      ];

      worksheet.getRow(r + 24).height = 24;
      worksheet.getRow(r + 25).height = 18;
      worksheet.getRow(r + 26).height = 20;

      let startCol = 2;
      pageFooterData.forEach((ft) => {
        const colCount = 3;

        worksheet.mergeCells(r + 24, startCol, r + 24, startCol + colCount - 1);
        const cell = worksheet.getCell(r + 24, startCol);
        cell.value = ft.title;

        formatRange(worksheet, r + 24, startCol, r + 24, startCol + colCount - 1, {
          font: { name: 'Arial', size: 8, bold: true },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
        });

        const fields = [
          { label: 'Dhiira (M)', val: ft.m },
          { label: 'Dubartii (F)', val: ft.f },
          { label: 'Waliigala (T)', val: ft.t }
        ];

        fields.forEach((f, fidx) => {
          const fieldCol = startCol + fidx;

          const fCell = worksheet.getCell(r + 25, fieldCol);
          fCell.value = f.label;

          const bCell = worksheet.getCell(r + 26, fieldCol);
          bCell.value = f.val;

          formatRange(worksheet, r + 25, fieldCol, r + 26, fieldCol, {
            font: { name: 'Arial', size: 8, bold: true },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
          });

          fCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });

        startCol += colCount + 1; // gap column
      });

      if (pIdx < totalPages - 1) {
        worksheet.getRow(r + 27).addPageBreak();
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
      {/* Top Filter Selection Row */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Grade & Section for Roster</label>
          <select 
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-gray-700"
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
          className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 text-sm uppercase tracking-wider shadow-lg shadow-indigo-100"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Load Roster'}
        </button>
      </div>

      {students.length > 0 && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Bar */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded">Grade Roster Loaded</span>
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">Official Roster: {selectedGrade}</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Consistency Guaranteed • Sorted Alphabetically A-Z by Full Student Name</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={exportExcel} className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-5 py-3 rounded-xl text-xs uppercase tracking-wider font-bold border border-gray-100 hover:bg-gray-100 transition-all">
                <FileDown className="w-4 h-4" /> Export Excel
              </button>
              <button onClick={exportPDF} className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl text-xs uppercase tracking-wider font-bold shadow-md hover:bg-indigo-700 transition-all">
                <Printer className="w-4 h-4" /> Print PDF
              </button>
            </div>
          </div>

          {/* Page-by-Page Stacked Layout Preview */}
          <div className="space-y-12">
            {Array.from({ length: Math.ceil(students.length / 6) }).map((_, pIdx) => {
              const startIdx = pIdx * 6;
              const pageStudents = students.slice(startIdx, startIdx + 6);
              const passMark = config?.passMark || 50;

              // Page counts for this page alone
              let regM = 0, regF = 0, regT = 0;
              let passM = 0, passF = 0, passT = 0;
              let failM = 0, failF = 0, failT = 0;
              let dropM = 0, dropF = 0, dropT = 0;

              pageStudents.forEach(s => {
                const isMale = isMaleGender(s.sex);
                const finalStatus = getTranslatedStatus(s, 'final', subjects, passMark);

                if (isMale) {
                  regM++;
                  if (finalStatus === 'Addaan Kute') dropM++;
                  else if (finalStatus === 'Darbe') passM++;
                  else failM++;
                } else {
                  regF++;
                  if (finalStatus === 'Addaan Kute') dropF++;
                  else if (finalStatus === 'Darbe') passF++;
                  else failF++;
                }
              });
              regT = regM + regF;
              passT = passM + passF;
              failT = failM + failF;
              dropT = dropM + dropF;

              return (
                <div key={pIdx} className="bg-white p-6 sm:p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6 relative">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
                      <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest">
                        Roster Page {pIdx + 1} of {Math.ceil(students.length / 6)}
                      </h4>
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      Students {startIdx + 1} - {startIdx + pageStudents.length}
                    </span>
                  </div>

                  {/* Table Element for the Page */}
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th rowSpan={2} className="p-3 border-r border-gray-200 font-bold uppercase text-gray-400 text-center w-12">T/L (S/N)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 font-bold uppercase text-gray-400">Maqaa Guutuu (Full Name)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 font-bold uppercase text-gray-400 text-center w-24">Saala (Sex)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 font-bold uppercase text-gray-400 text-center w-16">Umrii (Age)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 font-bold uppercase text-gray-400 text-center w-20">Sem</th>
                          <th colSpan={subjects.length} className="p-3 border-b border-r border-gray-200 text-center font-bold uppercase text-gray-400">Gosa Barnoota (Subjects)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 text-center font-bold uppercase text-gray-400 w-24">Ida (Tot)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 text-center font-bold uppercase text-gray-400 w-24">Ave</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 text-center font-bold uppercase text-gray-400 w-16">Sad (Rnk)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 text-center font-bold uppercase text-gray-400 w-32">G/H (Sts)</th>
                          <th rowSpan={2} className="p-3 border-r border-gray-200 text-center font-bold uppercase text-gray-400 w-24">Conduct (Amala)</th>
                          <th rowSpan={2} className="p-3 text-center font-bold uppercase text-gray-400 w-24">Absent (Hafte)</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {subjects.map(s => (
                            <th key={s.id} className="p-2 border-r border-gray-200 text-center font-bold text-[10px] text-gray-500">{s.name.slice(0,3).toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pageStudents.map((s, idx) => {
                          const actualNumber = startIdx + idx + 1;
                          const s1Stat = getTranslatedStatus(s, 'sem1', subjects, passMark);
                          const s2Stat = getTranslatedStatus(s, 'sem2', subjects, passMark);
                          const finalStat = getTranslatedStatus(s, 'final', subjects, passMark);

                          const statColor = (status: string) => {
                            if (status === 'Darbe') return 'text-green-600 font-bold';
                            if (status === 'Kufe') return 'text-red-500 font-bold';
                            return 'text-orange-600 font-bold'; // Dropout
                          };

                          return (
                            <React.Fragment key={s.id}>
                              <tr className="hover:bg-gray-50/50">
                                <td rowSpan={3} className="p-3 border-r border-gray-200 font-mono font-bold text-center text-gray-600 bg-gray-50/20">{actualNumber}</td>
                                <td rowSpan={3} className="p-3 border-r border-gray-200 font-black text-gray-900 text-sm">{s.name}</td>
                                <td rowSpan={3} className="p-3 border-r border-gray-200 text-center font-medium">{isMaleGender(s.sex) ? 'Dhiira' : 'Dubartii'}</td>
                                <td rowSpan={3} className="p-3 border-r border-gray-200 text-center font-mono">{s.age}</td>
                                <td className="p-2 border-r border-gray-200 text-center text-[10px] font-black text-gray-400 uppercase bg-gray-50/5">1ffaa</td>
                                {subjects.map(sub => (
                                  <td key={sub.id} className="p-2 border-r border-gray-200 text-center font-mono font-bold text-gray-600 bg-gray-50/5">
                                    {s.results?.[sub.id]?.semester1 || s.results?.[sub.name]?.semester1 || 0}
                                  </td>
                                ))}
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold">{s.semester1?.total}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold">{s.semester1?.average?.toFixed(1) ?? '0.0'}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold bg-indigo-50/10 text-indigo-700">#{s.semester1?.rank}</td>
                                <td className={`p-2 border-r border-gray-200 text-center text-[11px] ${statColor(s1Stat)}`}>{s1Stat}</td>
                                <td rowSpan={3} className="p-3 border-r border-gray-200 text-center font-bold bg-gray-50/10 text-gray-800">{s.conduct || 'A'}</td>
                                <td rowSpan={3} className="p-3 text-center font-mono font-bold bg-gray-50/10 text-gray-800">{s.absent ?? 0}</td>
                              </tr>
                              <tr className="hover:bg-gray-50/50">
                                <td className="p-2 border-r border-gray-200 text-center text-[10px] font-black text-gray-400 uppercase bg-gray-50/5">2ffaa</td>
                                {subjects.map(sub => (
                                  <td key={sub.id} className="p-2 border-r border-gray-200 text-center font-mono font-bold text-gray-600 bg-gray-50/5">
                                    {s.results?.[sub.id]?.semester2 || s.results?.[sub.name]?.semester2 || 0}
                                  </td>
                                ))}
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold">{s.semester2?.total}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold">{s.semester2?.average?.toFixed(1) ?? '0.0'}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-bold bg-indigo-50/10 text-indigo-700">#{s.semester2?.rank}</td>
                                <td className={`p-2 border-r border-gray-200 text-center text-[11px] ${statColor(s2Stat)}`}>{s2Stat}</td>
                              </tr>
                              <tr className="bg-gray-50/30 hover:bg-gray-50/50">
                                <td className="p-2 border-r border-gray-200 text-center text-[10px] font-black text-gray-800 uppercase bg-gray-100/30">Ave</td>
                                {subjects.map(sub => (
                                  <td key={sub.id} className="p-2 border-r border-gray-200 text-center font-mono font-black text-gray-800 bg-gray-100/10">
                                    {(s.results?.[sub.id]?.average || s.results?.[sub.name]?.average || 0).toFixed(1)}
                                  </td>
                                ))}
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-black border-t border-gray-100 text-gray-900">{(s.semester1 && s.semester2) ? ((s.semester1.total + s.semester2.total) / 2).toFixed(1) : s.final?.total}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-black border-t border-gray-100 text-gray-900">{s.final?.average?.toFixed(1) ?? '0.0'}</td>
                                <td className="p-2 border-r border-gray-200 text-center font-mono font-black border-t border-gray-100 bg-indigo-50/30 text-indigo-900">#{s.final?.rank}</td>
                                <td className={`p-2 border-r border-gray-200 text-center text-[11px] font-black border-t border-gray-100 ${statColor(finalStat)}`}>{finalStat}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 4 Beautiful Dynamic Oromo Footer Statistics Cards for Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <StatBox title="Barattoota Galma'an" english="Registered Students" m={regM} f={regF} t={regT} color="indigo" />
                    <StatBox title="Barattoota Darban" english="Passed Students" m={passM} f={passF} t={passT} color="green" />
                    <StatBox title="Barattoota Kufan" english="Failed Students" m={failM} f={failF} t={failT} color="red" />
                    <StatBox title="Barattoota Addaan Kutan" english="Dropout Students" m={dropM} f={dropF} t={dropT} color="orange" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent stat rendering box for gorgeous Oromo roster alignment comparison logic
const StatBox = ({ title, english, m, f, t, color }: { title: string, english: string, m: number, f: number, t: number, color: 'indigo' | 'green' | 'red' | 'orange' }) => {
  const themes = {
    indigo: {
      border: 'border-indigo-100',
      bgHeader: 'bg-indigo-50 text-indigo-900',
      textMain: 'text-indigo-600'
    },
    green: {
      border: 'border-green-100',
      bgHeader: 'bg-green-50 text-green-900',
      textMain: 'text-green-600'
    },
    red: {
      border: 'border-red-100',
      bgHeader: 'bg-red-50/70 text-red-900',
      textMain: 'text-red-600'
    },
    orange: {
      border: 'border-orange-100',
      bgHeader: 'bg-orange-50 text-orange-900',
      textMain: 'text-orange-600'
    }
  };

  const theme = themes[color];

  return (
    <div className={`rounded-2xl border ${theme.border} overflow-hidden shadow-sm bg-white`}>
      <div className={`p-3 text-center ${theme.bgHeader} border-b ${theme.border}`}>
        <h5 className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">{title}</h5>
        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{english}</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100 text-center py-2.5">
        <div>
          <span className="block text-[8px] font-black text-gray-400 uppercase tracking-wider">Dhiira</span>
          <span className="text-sm font-bold text-gray-700 font-mono">{m}</span>
        </div>
        <div>
          <span className="block text-[8px] font-black text-gray-400 uppercase tracking-wider">Dubartii</span>
          <span className="text-sm font-bold text-gray-700 font-mono">{f}</span>
        </div>
        <div>
          <span className="block text-[8px] font-black text-gray-400 uppercase tracking-wider">Total</span>
          <span className={`text-sm font-black font-mono ${theme.textMain}`}>{t}</span>
        </div>
      </div>
    </div>
  );
};
