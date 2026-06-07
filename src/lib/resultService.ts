import { 
  collection, doc, getDocs, setDoc, getDoc, query, where, writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { Student, Mark, SchoolConfig, Subject, Grade } from '../types';

export const incrementCacheVersion = async () => {
  try {
    const docRef = doc(db, 'systemConfiguration', 'cacheVersion');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data()?.version || 0;
      await setDoc(docRef, { version: current + 1 });
    } else {
      await setDoc(docRef, { version: 1 });
    }
  } catch (err) {
    console.error("Failed to increment cache version:", err);
  }
};

export const getCacheVersion = async (): Promise<number> => {
  try {
    const docRef = doc(db, 'systemConfiguration', 'cacheVersion');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data()?.version || 1;
    } else {
      await setDoc(docRef, { version: 1 });
      return 1;
    }
  } catch (err) {
    console.error("Failed to get cache version:", err);
    return 1;
  }
};

export const publishGradeResults = async (gradeId: string, publish: boolean, config: SchoolConfig) => {
  // 1. Get the grade detail
  const gradeDocRef = doc(db, 'grades', gradeId);
  const gradeSnap = await getDoc(gradeDocRef);
  if (!gradeSnap.exists()) {
    throw new Error(`Grade ID ${gradeId} not found`);
  }
  const gradeData = gradeSnap.data() as Grade;
  const gradeName = gradeData.name;
  const section = gradeData.section;

  // 2. Fetch all subjects to get names
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));

  // 3. Fetch all students in this grade/section
  const qS = query(
    collection(db, 'students'), 
    where('grade', '==', gradeName),
    where('section', '==', section)
  );
  const studentSnaps = await getDocs(qS);
  const students = studentSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Student));

  // 4. Fetch all marks for this grade/section
  const qM = query(
    collection(db, 'marks'), 
    where('grade', '==', gradeName),
    where('section', '==', section)
  );
  const markSnaps = await getDocs(qM);
  const marks = markSnaps.docs.map(d => d.data() as Mark);

  const batch = writeBatch(db);

  if (!publish) {
    // UNPUBLISHING: Delete from publishedResults and update student records
    for (const student of students) {
      const pubRef = doc(db, 'publishedResults', student.studentId);
      batch.delete(pubRef);
      
      const studRef = doc(db, 'students', student.id);
      batch.update(studRef, { isPublished: false });
    }
    await batch.commit();
    await incrementCacheVersion();
    return;
  }

  // PUBLISHING: Precompute everything
  const marksByStudent: Record<string, Mark[]> = {};
  marks.forEach(m => {
    if (!marksByStudent[m.studentId]) marksByStudent[m.studentId] = [];
    marksByStudent[m.studentId].push(m);
  });

  const studentSummaries: any[] = [];

  students.forEach(student => {
    const sMarks = marksByStudent[student.studentId] || [];
    const results: any = {};
    const subjectsArray: any[] = [];
    
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
      
      const subjectName = subjects.find(sub => sub.id === m.subjectId)?.name || m.subjectId;
      subjectsArray.push({
        id: m.subjectId,
        name: subjectName,
        semester1: m.semester1,
        semester2: m.semester2,
        average: avg
      });

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
      studentId: student.studentId,
      studentName: student.name,
      name: student.name,
      sex: student.sex,
      age: student.age || 0,
      grade: student.grade,
      section: student.section,
      conduct: student.conduct || 'A',
      absent: student.absent ?? 0,
      results,
      subjects: subjectsArray,
      semester1: { total: s1Total, average: s1Avg, status: s1Avg >= config.passMark ? 'Pass' : 'Fail', rank: 0 },
      semester2: { total: s2Total, average: s2Avg, status: s2Avg >= config.passMark ? 'Pass' : 'Fail', rank: 0 },
      final: { total: (s1Total + s2Total) / 2, average: finalAvg, status: finalAvg >= config.passMark ? 'Pass' : 'Fail', rank: 0 }
    };
    studentSummaries.push(summary);
  });

  // Calculate Ranks within division (gradeName + section)
  const sortByS1 = [...studentSummaries].sort((a, b) => b.semester1.average - a.semester1.average);
  const sortByS2 = [...studentSummaries].sort((a, b) => b.semester2.average - a.semester2.average);
  const sortByFinal = [...studentSummaries].sort((a, b) => b.final.average - a.final.average);

  studentSummaries.forEach(s => {
    s.semester1.rank = sortByS1.findIndex(x => x.id === s.id) + 1;
    s.semester2.rank = sortByS2.findIndex(x => x.id === s.id) + 1;
    s.final.rank = sortByFinal.findIndex(x => x.id === s.id) + 1;

    // Update main students collection
    const studentRef = doc(db, 'students', s.id);
    batch.update(studentRef, {
      results: s.results,
      semester1: s.semester1,
      semester2: s.semester2,
      final: s.final,
      isPublished: true
    });

    // Create /publishedResults/ST123456 document
    const pubRef = doc(db, 'publishedResults', s.studentId);
    batch.set(pubRef, {
      id: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      name: s.studentName,
      grade: s.grade,
      section: s.section,
      sex: s.sex,
      age: s.age,
      conduct: s.conduct || 'A',
      absent: s.absent ?? 0,
      results: s.results,
      subjects: s.subjects,
      semester1: s.semester1,
      semester2: s.semester2,
      final: s.final,
      published: true,
      publishedAt: new Date().toISOString()
    });
  });

  await batch.commit();
  await incrementCacheVersion();
};

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

  // 3. Fetch all subjects to get names (needed if grade is published)
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));

  // 4. Fetch grade doc to check if published
  const qG = query(
    collection(db, 'grades'),
    where('name', '==', gradeName),
    where('section', '==', section)
  );
  const gradeSnaps = await getDocs(qG);
  const gradeId = !gradeSnaps.empty ? gradeSnaps.docs[0].id : null;
  const isPublished = gradeId ? (config.publishedGrades || []).includes(gradeId) : false;

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
    const subjectsArray: any[] = [];
    
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
      
      const subjectName = subjects.find(sub => sub.id === m.subjectId)?.name || m.subjectId;
      subjectsArray.push({
        id: m.subjectId,
        name: subjectName,
        semester1: m.semester1,
        semester2: m.semester2,
        average: avg
      });

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
      studentId: student.studentId,
      studentName: student.name,
      name: student.name,
      sex: student.sex,
      age: student.age || 0,
      grade: student.grade,
      section: student.section,
      conduct: student.conduct || 'A',
      absent: student.absent ?? 0,
      results,
      subjects: subjectsArray,
      semester1: { total: s1Total, average: s1Avg, status: s1Avg >= config.passMark ? 'Pass' : 'Fail', rank: 0 },
      semester2: { total: s2Total, average: s2Avg, status: s2Avg >= config.passMark ? 'Pass' : 'Fail', rank: 0 },
      final: { total: (s1Total + s2Total) / 2, average: finalAvg, status: finalAvg >= config.passMark ? 'Pass' : 'Fail', rank: 0 }
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
      final: s.final,
      isPublished: isPublished
    });

    if (isPublished) {
      const pubRef = doc(db, 'publishedResults', s.studentId);
      batch.set(pubRef, {
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        name: s.studentName,
        grade: s.grade,
        section: s.section,
        sex: s.sex,
        age: s.age,
        conduct: s.conduct || 'A',
        absent: s.absent ?? 0,
        subjects: s.subjects,
        semester1: s.semester1,
        semester2: s.semester2,
        final: s.final,
        published: true,
        publishedAt: new Date().toISOString()
      });
    }
  });

  await batch.commit();
  await incrementCacheVersion();
};

