import { SchoolConfig } from '../types';

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  schoolName: 'CHERCHER SECONDARY SCHOOL',
  schoolLogo: '',
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
};
