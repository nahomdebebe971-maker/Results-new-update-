import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, SchoolConfig, Subject } from '../types';

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
  
  // Guard fallback
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
      
      // Fallback: load image via a reliable public CORS proxy to bypass target server CORS restrictions
      const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      console.warn(`Direct logo load failed due to CORS. Retrying via proxy: ${proxiedUrl}`);
      
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
      proxyImg.onerror = (err) => {
        clearTimeout(proxyTimeout);
        reject(new Error('Both direct and proxied school logo loads failed.'));
      };
      proxyImg.src = proxiedUrl;
    };
    img.src = url;
  });
};

export const generateStudentTranscript = async (student: Student, config: SchoolConfig, subjects: Subject[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  
  // Custom Color Theme: Academic Deep Indigo
  const primaryThemeColor = [27, 38, 59]; // Deep Navy
  const secondaryThemeColor = [65, 90, 119]; // Slate Blue
  const darkGray = [33, 37, 41];
  const borderGray = [220, 225, 230];

  // Outer Decorative double border
  doc.setDrawColor(27, 38, 59);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.2);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);

  // --- BRANDING HEADER / LOGO ---
  // Beautiful Academic Crest/Emblem vector drawn directly on PDF
  const drawEmblem = (x: number, y: number) => {
    // Outer shield circle
    doc.setDrawColor(27, 38, 59);
    doc.setLineWidth(1);
    doc.setFillColor(250, 250, 250);
    doc.circle(x, y, 16, 'FD');
    
    // Inner emblem details
    doc.setDrawColor(180, 150, 50); // Gold accent
    doc.setLineWidth(0.5);
    doc.circle(x, y, 13.5, 'S');

    // Stylized Open Book Vector in the center
    doc.setFillColor(27, 38, 59);
    // Left page
    doc.triangle(x - 6, y + 2, x - 1, y - 3, x - 1, y + 3, 'F');
    // Right page
    doc.triangle(x + 6, y + 2, x + 1, y - 3, x + 1, y + 3, 'F');
    // Book pages division lines
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(x - 5, y + 1.5, x - 2, y - 1);
    doc.line(x + 5, y + 1.5, x + 2, y - 1);

    // Olive wreath bottom arc
    doc.setDrawColor(180, 150, 50);
    doc.setLineWidth(0.4);
    doc.ellipse(x, y + 8, 8, 3, 'S');

    // School Symbol Text
    doc.setTextColor(27, 38, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('CHERCHER', x, y - 6, { align: 'center' });
    doc.setFontSize(4);
    doc.text('KNOWLEDGE IS POWER', x, y + 12, { align: 'center' });
  };

  // Draw the official crest at top left or embed school logo dynamically
  let imgLoaded = false;
  let logoImg: HTMLImageElement | null = null;

  if (config.schoolLogo) {
    try {
      logoImg = await loadLogoImage(config.schoolLogo);
      imgLoaded = true;
    } catch (e) {
      console.warn('Failed to load school logo dynamically, falling back to clean vector emblem:', e);
    }
  }

  if (imgLoaded && logoImg) {
    try {
      // Cleanly determine format matching (default to PNG)
      let format = 'PNG';
      if (config.schoolLogo.toLowerCase().includes('.jpg') || config.schoolLogo.toLowerCase().includes('.jpeg')) {
        format = 'JPEG';
      } else if (config.schoolLogo.toLowerCase().includes('.svg')) {
        format = 'SVG';
      } else if (config.schoolLogo.toLowerCase().includes('.webp')) {
        format = 'WEBP';
      }
      // Embed configured logo nicely aligned to the upper header
      doc.addImage(logoImg, format, 15, 12, 26, 26);
    } catch (err) {
      console.error('Error embedding school logo inside PDF canvas, drawing emblem fallback:', err);
      drawEmblem(28, 28);
    }
  } else {
    drawEmblem(28, 28);
  }

  // --- SCHOOL IDENTIFICATION DETAILS (Top-Center and Right) ---
  doc.setTextColor(27, 38, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(config.schoolName.toUpperCase(), 48, 24);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 110, 120);
  doc.text(config.schoolMotto || 'KNOWLEDGE IS POWER', 48, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(65, 90, 119);
  doc.text(`BARA BARNOOTAA (ACADEMIC YEAR): ${config.academicYear}`, 48, 34);

  // Divider lines below header
  doc.setDrawColor(27, 38, 59);
  doc.setLineWidth(0.65);
  doc.line(12, 48, pageWidth - 12, 48);
  doc.setDrawColor(210, 215, 220);
  doc.setLineWidth(0.2);
  doc.line(12, 50, pageWidth - 12, 50);

  // --- TRANSCRIPT TITLE ---
  doc.setTextColor(27, 38, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GALTUU ODEEFFANNOO BARATAA WALIIGALAA', pageWidth / 2, 58, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text('OFFICIAL ACADEMIC TRANSCRIPT', pageWidth / 2, 63, { align: 'center' });

  // --- STUDENT DETAILED INFORMATION PROFILE ---
  // Background Card box for Student Info
  doc.setFillColor(248, 249, 250);
  doc.rect(12, 69, pageWidth - 24, 28, 'F');
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.35);
  doc.rect(12, 69, pageWidth - 24, 28, 'S');

  // Profile data layout (Bilingual Oromo + English)
  doc.setFontSize(8.5);
  const col1X = 16;
  const col2X = 112;
  const line1Y = 75;
  const line2Y = 83;
  const line3Y = 91;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Maqaa Guutuu (Full Name):', col1X, line1Y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 38, 59);
  doc.setFontSize(9.5);
  doc.text(student.name, col1X + 41, line1Y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Eenyummeessa (Student ID):', col2X, line1Y);
  doc.setFont('helvetica', 'mono-bold');
  doc.setTextColor(27, 38, 59);
  doc.setFontSize(9.5);
  doc.text(student.studentId, col2X + 43, line1Y);

  // Row 2
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Saala (Sex):', col1X, line2Y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(33, 37, 41);
  doc.text(translateSex(student.sex), col1X + 41, line2Y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Kutaa (Grade):', col2X, line2Y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(33, 37, 41);
  doc.text(student.grade, col2X + 43, line2Y);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Umrii (Age):', col1X, line3Y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(33, 37, 41);
  doc.text(`${student.age || 'N/A'}`, col1X + 41, line3Y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 115, 125);
  doc.text('Damee (Section):', col2X, line3Y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(33, 37, 41);
  doc.text(student.section, col2X + 43, line3Y);

  // --- SUBJECT RESULTS ACADEMIC METRICS SHEET ---
  const passMark = config.passMark || 50;

  // Gather marks list
  const tableData = Object.entries(student.results || {}).map(([subId, res]) => {
    const subjectName = subjects?.find(s => s.id === subId || s.name === subId)?.name || subId;
    const avgScore = Number(res.average || 0);
    return [
      subjectName,
      res.semester1?.toString() || '0',
      res.semester2?.toString() || '0',
      avgScore.toFixed(1),
      translateStatus(res.average >= passMark ? 'Pass' : 'Fail', avgScore, passMark)
    ];
  });

  // Table header in Oromo & English
  autoTable(doc, {
    startY: 104,
    head: [[
      { content: 'GOSA BARNOOTAA\n(Subject Course)', styles: { halign: 'left' } },
      'SEEM 1\n(Semester 1)',
      'SEEM 2\n(Semester 2)',
      'AVEREJII\n(Average)',
      'HAALA GALMEE\n(Status)'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [27, 38, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      lineColor: [210, 215, 220],
      lineWidth: 0.15,
      font: 'helvetica',
      textColor: [33, 37, 41],
      valign: 'middle'
    },
    columnStyles: {
      0: { fontStyle: 'bold', minCellWidth: 65, halign: 'left' },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 35, fontStyle: 'bold' }
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data) => {
      // Colorize Pass and Fail cells beautifully
      if (data.column.index === 4 && data.cell.text[0]) {
        const textStr = data.cell.text[0].toUpperCase();
        if (textStr.includes('DARBE') || textStr.includes('PASS')) {
          data.cell.styles.textColor = [34, 139, 34]; // Forest green
        } else {
          data.cell.styles.textColor = [220, 20, 60]; // Crimson Red
        }
      }
    }
  });

  // --- ACADEMIC SUMMARY BOX ---
  const tableFinalY = (doc as any).lastAutoTable.finalY + 8;

  // Header of academic summaries
  doc.setTextColor(27, 38, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('AXAERE GALTUU BARNOOTAA SEEMESTARAA (SEMESTER ACADEMIC SUMMARIES)', 12, tableFinalY);

  const summaryHeaders = [
    'Barbaachisaa (Academic Term)',
    'Waliigala (Total Point)',
    'Averejii (Average)',
    'Sadarkaa (Rank)',
    'Haala (Overall Status)'
  ];

  // Helper validation for dropout condition
  const detectDropout = (): boolean => {
    if (!subjects || subjects.length === 0) return false;
    return subjects.some(sub => {
      const res = student.results?.[sub.id] || student.results?.[sub.name];
      const s1 = res?.semester1 ?? 0;
      const s2 = res?.semester2 ?? 0;
      return s1 === 0 && s2 === 0;
    });
  };

  const isDrp = detectDropout();

  const getS1Status = () => {
    if (isDrp) return 'Addaan Kute (Dropout)';
    return translateStatus(student.semester1?.status || '', student.semester1?.average, passMark);
  };
  const getS2Status = () => {
    if (isDrp) return 'Addaan Kute (Dropout)';
    return translateStatus(student.semester2?.status || '', student.semester2?.average, passMark);
  };
  const getFinalStatus = () => {
    if (isDrp) return 'Addaan Kute (Dropout)';
    return translateStatus(student.final?.status || '', student.final?.average, passMark);
  };

  const summaryRows = [
    [
      'Seemestara 1ffaa (Semester 1 Summary)',
      student.semester1?.total.toFixed(0) || '0',
      `${student.semester1?.average.toFixed(1)}%` || '0.0%',
      student.semester1?.rank?.toString() || 'N/A',
      getS1Status()
    ],
    [
      'Seemestara 2ffaa (Semester 2 Summary)',
      student.semester2?.total.toFixed(0) || '0',
      `${student.semester2?.average.toFixed(1)}%` || '0.0%',
      student.semester2?.rank?.toString() || 'N/A',
      getS2Status()
    ],
    [
      'Yaada Waliigalaa (Final Academic Record)',
      student.final?.total.toFixed(0) || '0',
      `${student.final?.average.toFixed(1)}%` || '0.0%',
      student.final?.rank?.toString() || 'N/A',
      getFinalStatus()
    ],
    [
      'Ilaalcha Amalaa & Hafte (Conduct & Attendance)',
      '—',
      `Amala (Conduct): ${student.conduct || 'A'}`,
      '—',
      `Hafte (Absent): ${student.absent ?? 0} Guyyaa (Days)`
    ]
  ];

  autoTable(doc, {
    startY: tableFinalY + 2.5,
    head: [summaryHeaders],
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [65, 90, 119],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [220, 225, 230],
      lineWidth: 0.1,
      font: 'helvetica',
      textColor: [33, 37, 41]
    },
    columnStyles: {
      0: { fontStyle: 'bold', minCellWidth: 65, halign: 'left' },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 35, fontStyle: 'bold' }
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data) => {
      // Colorize overall status
      if (data.column.index === 4 && data.cell.text[0]) {
        const textStr = data.cell.text[0].toUpperCase();
        if (textStr.includes('ADDAAN') || textStr.includes('DROPOUT')) {
          data.cell.styles.textColor = [230, 90, 30]; // Orange
        } else if (textStr.includes('DARBE') || textStr.includes('PASS')) {
          data.cell.styles.textColor = [34, 139, 34]; // Forest green
        } else {
          data.cell.styles.textColor = [220, 20, 60]; // Crimson Red
        }
      }
    }
  });

  const summariesFinalY = (doc as any).lastAutoTable.finalY + 8;

  // --- OFFICIAL INTEGRITY WARNING DISCLAIMER SECTION ---
  doc.setFillColor(254, 243, 243); // Soft pinkish/red background
  doc.rect(12, summariesFinalY, pageWidth - 24, 15, 'F');
  doc.setDrawColor(241, 191, 191);
  doc.setLineWidth(0.4);
  doc.rect(12, summariesFinalY, pageWidth - 24, 15, 'S');

  // Warning text
  doc.setTextColor(180, 20, 20);
  doc.setFont('helvetica', 'bold-italic');
  doc.setFontSize(7.5);
  doc.text('IBSA OFEGGANNOO OFFICIAL / SECURITY INTEGRITY WARNING STATEMENT:', 15, summariesFinalY + 4.5);
  doc.setFont('helvetica', 'normal-italic');
  doc.setTextColor(80, 20, 20);
  doc.setFontSize(7.2);
  doc.text('Any unauthorized alteration or modification of this document renders it invalid.', 15, summariesFinalY + 8);
  doc.text('Jiddu-lixinsi ykn jijjiirraan hayyama malee sanada kana irratti taasifame kamiyyuu gatii dhabsiisa.', 15, summariesFinalY + 11.5);

  // --- SIGNATURES AREA (Homeroom Teacher, Director, Date) ---
  const signY = summariesFinalY + 34;
  doc.setDrawColor(65, 90, 119);
  doc.setLineWidth(0.3);

  // Divider lines for writing signature
  doc.line(14, signY, 68, signY);           // Homeroom teacher
  doc.line(78, signY, 132, signY);         // Director
  doc.line(142, signY, 196, signY);         // Date

  doc.setTextColor(27, 38, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  // Under labels
  doc.text('Barsiisaa Gorsaa', 41, signY + 3.5, { align: 'center' });
  doc.text('(Homeroom Teacher)', 41, signY + 6.8, { align: 'center' });

  doc.text('Daarektara Mana Barumsaa', 105, signY + 3.5, { align: 'center' });
  doc.text('(School Director)', 105, signY + 6.8, { align: 'center' });

  doc.text('Guyyaa (Date)', 169, signY + 3.5, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-GB'), 169, signY + 7.5, { align: 'center' });

  // Official Seal outline circle for principal
  doc.setDrawColor(210, 215, 220);
  doc.setLineWidth(0.25);
  doc.circle(105, signY - 12, 11, 'S');
  doc.setFont('helvetica', 'normal-italic');
  doc.setFontSize(5);
  doc.text('OFFICIAL SEAL', 105, signY - 11, { align: 'center' });

  // --- METADATA FOOTER LINES ---
  doc.setFontSize(7);
  doc.setTextColor(150, 155, 160);
  doc.text(`Official Document Fingerprint ID: CSS-TR-${student.studentId}-${Date.now().toString().slice(-6)}`, 12, pageHeight - 12);
  doc.text(`Guyyaa kalaqame / Generated: ${new Date().toLocaleString()}`, pageWidth - 12, pageHeight - 12, { align: 'right' });

  doc.save(`${student.studentId}_Transcript.pdf`);
};
