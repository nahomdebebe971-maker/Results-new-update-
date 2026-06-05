import { SchoolConfig } from '../types';

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  schoolName: 'CHERCHER SECONDARY SCHOOL',
  schoolMotto: 'Education for Excellence',
  schoolAddress: 'Chercher, Ethiopia',
  schoolPhone: '+251 900 000 000',
  schoolEmail: 'contact@chercher.edu.et',
  schoolLogo: 'https://i.postimg.cc/htx0HnYp/file-0000000035b871f4b8fa6871e6e3a24a.png',
  academicYear: '2016 E.C',
  passMark: 50,
  contactInfo: '+251 900 000 000',
  analyticsRanges: [
    { label: '<50', min: 0, max: 49.9 },
    { label: '50-75', min: 50, max: 74.9 },
    { label: '75-90', min: 75, max: 89.9 },
    { label: '90-100', min: 90, max: 100 },
  ],
  studentIdPrefix: 'ST',
  publishedGrades: [],
  transcriptLayout: {
    header: { x: 50, y: 15 },
    logo: { x: 15, y: 15 },
    watermark: { x: 50, y: 50 },
    footer: { x: 50, y: 280 },
    signature: { x: 160, y: 260 }
  },
  rosterFooterTables: [
    { title: 'Registered Students', fields: ['Male', 'Female', 'Total'] },
    { title: 'Passed Students', fields: ['Male', 'Female', 'Total'] },
    { title: 'Failed Students', fields: ['Male', 'Female', 'Total'] }
  ]
};
