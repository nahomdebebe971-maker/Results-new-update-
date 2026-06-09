import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Student, SchoolConfig, Subject } from '../types';

// Performance Recommendation Helper
const getRecommendation = (average: number): string => {
  if (average >= 90) return 'Dandeettii Olaana (Excellent Performance)';
  if (average >= 80) return 'Dandeettii Gaarii Olaana (Very Good Performance)';
  if (average >= 75) return 'Dandeettii Gaarii (Good Performance)';
  if (average >= 65) return 'Dandeettii Giddu-galeessa (Satisfactory Performance)';
  if (average >= 50) return 'Gargaarsa Barbaada (Needs Improvement)';
  return 'Gargaarsa Olaana Barbaada (Poor Performance)';
};

// Oromo Translation Helper
const translateSex = (sex: string): string => {
  const s = sex?.trim().toUpperCase();
  if (s === 'M' || s === 'MALE' || s === 'DHIIRA') return 'Dhiira (Male)';
  if (s === 'F' || s === 'FEMALE' || s === 'DUBARTII') return 'Dubartii (Female)';
  return sex || 'N/A';
};

const translateStatus = (status: string, avg?: number, passMark: number = 50): string => {
  const s = status?.trim().toUpperCase();
  if (s === 'PASS' || s === 'DARBEE' || s === 'DARBI') return 'Darbe (Pass)';
  if (s === 'FAIL' || s === 'KUFEE' || s === 'KUFI') return 'Kufe (Fail)';
  if (s === 'DROPOUT' || s === 'ADDAAN KUTE') return 'Addaan Kutaan (Dropout)';
  
  if (avg !== undefined) {
    return avg >= passMark ? 'Darbe (Pass)' : 'Kufe (Fail)';
  }
  return status || 'N/A';
};

const loadLogoImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      img.src = '';
      reject(new Error('School logo URL image download timeout.'));
    }, 4500);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const proxyImg = new Image();
      proxyImg.crossOrigin = 'anonymous';
      const proxyTimeout = setTimeout(() => {
        proxyImg.src = '';
        reject(new Error('CORS proxy image download timeout.'));
      }, 5000);
      proxyImg.onload = () => {
        clearTimeout(proxyTimeout);
        resolve(proxyImg);
      };
      proxyImg.onerror = () => {
        clearTimeout(proxyTimeout);
        reject(new Error('Both direct and proxied school logo loads failed.'));
      };
      proxyImg.src = proxiedUrl;
    };
    img.src = url;
  });
};

