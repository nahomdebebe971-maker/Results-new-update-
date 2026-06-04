import { Student, Mark, Grade, Subject, SchoolConfig } from '../types';

export function calculateStudentAverages(students: Student[], marks: Mark[], subjects: Subject[]) {
  return students.map(student => {
    const studentMarks = marks.filter(m => m.studentId === student.studentId);
    const results: any = {};
    let totalAvg = 0;
    let count = 0;

    subjects.forEach(sub => {
      const mark = studentMarks.find(m => m.subjectId === sub.id);
      if (mark) {
        const avg = (mark.semester1 + mark.semester2) / 2;
        results[sub.id] = {
          semester1: mark.semester1,
          semester2: mark.semester2,
          average: avg
        };
        totalAvg += avg;
        count++;
      }
    });

    const finalAvg = count > 0 ? totalAvg / count : 0;
    
    return {
      ...student,
      results,
      final: {
        average: finalAvg,
        total: totalAvg,
        rank: 0, // Will calculate later
        status: finalAvg >= 50 ? 'Pass' : 'Fail'
      }
    } as Student;
  });
}

export function rankStudents(students: Student[]) {
  // Rank within grade/section
  const grades = Array.from(new Set(students.map(s => `${s.grade}_${s.section}`)));
  
  let rankedStudents = [...students];

  grades.forEach(gs => {
    const [grade, section] = gs.split('_');
    const filtered = rankedStudents
      .filter(s => s.grade === grade && s.section === section)
      .sort((a, b) => (b.final?.average || 0) - (a.final?.average || 0));
    
    filtered.forEach((s, idx) => {
      const studentIdx = rankedStudents.findIndex(rs => rs.studentId === s.studentId);
      if (rankedStudents[studentIdx].final) {
        rankedStudents[studentIdx].final!.rank = idx + 1;
      }
    });
  });

  return rankedStudents;
}

export function getTopStudents(students: Student[], limit: number = 20) {
  return [...students]
    .sort((a, b) => (b.final?.average || 0) - (a.final?.average || 0))
    .slice(0, limit);
}

export function getSubjectStats(marks: Mark[], students: Student[], subjects: Subject[], config: SchoolConfig) {
  const stats: any = {};

  subjects.forEach(sub => {
    const subMarks = marks.filter(m => m.subjectId === sub.id);
    const maleMarks = subMarks.filter(m => students.find(s => s.studentId === m.studentId)?.sex === 'M');
    const femaleMarks = subMarks.filter(m => students.find(s => s.studentId === m.studentId)?.sex === 'F');

    const maleAvg = maleMarks.length > 0 ? maleMarks.reduce((acc, m) => acc + (m.semester1 + m.semester2) / 2, 0) / maleMarks.length : 0;
    const femaleAvg = femaleMarks.length > 0 ? femaleMarks.reduce((acc, m) => acc + (m.semester1 + m.semester2) / 2, 0) / femaleMarks.length : 0;
    const totalAvg = subMarks.length > 0 ? subMarks.reduce((acc, m) => acc + (m.semester1 + m.semester2) / 2, 0) / subMarks.length : 0;

    const ranges = config.analyticsRanges.map(r => ({
      ...r,
      male: maleMarks.filter(m => {
        const avg = (m.semester1 + m.semester2) / 2;
        return avg >= r.min && avg <= r.max;
      }).length,
      female: femaleMarks.filter(m => {
        const avg = (m.semester1 + m.semester2) / 2;
        return avg >= r.min && avg <= r.max;
      }).length,
      total: subMarks.filter(m => {
        const avg = (m.semester1 + m.semester2) / 2;
        return avg >= r.min && avg <= r.max;
      }).length
    }));

    stats[sub.id] = {
      maleAvg,
      femaleAvg,
      totalAvg,
      ranges,
      passRate: subMarks.length > 0 ? (subMarks.filter(m => (m.semester1 + m.semester2) / 2 >= config.passMark).length / subMarks.length) * 100 : 0
    };
  });

  return stats;
}
