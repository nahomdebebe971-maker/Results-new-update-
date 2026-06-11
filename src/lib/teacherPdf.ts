import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Teacher, SubjectAssignment, SchoolConfig, Grade } from '../types';

export const generateTeacherDoc = async (
  teachers: Teacher[], 
  assignments: SubjectAssignment[], 
  schoolConfig: SchoolConfig, 
  allGrades: Grade[],
  studentsCountBySection: Record<string, number>
) => {
  const doc = new jsPDF();
  
  teachers.forEach((teacher, index) => {
    if (index > 0) doc.addPage();
    
    const margin = 14;
    const pageWidth = 210;
    let y = 0;

    // Header Design - Government Style
    doc.setFillColor(31, 41, 55); // Deep Charcoal
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Border accent
    doc.setFillColor(99, 102, 241); // indigo-500
    doc.rect(0, 48, pageWidth, 2, 'F');

    // School Name & Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(schoolConfig.schoolName?.toUpperCase() || 'MODERN ACADEMY', margin, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text(`${schoolConfig.academicYear || '2025/26'} ACADEMIC SESSION | STAFF INFORMATION HANDBOOK`, margin, 32);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('OFFICIAL TEACHER INFORMATION DOCUMENT', margin, 42);

    y = 65;
    
    // Profile Card Section
    doc.setFillColor(249, 250, 251); // Gray-50
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 40, 3, 3, 'F');
    
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('STAFF PROFILE', margin + 5, y + 8);
    
    doc.setDrawColor(229, 231, 235);
    doc.line(margin + 5, y + 12, pageWidth - margin - 5, y + 12);
    
    const profileY = y + 20;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('TEACHER NAME', margin + 10, profileY);
    doc.text('TEACHER ID', margin + 60, profileY);
    doc.text('REGISTRATION DATE', margin + 110, profileY);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text(teacher.name, margin + 10, profileY + 8);
    doc.text(teacher.teacherId, margin + 60, profileY + 8);
    doc.text(teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : 'N/A', margin + 110, profileY + 8);

    y += 55;

    // Assignment Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBJECT ASSIGNMENTS & ACCESS PASSKEYS', margin, y);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text('Passkeys are required for all mark-related operations.', margin, y + 5);

    y += 10;

    const teacherAssignments = assignments.filter(a => a.teacherId === teacher.teacherId);
    const assignmentRows = teacherAssignments.map(a => [
      a.gradeName,
      a.section,
      a.subjectName,
      a.passkey
    ]);

    autoTable(doc, {
      startY: y,
      head: [['GRADE', 'SECTION', 'SUBJECT', 'PASSKEY']],
      body: assignmentRows.length > 0 ? assignmentRows : [['-', '-', '-', '-']],
      theme: 'grid',
      headStyles: { 
        fillColor: [31, 41, 55], 
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: 9, 
        halign: 'center' 
      },
      styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        3: { fontStyle: 'bold', textColor: [79, 70, 229] }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // Homeroom Panel
    const homeroom = allGrades.find(g => g.homeroomTeacher === teacher.name || g.homeroomTeacher === teacher.id);
    
    if (homeroom) {
      doc.setFillColor(238, 242, 255); // Indigo-50
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 25, 3, 3, 'F');
      
      doc.setTextColor(67, 56, 202); // Indigo-700
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('HOMEROOM ASSIGNMENT STATUS: ACTIVE', margin + 8, y + 10);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Assigned to Grade ${homeroom.name}${homeroom.section} | Total Students: ${studentsCountBySection[`${homeroom.name}_${homeroom.section}`] || 0}`, margin + 8, y + 18);
    } else {
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 15, 2, 2, 'F');
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(9);
      doc.text('NO HOMEROOM ASSIGNMENT FOUND', margin + 8, y + 9);
    }

    y += homeroom ? 40 : 30;

    // Guide Section
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SYSTEM USAGE GUIDE', margin, y);
    y += 8;

    const guides = [
        ['Step 1', 'Access Portal', 'Visit the Teacher Portal using your Teacher ID and Name.'],
        ['Step 2', 'Class Entry', 'Select an assigned class and provide the Subject Passkey.'],
        ['Step 3', 'Marks Recording', 'Enter marks for students and click "Save Results".'],
        ['Step 4', 'Finalization', 'Once complete, Finalize the marks to lock for processing.']
    ];

    autoTable(doc, {
      startY: y,
      body: guides,
      theme: 'plain',
      styles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20 },
        1: { fontStyle: 'bold', cellWidth: 35 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // System Rules
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CRITICAL SECURITY PROCEDURES', margin, y);
    y += 6;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const rules = [
      '• Confidentiality: Never share assignment passkeys with unauthorized personnel.',
      '• Accuracy: Ensure marks are verified before finalization (Locking).',
      '• Authorized modifications only: Finalized marks require admin override.',
      '• Secure storage: Keep this document in a safe location or destroy after usage.'
    ];
    rules.forEach(rule => {
      doc.text(rule, margin, y);
      y += 5;
    });

    // Footer
    const footerY = 285;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(`Official Document ID: TDR-${teacher.teacherId}-${Date.now()}`, margin, footerY);
    doc.text(`Page ${(doc as any).internal.getNumberOfPages()} | System Support: ${schoolConfig.contactInfo || 'IT HELP DESK'}`, pageWidth / 2, footerY, { align: 'center' });
  });

  doc.save(`Professional_Info_Doc_${Date.now()}.pdf`);
};