export const drawSingleTranscriptPage = async (
  doc: jsPDF, 
  student: Student, 
  config: SchoolConfig, 
  subjects: Subject[], 
  logoImg: HTMLImageElement | null,
  stampImg: HTMLImageElement | null = null,
  homeroomTeacherName: string = '________________'
) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  
  // Professional Academic Color Palette
  const deepNavy = [15, 23, 42]; // Slate 900
  const royalBlue = [30, 58, 138]; // Blue 900
  const softGray = [241, 245, 249]; // Slate 100
  const borderCol = [226, 232, 240]; // Slate 200
  const textMuted = [100, 116, 139]; // Slate 500
  const textDark = [30, 41, 59]; // Slate 800
  const goldAccent = [180, 150, 50]; // Professional Gold

  // --- BACKGROUND & DECORATIVE FRAME ---
  // A4 Outer Margin Frame
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  
  // Header Branding Accent (Top Right Corner Curve)
  doc.setFillColor(15, 23, 42);
  doc.triangle(pageWidth, 0, pageWidth - 40, 0, pageWidth, 30, 'F');

  // --- HEADER SECTION ---
  // A professional unified header with Logo, Info, and QR perfectly aligned.
  
  // 1. School Logo (Left)
  const headerY = 12;
  if (logoImg) {
    doc.addImage(logoImg, 'PNG', 15, headerY, 35, 35);
  } else {
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1.5);
    doc.circle(32, headerY + 17, 16, 'S');
    doc.setFontSize(26);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('C', 32, headerY + 22, { align: 'center' });
  }

  // 2. School Identity (Center)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  const nameWidth = pageWidth - 120;
  const schoolLines = doc.splitTextToSize(config.schoolName.toUpperCase(), nameWidth);
  doc.text(schoolLines, pageWidth / 2, headerY + 8, { align: 'center' });
  
  const mottoY = headerY + 8 + (schoolLines.length * 7);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(180, 150, 50); // Gold
  doc.text(config.schoolMotto || 'Knowledge is Power', pageWidth / 2, mottoY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL ACADEMIC TRANSCRIPT', pageWidth / 2, mottoY + 10, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Academic Year: ${config.academicYear}`, pageWidth / 2, mottoY + 17, { align: 'center' });

  // 3. QR Verification Block (Right)
  const vBoxX = pageWidth - 55;
  const vBoxW = 40;
  const vBoxH = 45;
  
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.rect(vBoxX, headerY, vBoxW, vBoxH, 'S');
  
  doc.setFillColor(15, 23, 42);
  doc.rect(vBoxX, headerY, vBoxW, 7, 'F');
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text('VERIFY DOCUMENT', vBoxX + vBoxW/2, headerY + 5, { align: 'center' });

  const passMark = config.passMark || 50;
  
  // Use official verification ID if provided, fallback to standard pattern for non-published drafts
  const verificationId = student.verificationId || `TRX-${student.studentId}-${config.academicYear.replace(/\s+/g, '')}`;
  const verificationUrl = `${window.location.origin}/verify#verify-${verificationId}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 120 });
    doc.addImage(qrDataUrl, 'PNG', vBoxX + 2.5, headerY + 8, 35, 35);
    doc.setFontSize(5);
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${verificationId}`, vBoxX + vBoxW/2, headerY + vBoxH - 2, { align: 'center' });
  } catch (err) {
    console.error("QR Error", err);
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(15, 62, pageWidth - 15, 62);

  // --- STUDENT INFORMATION SECTION ---
  const infoY = 68;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('STUDENT INFORMATION / RAGAA BARATA', 15, infoY);
  
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(15, infoY + 2, 60, infoY + 2);

  const gridY = infoY + 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(12, gridY, pageWidth - 24, 32, 2, 2, 'S');
  
  doc.setFontSize(9);
  const infoCol1 = 18;
  const infoCol2 = pageWidth / 2 + 5;
  const valCol1 = 65;
  const valCol2 = pageWidth / 2 + 55;

  const drawInfoRow = (y: number, label1: string, val1: string, label2: string, val2: string) => {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(label1, infoCol1, y);
    doc.text(label2, infoCol2, y);
    
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(val1.toUpperCase(), valCol1, y);
    doc.text(val2.toUpperCase(), valCol2, y);
  };

  drawInfoRow(gridY + 10, 'Full Name / Maqaa:', student.name, 'Grade / Kutaa:', student.grade);
  drawInfoRow(gridY + 18, 'Student ID / ID:', student.studentId, 'Section / Damee:', student.section);
  drawInfoRow(gridY + 26, 'Sex / Saala:', translateSex(student.sex), 'Age / Umrii:', student.age?.toString() || 'N/A');

  // --- RESULTS TABLE ---
  const tableData = Object.entries(student.results || {}).map(([subId, res]) => {
    const subject = subjects?.find(s => s.id === subId || s.name === subId);
    return [
      subject?.name || subId,
      res.semester1?.toString() || '0',
      res.semester2?.toString() || '0',
      Number(res.average || 0).toFixed(1),
      translateStatus('', Number(res.average || 0), passMark)
    ];
  });

  autoTable(doc, {
    startY: gridY + 38,
    head: [[
      { content: 'SUBJECT (Gosa Barnootaa)', styles: { halign: 'left' } },
      'SEMESTER 1',
      'SEMESTER 2',
      'AVERAGE',
      'STATUS'
    ]],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 9,
      halign: 'center',
      fontStyle: 'bold',
      cellPadding: 4
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { fontStyle: 'bold', minCellWidth: 65 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 35 }
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.cell.section === 'body') {
        const text = data.cell.text[0].toUpperCase();
        if (text.includes('DARBE') || text.includes('PASS')) {
          data.cell.styles.textColor = [22, 163, 74];
        } else {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    }
  });

  const tableEnd = (doc as any).lastAutoTable.finalY + 10;

  // --- ACADEMIC SUMMARY PANEL (UNIFIED) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('ACADEMIC SUMMARY / DIMSHAASHA BU' + "'" + 'II', 15, tableEnd);
  
  const summaryY = tableEnd + 4;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, summaryY, pageWidth - 24, 35, 2, 2, 'S');
  doc.setLineWidth(0.1);
  doc.line(pageWidth/3 + 4, summaryY + 5, pageWidth/3 + 4, summaryY + 30);
  doc.line((pageWidth/3)*2 - 4, summaryY + 5, (pageWidth/3)*2 - 4, summaryY + 30);

  const drawSummaryCol = (x: number, title: string, data: any) => {
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 138);
    doc.text(title.toUpperCase(), x, summaryY + 8, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total: ${data?.total?.toFixed(1) || '0.0'}`, x, summaryY + 15, { align: 'center' });
    doc.text(`Average: ${data?.average?.toFixed(1) || '0.0'}%`, x, summaryY + 21, { align: 'center' });
    doc.text(`Rank: #${data?.rank || 'N/A'}`, x, summaryY + 27, { align: 'center' });

    const status = translateStatus('', data?.average, passMark);
    doc.setFont('helvetica', 'bold');
    if (status.includes('Pass')) {
      doc.setTextColor(22, 163, 74);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.text(status.toUpperCase(), x, summaryY + 32, { align: 'center' });
  };

  const finalSummaryData = {
    total: student.semester1 && student.semester2 ? (student.semester1.total + student.semester2.total) / 2 : (student.final?.total || 0),
    average: student.final?.average || 0,
    rank: student.final?.rank
  };

  drawSummaryCol(pageWidth/6 + 8, 'Semester 1', student.semester1);
  drawSummaryCol(pageWidth/2, 'Semester 2', student.semester2);
  drawSummaryCol(pageWidth - (pageWidth/6 + 8), 'Annual Result', finalSummaryData);

  // --- CONDUCT, ABSENT & RECOMMENDATION (UNIFIED) ---
  const extraY = summaryY + 45;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, extraY, pageWidth - 24, 22, 2, 2, 'S');
  doc.setLineWidth(0.1);
  doc.line(pageWidth/3 + 4, extraY + 4, pageWidth/3 + 4, extraY + 18);
  doc.line((pageWidth/3)*2 - 4, extraY + 4, (pageWidth/3)*2 - 4, extraY + 18);

  // Conduct
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CONDUCT (AMALA)', 35, extraY + 8, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(student.conduct || 'A', 35, extraY + 16, { align: 'center' });

  // Absent
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ABSENT (HAFTE)', pageWidth/2 - 2, extraY + 8, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(220, 38, 38);
  doc.text(`${student.absent ?? 0} DAYS`, pageWidth/2 - 2, extraY + 16, { align: 'center' });

  // Rec
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('RECOMMENDATION', pageWidth - 45, extraY + 8, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const rec = getRecommendation(student.final?.average || 0);
  doc.text(rec.split(' (')[0], pageWidth - 45, extraY + 14, { align: 'center', maxWidth: 45 });
  doc.setFontSize(7);
  doc.text(`(${rec.split(' (')[1] || ''}`, pageWidth - 45, extraY + 19, { align: 'center' });

  // --- SIGNATURES SECTION ---
  const signY = extraY + 32;
  const colW = (pageWidth - 30) / 3;

  const drawSignBlock = (x: number, title: string, oromoTitle: string, name: string) => {
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x + colW/2, signY + 5, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`(${oromoTitle})`, x + colW/2, signY + 9, { align: 'center' });
    
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(x + 5, signY + 25, x + colW - 5, signY + 25);
    
    doc.setFontSize(7);
    doc.text('Signature / Mallattoo', x + colW/2, signY + 29, { align: 'center' });
    
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Name: ${name}`, x + 5, signY + 36);
    doc.setFontSize(8);
    doc.text('Date: _______________', x + 5, signY + 43);
  };

  drawSignBlock(12, 'Homeroom Teacher', 'Barsiisaa Gorsaa', homeroomTeacherName);
  
  // Stamp Area
  const stampX = 12 + colW + 2;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Official School Stamp', stampX + colW/2, signY + 5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('(Mallattoo Mana Barumsaa)', stampX + colW/2, signY + 9, { align: 'center' });

  if (stampImg) {
    doc.addImage(stampImg, 'PNG', stampX + colW/2 - 15, signY + 12, 30, 30);
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(stampX + colW/2 - 17.5, signY + 12, 35, 35, 17.5, 17.5, 'S'); // Circular placeholder
    doc.setFontSize(6);
    doc.setTextColor(200, 205, 215);
    doc.text('STAMP AREA', stampX + colW/2, signY + 30, { align: 'center' });
  }

  drawSignBlock(12 + (colW + 2) * 2, 'School Director', 'Maamila Mana Barumsaa', config.directorName || '________________');

  // --- FOOTER & CONTACT ---
  const footerY = pageHeight - 25;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, footerY, pageWidth, 25, 'F');

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL ACADEMIC RECORD', 15, footerY + 10);

  doc.setFontSize(7);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  const legal = "This document is an official academic transcript issued by CHERCHER SECONDARY SCHOOL. Any unauthorized alteration, modification, or reproduction of this document renders it invalid.";
  const wrappedLegal = doc.splitTextToSize(legal, pageWidth - 100);
  doc.text(wrappedLegal, pageWidth - 12, footerY + 8, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const contact = `📍 ${config.schoolAddress || 'Chercher, Ethiopia'}   \u2022   📞 ${config.schoolPhone || ''}   \u2022   ✉ ${config.schoolEmail || ''}   \u2022   🌐 ${config.schoolWebsite || ''}`;
  doc.text(contact, pageWidth / 2, pageHeight - 3, { align: 'center' });
};

export const generateStudentTranscript = async (
  student: Student, 
  config: SchoolConfig, 
  subjects: Subject[],
  homeroomTeacherName?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let logoImg: HTMLImageElement | null = null;
  let stampImg: HTMLImageElement | null = null;

  try {
    if (config.schoolLogo) logoImg = await loadLogoImage(config.schoolLogo);
    if (config.schoolStampURL) stampImg = await loadLogoImage(config.schoolStampURL);
  } catch (e) {
    console.warn('Media load failed', e);
  }

  await drawSingleTranscriptPage(doc, student, config, subjects, logoImg, stampImg, homeroomTeacherName);
  doc.save(`${student.studentId}_Transcript.pdf`);
};

export const generateAllStudentTranscriptsForGrade = async (
  studentsList: Student[],
  config: SchoolConfig,
  subjects: Subject[],
  gradeName: string,
  sectionName: string,
  homeroomTeacherName: string = '________________'
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let logoImg: HTMLImageElement | null = null;
  let stampImg: HTMLImageElement | null = null;

  try {
    if (config.schoolLogo) logoImg = await loadLogoImage(config.schoolLogo);
    if (config.schoolStampURL) stampImg = await loadLogoImage(config.schoolStampURL);
  } catch (e) {
    console.warn('Media load failed', e);
  }
  
  for (let i = 0; i < studentsList.length; i++) {
    await drawSingleTranscriptPage(doc, studentsList[i], config, subjects, logoImg, stampImg, homeroomTeacherName);
    if (i < studentsList.length - 1) {
      doc.addPage();
    }
  }
  doc.save(`${gradeName}${sectionName}-All-Transcripts.pdf`);
};

// General helper to load images with retry CORS support
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      img.src = '';
      reject(new Error('Image download timeout'));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      
      const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const proxyImg = new Image();
      proxyImg.crossOrigin = 'anonymous';
      
      const proxyTimeout = setTimeout(() => {
        proxyImg.src = '';
        reject(new Error('Proxy logo download timeout'));
      }, 5000);

      proxyImg.onload = () => {
        clearTimeout(proxyTimeout);
        resolve(proxyImg);
      };
      proxyImg.onerror = () => {
        clearTimeout(proxyTimeout);
        reject(new Error('Logo image download failed.'));
      };
      proxyImg.src = proxiedUrl;
    };
    img.src = url;
  });
};

export const drawSingleIdCardOnDoc = (
  doc: jsPDF,
  student: Student,
  config: SchoolConfig,
  x: number,
  y: number,
  logoImg: HTMLImageElement | null,
  qrImg: HTMLImageElement | null
) => {
  const w = 86;
  const h = 54;

  // Outer border with subtle rounding
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

  // Colored top branding stripe
  doc.setFillColor(30, 41, 59); // Dark navy
  doc.roundedRect(x, y, w, 9.5, 2.5, 2.5, 'F');
  doc.rect(x, y + 7, w, 2.5, 'F'); // Avoid curved lower edge

  // Gold connector accent stripe
  doc.setFillColor(202, 138, 4); // bg-yellow-600
  doc.rect(x, y + 9.5, w, 0.8, 'F');

  // Insert school logo
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', x + 3.5, y + 1.8, 6, 6);
    } catch (e) {
      // Draw small fallback crest
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(234, 179, 8); // Yellow gold
      doc.text('C', x + 6.5, y + 6, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(234, 179, 8);
    doc.text('C', x + 6.5, y + 6, { align: 'center' });
  }

  // School name titles in header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  const schoolName = config.schoolName || 'CHERCHER SECONDARY SCHOOL';
  doc.text(schoolName.toUpperCase(), x + 11.5, y + 4.2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3.5);
  doc.setTextColor(220, 225, 235);
  doc.text(config.schoolMotto || 'KNOWLEDGE IS LIGHT', x + 11.5, y + 7.5);

  // Student Photo portrait placeholder
  const px = x + 4;
  const py = y + 13.5;
  const pw = 23;
  const ph = 29;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.25);
  doc.roundedRect(px, py, pw, ph, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(99, 102, 241);
  doc.text(student.name.charAt(0).toUpperCase(), px + pw / 2, py + ph / 2 + 1, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.2);
  doc.setTextColor(150, 160, 180);
  doc.text('STUDENT', px + pw / 2, py + ph - 2.5, { align: 'center' });

  // Student directory details text grid
  const tx = x + 29.5;

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(140, 145, 155);
  doc.text('FULL NAME', tx, y + 15);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(student.name.toUpperCase(), tx, y + 18.5, { maxWidth: 36 });

  // Grade / Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(140, 145, 155);
  doc.text('GRADE / SECTION', tx, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(50, 55, 65);
  doc.text(`${student.grade} - ${student.section}`, tx, y + 27.5);

  // Student ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(140, 145, 155);
  doc.text('STUDENT ID', tx, y + 32.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(79, 70, 229);
  doc.text(student.studentId, tx, y + 36);

  // Academic Year
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(140, 145, 155);
  doc.text('ACADEMIC YEAR', tx, y + 41.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(30, 35, 45);
  doc.text(config.academicYear || '2026/27', tx, y + 45);

  // Verification panel stripe on Right bounds
  const vx = x + w - 18;
  doc.setFillColor(250, 251, 252);
  doc.rect(vx, y + 10.3, 18, 43.7, 'F');
  
  doc.setDrawColor(225, 230, 240);
  doc.setLineWidth(0.2);
  doc.line(vx, y + 10.3, vx, y + h);

  // Embed Verification QR
  if (qrImg) {
    try {
      doc.addImage(qrImg, 'PNG', vx + 2, y + 14, 14, 14);
    } catch (e) {
      console.warn("QR missing in PDF draw:", e);
    }
  }

  // Verification guide tags
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(110, 120, 140);
  doc.text('SCAN TO VERIFY', vx + 9, y + 31.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.3);
  doc.setTextColor(150, 160, 180);
  doc.text(`REF: ${student.studentId}`, vx + 9, y + h - 3, { align: 'center' });
};

// Generates an ID Card PDF for a single student on A4 format
export const generateSingleStudentIdCardPdf = async (student: Student, config: SchoolConfig) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Load logo
  let logoImg: HTMLImageElement | null = null;
  if (config.schoolLogo) {
    try { logoImg = await loadImage(config.schoolLogo); } catch (e) { }
  }

  // Load QR Code
  const academicYear = config.academicYear || '2026';
  const verificationId = `ID-${student.studentId}-${academicYear}`;
  const verificationUrl = `${window.location.origin}${window.location.pathname}#verify-${verificationId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;
  
  let qrImg: HTMLImageElement | null = null;
  try { qrImg = await loadImage(qrUrl); } catch (e) { }

  // Draw beautifully in the center of A4 page
  // Margins center mapping
  const x = (210 - 86) / 2;
  const y = (297 - 54) / 2;

  // Draw decorative title outside the card boundaries on A4 page
  doc.setTextColor(100, 110, 125);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CHERCHER SECONDARY SCHOOL - DIGITAL BADGE', 105, y - 10, { align: 'center' });

  // Draw card helper guidelines or scissors cuts
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  doc.line(x - 5, y, x + 86 + 5, y);
  doc.line(x - 5, y + 54, x + 86 + 5, y + 54);
  doc.line(x, y - 5, x, y + 54 + 5);
  doc.line(x + 86, y - 5, x + 86, y + 54 + 5);

  drawSingleIdCardOnDoc(doc, student, config, x, y, logoImg, qrImg);

  doc.save(`Student-ID-${student.studentId}.pdf`);
};

