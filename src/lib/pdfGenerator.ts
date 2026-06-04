import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, SchoolConfig } from '../types';

export const generateStudentTranscript = (student: Student, config: SchoolConfig) => {
  const doc = new jsPDF();
  const primaryColor = [31, 41, 55]; // Gray-800 for professional look
  const accentColor = [79, 70, 229]; // Indigo-600
  
  // Outer Border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, 200, 287);

  // Header Section
  doc.setFillColor(31, 41, 55);
  doc.rect(10, 10, 190, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName, 20, 28);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL ACADEMIC RECORD', 20, 38);
  doc.text(`ACADEMIC YEAR: ${config.academicYear}`, 20, 44);

  // Right side of header (contact info)
  doc.setFontSize(8);
  doc.text(config.contactInfo || '', 190, 25, { align: 'right' });
  doc.text('Chercher, Ethiopia', 190, 30, { align: 'right' });

  // Student Profile Header
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(1);
  doc.line(10, 65, 200, 65);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT INFORMATION', 10, 62);

  const studentInfoY = 75;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('NAME:', 15, studentInfoY);
  doc.text('STUDENT ID:', 15, studentInfoY + 8);
  doc.text('SEX:', 15, studentInfoY + 16);

  doc.setFont('helvetica', 'normal');
  doc.text(student.name, 45, studentInfoY);
  doc.text(student.studentId, 45, studentInfoY + 8);
  doc.text(student.sex === 'M' ? 'Male' : 'Female', 45, studentInfoY + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('GRADE:', 110, studentInfoY);
  doc.text('SECTION:', 110, studentInfoY + 8);
  doc.text('AGE:', 110, studentInfoY + 16);

  doc.setFont('helvetica', 'normal');
  doc.text(student.grade, 140, studentInfoY);
  doc.text(student.section, 140, studentInfoY + 8);
  doc.text(student.age.toString(), 140, studentInfoY + 16);

  // Performance Table
  const tableData = Object.entries(student.results || {}).map(([sub, res]) => [
    sub,
    res.semester1.toString(),
    res.semester2.toString(),
    res.average.toFixed(1),
    res.average >= config.passMark ? 'PASS' : 'FAIL'
  ]);

  autoTable(doc, {
    startY: studentInfoY + 25,
    head: [['SUBJECT', 'SEM 1', 'SEM 2', 'AVERAGE', 'STATUS']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [31, 41, 55], 
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle',
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', minCellWidth: 60 },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' }
    },
    margin: { left: 10, right: 10 }
  });

  // Performance Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFillColor(249, 250, 251);
  doc.rect(10, finalY, 190, 40, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(10, finalY, 190, 40, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ACADEMIC SUMMARY', 15, finalY + 10);

  const summaryDataY = finalY + 22;
  doc.setFontSize(10);
  doc.text('Total Marks:', 15, summaryDataY);
  doc.text('Final Average:', 15, summaryDataY + 8);
  doc.text('Overall Rank:', 15, summaryDataY + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.text(student.final?.total.toFixed(1) || 'N/A', 50, summaryDataY);
  doc.text(`${student.final?.average.toFixed(1)}%` || 'N/A', 50, summaryDataY + 8);
  doc.text(student.final?.rank.toString() || 'N/A', 50, summaryDataY + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Result Status:', 110, summaryDataY);
  const status = student.final?.status || 'N/A';
  doc.setTextColor(status === 'Pass' ? 22 : 185, status === 'Pass' ? 101 : 28, status === 'Pass' ? 52 : 28);
  doc.text(status.toUpperCase(), 145, summaryDataY);
  doc.setTextColor(0,0,0);

  // Signatures
  const signatureY = finalY + 65;
  doc.setLineWidth(0.3);
  doc.line(15, signatureY, 70, signatureY);
  doc.line(140, signatureY, 195, signatureY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Homeroom Teacher's Signature", 15, signatureY + 5);
  doc.text("School Principal's Signature", 140, signatureY + 5);

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Official Transcript ID: ${student.studentId}-${Date.now()}`, 10, pageHeight - 12);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 200, pageHeight - 12, { align: 'right' });
  doc.text('Any alteration to this document renders it invalid.', 105, pageHeight - 7, { align: 'center' });

  doc.save(`${student.studentId}_Transcript.pdf`);
};
