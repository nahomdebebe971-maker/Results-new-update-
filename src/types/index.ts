export interface Point {
  x: number;
  y: number;
}

export interface RosterFooterTable {
  title: string;
  fields: string[];
}

export interface SchoolConfig {
  schoolName: string;
  schoolMotto?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolWebsite?: string;
  directorName?: string;
  schoolLogo: string;
  schoolStampURL?: string;
  schoolHeaderURL?: string;
  schoolWatermarkURL?: string;
  academicYear: string;
  passMark: number;
  contactInfo: string;
  analyticsRanges: { label: string; min: number; max: number }[];
  studentIdPrefix: string;
  publishedGrades: string[];
  remarkRules?: { min: number; max: number; remark: string }[];
  transcriptLayout?: {
    header: Point;
    logo: Point;
    watermark: Point;
    footer: Point;
    signature: Point;
  };
  rosterFooterTables?: RosterFooterTable[];
}

export interface Teacher {
  id: string;
  name: string;
  teacherId: string;
  createdAt: string;
}

export interface Grade {
  id: string;
  name: string;
  section: string;
  homeroomTeacher?: string;
  subjectIds?: string[];
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  createdAt: string;
}

export interface SubjectAssignment {
  id: string; // teacherId_subjectId_gradeId
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  gradeId: string; // The specific grade-section doc ID
  gradeName: string;
  section: string;
  passkey: string;
  createdAt: string;
}

export interface StudentResults {
  [subjectId: string]: {
    semester1: number;
    semester2: number;
    average: number;
  };
}

export interface SemesterSummary {
  total: number;
  average: number;
  rank: number;
  status: 'Pass' | 'Fail';
}

export interface Student {
  id: string; // same as studentId for uniqueness
  studentId: string;
  name: string;
  sex: 'M' | 'F';
  age: number;
  grade: string;
  section: string;
  results?: StudentResults;
  semester1?: SemesterSummary;
  semester2?: SemesterSummary;
  final?: SemesterSummary;
  conduct?: string;
  absent?: number;
  createdAt: string;
}

export interface Mark {
  id: string; // combination of studentId_subjectId
  studentId: string;
  subjectId: string;
  grade: string;
  section: string;
  semester1: number;
  semester2: number;
  teacherId?: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface SchoolAnalytics {
  id: string;
  updatedAt: string;
  data: {
    gradeAnalytics?: any;
    subjectAnalytics?: any;
    topStudents?: any;
    schoolWideStats: any;
    [key: string]: any;
  };
}
