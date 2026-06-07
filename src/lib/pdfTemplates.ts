import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchoolConfig, Student, Subject } from '../types';

export const generateTranscript = async (student: Student, subjects: Subject[], config: SchoolConfig) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const { transcriptLayout } = config;
  const W = 210;
  const H = 297;

  // Helper to convert % to mm
  const mmX = (p: number) => (p / 100) * W;
  const mmY = (p: number) => (p / 100) * H;

  // Layout positions (fallback to defaults if undefined)
  const l = transcriptLayout || {
    header: { x: 50, y: 15 },
    logo: { x: 15, y: 15 },
    watermark: { x: 50, y: 50 },
    footer: { x: 50, y: 280 },
    signature: { x: 160, y: 260 }
  };

  // --- IMAGES ---
  if (config.schoolWatermarkURL) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
      doc.addImage(config.schoolWatermarkURL, 'PNG', mmX(l.watermark.x) - 40, mmY(l.watermark.y) - 40, 80, 80);
      doc.restoreGraphicsState();
    } catch (e) {
      console.warn("Watermark image failed to load", e);
    }
  }

  if (config.schoolHeaderURL) {
    try {
      doc.addImage(config.schoolHeaderURL, 'PNG', mmX(l.header.x) - 75, mmY(l.header.y) - 10, 150, 20);
    } catch (e) {
      console.warn("Header image failed to load", e);
    }
  }

  if (config.schoolLogo) {
    try {
      doc.addImage(config.schoolLogo, 'PNG', mmX(l.logo.x) - 10, mmY(l.logo.y) - 10, 20, 20);
    } catch (e) {
      console.warn("Logo image failed to load", e);
    }
  }

  // --- TEXTUAL HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.schoolName.toUpperCase(), mmX(l.header.x), mmY(l.header.y) + 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  if (config.schoolMotto) {
    doc.text(config.schoolMotto, mmX(l.header.x), mmY(l.header.y) + 20, { align: 'center' });
  }

  // --- STUDENT INFO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('OFFICIAL TRANSCRIPT', 105, mmY(l.header.y) + 35, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Student Name: ${student.name}`, 15, mmY(l.header.y) + 45);
  doc.text(`ID No: ${student.studentId}`, 15, mmY(l.header.y) + 50);
  doc.text(`Sex: ${student.sex}`, 140, mmY(l.header.y) + 45);
  doc.text(`Grade: ${student.grade}${student.section}`, 140, mmY(l.header.y) + 50);

  // --- TABLE ---
  const tableData: any[] = [];
  subjects.forEach(sub => {
    const res = student.results?.[sub.id] || student.results?.[sub.name];
    if (res) {
      tableData.push([
        sub.name,
        res.semester1 || '-',
        res.semester2 || '-',
        res.average.toFixed(1) || '-'
      ]);
    }
  });

  autoTable(doc, {
    startY: mmY(l.header.y) + 60,
    head: [['Subject Name', 'Semester 1', 'Semester 2', 'Final Average']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] }
  });

  // --- SUMMARY ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (student.final) {
    doc.setFont('helvetica', 'bold');
    const calculatedTotal = (student.semester1 && student.semester2)
      ? ((student.semester1.total + student.semester2.total) / 2)
      : student.final.total;
    doc.text(`YEARLY TOTAL: ${calculatedTotal.toFixed(1)}`, 15, finalY);
    doc.text(`YEARLY AVERAGE: ${student.final.average.toFixed(1)}`, 70, finalY);
    doc.text(`RANK: ${student.final.rank}`, 130, finalY);
    doc.text(`STATUS: ${student.final.status}`, 170, finalY);
  }

  // --- FOOTER & SIGNATURE ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const footerText = `${config.schoolAddress || ''} | Phone: ${config.schoolPhone || ''} | Email: ${config.schoolEmail || ''}`;
  doc.text(footerText, mmX(l.footer.x), mmY(l.footer.y), { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('__________________________', mmX(l.signature.x), mmY(l.signature.y), { align: 'center' });
  doc.text('Director Signature & Stamp', mmX(l.signature.x), mmY(l.signature.y) + 5, { align: 'center' });

  doc.save(`Transcript_${student.studentId}_${config.academicYear}.pdf`);
};