// Generates bulk ID Cards on A4 pages (2 columns * 4 rows = 8 cards per page)
export const generateBulkStudentIdCardsPdf = async (
  studentsList: Student[],
  config: SchoolConfig,
  outputFilename: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Load logo
  let logoImg: HTMLImageElement | null = null;
  if (config.schoolLogo) {
    try { logoImg = await loadImage(config.schoolLogo); } catch (e) { }
  }

  // Resolve QRs for all students in bulk efficiently
  const qrMap: Record<string, HTMLImageElement | null> = {};
  const academicYear = config.academicYear || '2026';

  // Batch network loads to avoid browser bottlenecks
  const batchSize = 10;
  for (let idx = 0; idx < studentsList.length; idx += batchSize) {
    const chunk = studentsList.slice(idx, idx + batchSize);
    await Promise.all(chunk.map(async (student) => {
      const verificationId = `ID-${student.studentId}-${academicYear}`;
      const verificationUrl = `${window.location.origin}${window.location.pathname}#verify-${verificationId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;
      try {
        qrMap[student.id] = await loadImage(qrUrl);
      } catch (e) {
        qrMap[student.id] = null;
      }
    }));
  }

  // Grid sizing coordinates
  const cardW = 86;
  const cardH = 54;
  const colGap = 6;
  const rowGap = 6;
  
  const leftMargin = 16;
  const topMargin = 28;

  for (let i = 0; i < studentsList.length; i++) {
    const pageIndex = i % 8;
    if (i > 0 && pageIndex === 0) {
      doc.addPage();
    }

    const col = pageIndex % 2;
    const row = Math.floor(pageIndex / 2);

    const x = leftMargin + col * (cardW + colGap);
    const y = topMargin + row * (cardH + rowGap);

    const student = studentsList[i];
    const qrImg = qrMap[student.id] || null;

    drawSingleIdCardOnDoc(doc, student, config, x, y, logoImg, qrImg);
  }

  doc.save(outputFilename);
};
