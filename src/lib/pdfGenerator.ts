import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, SchoolConfig } from '../types';

export const generateStudentTranscript = (student: Student, config: SchoolConfig) => {
  const doc = new jsPDF();
  const primaryColor = [79, 70, 229]; // Indigo-600

  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName, 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Academic Transcript - Academic Year: ${config.academicYear}`, 20, 30);

  // Student Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Full Name: ${student.name}`, 20, 50);
  doc.text(`Student ID: ${student.studentId}`, 20, 56);
  doc.text(`Sex: ${student.sex}  |  Age: ${student.age}`, 20, 62);
  doc.text(`Grade: ${student.grade}${student.section}`, 20, 68);

  // Summary Cards
  const summaries = [
    { label: 'Semester 1', data: student.semester1 },
    { label: 'Semester 2', data: student.semester2 },
    { label: 'Final Result', data: student.final },
  ];

  summaries.forEach((s, i) => {
    const x = 20 + (i * 60);
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, 75, 55, 25);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(s.label.toUpperCase(), x + 5, 82);
    
    if (s.data) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(`${s.data.average.toFixed(1)}%`, x + 5, 92);
      doc.setFontSize(8);
      doc.text(`Rank: ${s.data.rank}`, x + 35, 92);
    } else {
      doc.text('N/A', x + 5, 92);
    }
  });

  // Table
  const tableData = Object.entries(student.results || {}).map(([sub, res]) => [
    sub,
    res.semester1,
    res.semester2,
    res.average.toFixed(1),
    res.average >= config.passMark ? 'Pass' : 'Fail'
  ]);

  autoTable(doc, {
    startY: 110,
    head: [['Subject Name', '1st Semester', '2nd Semester', 'Final Average', 'Status']],
    body: tableData,
    headStyles: { fillColor: primaryColor as [number, number, number] },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    margin: { left: 20, right: 20 }
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, pageHeight - 10);
  doc.text('This is an official document from Chercher Secondary School Result Management System.', 100, pageHeight - 10);

  doc.save(`${student.studentId}_Transcript.pdf`);
};
