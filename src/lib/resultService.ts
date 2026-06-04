import { 
  collection, doc, getDocs, setDoc, query, where, writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { Student, Mark, SchoolConfig } from '../types';

export const calculateResultsForGrade = async (gradeName: string, section: string, config: SchoolConfig) => {
  // 1. Fetch all students in this grade/section
  const qS = query(
    collection(db, 'students'), 
    where('grade', '==', gradeName),
    where('section', '==', section)
  );
  const studentSnaps = await getDocs(qS);
  const students = studentSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Student));

  // 2. Fetch all marks for this grade/section
  const qM = query(
    collection(db, 'marks'), 
    where('grade', '==', gradeName),
    where('section', '==', section)
  );
  const markSnaps = await getDocs(qM);
  const marks = markSnaps.docs.map(d => d.data() as Mark);

  const batch = writeBatch(db);

  // Group marks by student
  const marksByStudent: Record<string, Mark[]> = {};
  marks.forEach(m => {
    if (!marksByStudent[m.studentId]) marksByStudent[m.studentId] = [];
    marksByStudent[m.studentId].push(m);
  });

  const studentSummaries: any[] = [];

  students.forEach(student => {
    const sMarks = marksByStudent[student.studentId] || [];
    const results: any = {};
    
    let s1Total = 0;
    let s2Total = 0;
    let s1Count = 0;
    let s2Count = 0;

    sMarks.forEach(m => {
      const avg = (m.semester1 + m.semester2) / 2;
      results[m.subjectId] = {
        semester1: m.semester1,
        semester2: m.semester2,
        average: avg
      };
      s1Total += m.semester1;
      s2Total += m.semester2;
      s1Count++;
      s2Count++;
    });

    const s1Avg = s1Count > 0 ? s1Total / s1Count : 0;
    const s2Avg = s2Count > 0 ? s2Total / s2Count : 0;
    const finalAvg = (s1Avg + s2Avg) / 2;

    const summary = {
      id: student.id,
      results,
      semester1: { total: s1Total, average: s1Avg, status: s1Avg >= config.passMark ? 'Pass' : 'Fail' },
      semester2: { total: s2Total, average: s2Avg, status: s2Avg >= config.passMark ? 'Pass' : 'Fail' },
      final: { total: s1Total + s2Total, average: finalAvg, status: finalAvg >= config.passMark ? 'Pass' : 'Fail' }
    };
    studentSummaries.push(summary);
  });

  // Calculate Ranks within the grade
  const sortByS1 = [...studentSummaries].sort((a, b) => b.semester1.average - a.semester1.average);
  const sortByS2 = [...studentSummaries].sort((a, b) => b.semester2.average - a.semester2.average);
  const sortByFinal = [...studentSummaries].sort((a, b) => b.final.average - a.final.average);

  studentSummaries.forEach(s => {
    s.semester1.rank = sortByS1.findIndex(x => x.id === s.id) + 1;
    s.semester2.rank = sortByS2.findIndex(x => x.id === s.id) + 1;
    s.final.rank = sortByFinal.findIndex(x => x.id === s.id) + 1;

    const studentRef = doc(db, 'students', s.id);
    batch.update(studentRef, {
      results: s.results,
      semester1: s.semester1,
      semester2: s.semester2,
      final: s.final
    });
  });

  await batch.commit();
};
