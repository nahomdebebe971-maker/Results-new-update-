import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SchoolAnalytics, Student, Mark, Grade, Subject, SchoolConfig } from '../types';

export const calculateAndSaveAnalytics = async (ranges?: { label: string; min: number; max: number }[]) => {
    try {
        const defaultRanges = [
            { label: '<50', min: 0, max: 49.9 },
            { label: '50-75', min: 50, max: 74.9 },
            { label: '75-90', min: 75, max: 89.9 },
            { label: '90-100', min: 90, max: 100 }
        ];
        const activeRanges = ranges || defaultRanges;

        // 1. Fetch necessary raw data
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];

        const marksSnapshot = await getDocs(collection(db, 'marks'));
        const marks = marksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Mark[];

        const gradesSnapshot = await getDocs(collection(db, 'grades'));
        const grades = gradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Grade[];

        const subjectsSnapshot = await getDocs(collection(db, 'subjects'));
        const subjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Subject[];

        const teachersSnapshot = await getDocs(collection(db, 'teachers'));
        const totalTeachers = teachersSnapshot.size;

        const configSnap = await getDoc(doc(db, 'config', 'school'));
        const config = configSnap.exists() ? (configSnap.data() as SchoolConfig) : null;
        const passMark = config?.passMark ?? 50;
        const publishedGrades = config?.publishedGrades ?? [];

        // Build simple maps for speed
        const gradesMap = new Map<string, Grade>();
        grades.forEach(g => gradesMap.set(g.id, g));

        const subjectsMap = new Map<string, Subject>();
        subjects.forEach(s => subjectsMap.set(s.id, s));

        // 2. Perform calculations dynamically per student to ensure precision
        const processedStudents = students.map(student => {
            const studentMarks = marks.filter(m => m.studentId === student.studentId);
            let totalSum = 0;
            let subjectCount = 0;
            let isDropout = false;

            studentMarks.forEach(mk => {
                const avg = (mk.semester1 + mk.semester2) / 2;
                totalSum += avg;
                subjectCount++;

                if (mk.semester1 === 0 && mk.semester2 === 0) {
                    isDropout = true;
                }
            });

            const average = subjectCount > 0 ? totalSum / subjectCount : 0;
            const status = average >= passMark ? 'Pass' : 'Fail';

            // Find matching grade document to see if its results are published
            const matchingGradeDoc = grades.find(g => g.name === student.grade && g.section === student.section);
            const isPublished = matchingGradeDoc ? publishedGrades.includes(matchingGradeDoc.id) : false;

            return {
                id: student.id || student.studentId,
                studentId: student.studentId,
                name: student.name,
                sex: student.sex,
                grade: student.grade,
                section: student.section,
                average,
                isDropout,
                status,
                isPublished
            };
        });

        // --- Standard Overview Calculations ---
        const totalStudents = processedStudents.length;
        const totalMale = processedStudents.filter(s => s.sex === 'M').length;
        const totalFemale = processedStudents.filter(s => s.sex === 'F').length;

        const passedTotal = processedStudents.filter(s => s.status === 'Pass').length;
        const failedTotal = totalStudents - passedTotal;
        const passPercentage = totalStudents > 0 ? (passedTotal / totalStudents) * 100 : 0;
        const failPercentage = totalStudents > 0 ? (failedTotal / totalStudents) * 100 : 0;

        const passedMale = processedStudents.filter(s => s.sex === 'M' && s.status === 'Pass').length;
        const passedFemale = processedStudents.filter(s => s.sex === 'F' && s.status === 'Pass').length;
        
        const malePassRate = totalMale > 0 ? (passedMale / totalMale) * 100 : 0;
        const femalePassRate = totalFemale > 0 ? (passedFemale / totalFemale) * 100 : 0;

        // --- Grade Comparison Logic ---
        const gradeLevelAverages: { [key: string]: { totalSum: number; count: number; passedSum: number } } = {};
        processedStudents.forEach(s => {
            const gr = s.grade;
            if (!gradeLevelAverages[gr]) {
                gradeLevelAverages[gr] = { totalSum: 0, count: 0, passedSum: 0 };
            }
            gradeLevelAverages[gr].totalSum += s.average;
            gradeLevelAverages[gr].count++;
            if (s.status === 'Pass') {
                gradeLevelAverages[gr].passedSum++;
            }
        });

        const gradeComparison: { [key: string]: any } = {};
        Object.keys(gradeLevelAverages).forEach(gr => {
            const stats = gradeLevelAverages[gr];
            const avg = stats.count > 0 ? stats.totalSum / stats.count : 0;
            const passR = stats.count > 0 ? (stats.passedSum / stats.count) * 105 / 105 * 100 : 0; // Fix multiplication safety / precision
            gradeComparison[gr] = {
                average: avg,
                passRate: Math.min(100, passR),
                failRate: 100 - Math.min(100, passR),
                totalStudents: stats.count
            };
        });

        // --- Dropout Statistics ---
        const dropouts = processedStudents.filter(s => s.isDropout);
        const dropoutSchoolTotal = {
            male: dropouts.filter(s => s.sex === 'M').length,
            female: dropouts.filter(s => s.sex === 'F').length,
            total: dropouts.length
        };

        const dropoutByGrade: { [grade: string]: { male: number; female: number; total: number } } = {};
        const dropoutBySection: { [sectionKey: string]: { male: number; female: number; total: number } } = {};

        grades.forEach(g => {
            const kGrade = g.name;
            const kSection = `${g.name}${g.section}`;
            if (!dropoutByGrade[kGrade]) dropoutByGrade[kGrade] = { male: 0, female: 0, total: 0 };
            if (!dropoutBySection[kSection]) dropoutBySection[kSection] = { male: 0, female: 0, total: 0 };
        });

        dropouts.forEach(s => {
            const gr = s.grade;
            const sec = `${s.grade}${s.section}`;
            if (!dropoutByGrade[gr]) dropoutByGrade[gr] = { male: 0, female: 0, total: 0 };
            if (!dropoutBySection[sec]) dropoutBySection[sec] = { male: 0, female: 0, total: 0 };

            if (s.sex === 'M') {
                dropoutByGrade[gr].male++;
                dropoutByGrade[gr].total++;
                dropoutBySection[sec].male++;
                dropoutBySection[sec].total++;
            } else {
                dropoutByGrade[gr].female++;
                dropoutByGrade[gr].total++;
                dropoutBySection[sec].female++;
                dropoutBySection[sec].total++;
            }
        });

        // --- Gender Performance Gaps ---
        const genderGrades: { [key: string]: { maleSum: number; maleCount: number; femaleSum: number; femaleCount: number } } = {};
        processedStudents.forEach(s => {
            const gr = s.grade;
            if (!genderGrades[gr]) {
                genderGrades[gr] = { maleSum: 0, maleCount: 0, femaleSum: 0, femaleCount: 0 };
            }
            if (s.sex === 'M') {
                genderGrades[gr].maleSum += s.average;
                genderGrades[gr].maleCount++;
            } else {
                genderGrades[gr].femaleSum += s.average;
                genderGrades[gr].femaleCount++;
            }
        });

        const genderGradesStats: { [key: string]: any } = {};
        Object.keys(genderGrades).forEach(gr => {
            const g = genderGrades[gr];
            const mAvg = g.maleCount > 0 ? g.maleSum / g.maleCount : 0;
            const fAvg = g.femaleCount > 0 ? g.femaleSum / g.femaleCount : 0;
            genderGradesStats[gr] = {
                maleAverage: mAvg,
                femaleAverage: fAvg,
                difference: mAvg - fAvg
            };
        });

        const genderSubjectsStats: { [key: string]: any } = {};
        subjects.forEach(sub => {
            const subMarks = marks.filter(m => m.subjectId === sub.id);
            let maleSum = 0, maleCount = 0;
            let femaleSum = 0, femaleCount = 0;

            subMarks.forEach(mk => {
                const s = processedStudents.find(st => st.studentId === mk.studentId);
                const avg = (mk.semester1 + mk.semester2) / 2;
                if (s) {
                    if (s.sex === 'M') {
                        maleSum += avg;
                        maleCount++;
                    } else {
                        femaleSum += avg;
                        femaleCount++;
                    }
                }
            });

            const mAvg = maleCount > 0 ? maleSum / maleCount : 0;
            const fAvg = femaleCount > 0 ? femaleSum / femaleCount : 0;

            genderSubjectsStats[sub.id] = {
                subjectName: sub.name,
                maleAverage: mAvg,
                femaleAverage: fAvg,
                difference: mAvg - fAvg
            };
        });

        // --- Decision Support and Top/Worst perform lists ---
        const subjectPerformanceAverages = subjects.map(sub => {
            const subMarks = marks.filter(m => m.subjectId === sub.id);
            const avg = subMarks.length > 0 
                ? subMarks.reduce((acc, m) => acc + (m.semester1 + m.semester2) / 2, 0) / subMarks.length 
                : 0;
            return {
                subjectId: sub.id,
                subjectName: sub.name,
                average: avg
            };
        }).filter(a => a.average > 0);

        const bestPerformingSubjects = [...subjectPerformanceAverages].sort((a,b) => b.average - a.average);
        const lowestPerformingSubjects = [...subjectPerformanceAverages].sort((a,b) => a.average - b.average);

        const gradePerformanceAverages = Object.keys(gradeComparison).map(gr => ({
            gradeName: `Grade ${gr}`,
            average: gradeComparison[gr].average
        })).filter(a => a.average > 0);

        const bestPerformingGrades = [...gradePerformanceAverages].sort((a,b) => b.average - a.average);
        const lowestPerformingGrades = [...gradePerformanceAverages].sort((a,b) => a.average - b.average);

        const passRateByGrade = Object.keys(gradeComparison).map(gr => ({
            gradeName: `Grade ${gr}`,
            passRate: gradeComparison[gr].passRate
        })).sort((a,b) => b.passRate - a.passRate);

        const failRateByGrade = Object.keys(gradeComparison).map(gr => ({
            gradeName: `Grade ${gr}`,
            failRate: gradeComparison[gr].failRate
        })).sort((a,b) => b.failRate - a.failRate);

        // Map cached structures matching the requested analyticsCache folder
        const schoolWideStats = {
            totalStudents,
            totalMale,
            totalFemale,
            totalTeachers,
            totalGrades: grades.length,
            totalSections: new Set(grades.map(g => `${g.name}${g.section}`)).size,
            publishedGradesCount: publishedGrades.length,
            passRate: passPercentage,
            failRate: failPercentage,
            malePassRate,
            femalePassRate,
            passedTotal,
            failedTotal
        };

        const dropoutAnalysis = {
            schoolTotal: dropoutSchoolTotal,
            byGrade: dropoutByGrade,
            bySection: dropoutBySection
        };

        const allStudentsRankData = processedStudents.map(s => ({
            id: s.id,
            studentId: s.studentId,
            name: s.name,
            sex: s.sex,
            grade: s.grade,
            section: s.section,
            average: s.average,
            isPublished: s.isPublished
        }));

        const decisionReports = {
            bestPerformingSubjects,
            lowestPerformingSubjects,
            bestPerformingGrades,
            lowestPerformingGrades,
            passRateByGrade,
            failRateByGrade,
            dropoutStatsByGrade: Object.keys(dropoutByGrade).map(gr => ({ gradeName: `Grade ${gr}`, ...dropoutByGrade[gr] })),
            dropoutStatsBySection: Object.keys(dropoutBySection).map(sec => ({ sectionKey: sec, ...dropoutBySection[sec] })),
            performanceDistribution: []
        };

        const dynamicDistData = activeRanges.map(cr => {
            const count = processedStudents.filter(s => s.average >= cr.min && s.average <= cr.max).length;
            return {
                name: cr.label,
                value: count
            };
        });

        const chartsData = {
            gradeComparisonCharts: Object.entries(gradeComparison).map(([gr, data]: [string, any]) => ({ name: gr, average: data.average }))
        };

        const generationTime = new Date().toISOString();

        // 3. Save to analyticsCache/ collection securely & fast in parallel
        await Promise.all([
            setDoc(doc(db, 'analyticsCache', 'schoolOverview'), { schoolWideStats, dropoutAnalysis }),
            setDoc(doc(db, 'analyticsCache', 'topStudents'), { allStudentsRankData }),
            setDoc(doc(db, 'analyticsCache', 'topStudentsByGrade'), { decisionReports }),
            setDoc(doc(db, 'analyticsCache', 'subjectAnalysis'), { subjectPerformanceAverages, genderSubjectsStats }),
            setDoc(doc(db, 'analyticsCache', 'genderAnalysis'), { genderPerformance: { grades: genderGradesStats, subjects: genderSubjectsStats } }),
            setDoc(doc(db, 'analyticsCache', 'gradeAnalysis'), { gradeComparison }),
            setDoc(doc(db, 'analyticsCache', 'performanceDistribution'), { dynamicDistData }),
            setDoc(doc(db, 'analyticsCache', 'charts'), chartsData),
            setDoc(doc(db, 'analyticsCache', 'scoreRangesUsed'), { ranges: activeRanges }),
            setDoc(doc(db, 'analyticsCache', 'generatedAt'), { value: generationTime }),

            // Maintain legacy /analytics/main document too for general compatibility
            setDoc(doc(db, 'analytics', 'main'), {
                id: 'main',
                updatedAt: generationTime,
                data: {
                    schoolWideStats,
                    gradeComparison,
                    genderPerformance: { grades: genderGradesStats, subjects: genderSubjectsStats },
                    decisionReports,
                    dropoutAnalysis,
                    allStudentsRankData
                }
            })
        ]);

        console.log('Analytics fully recalculated and saved in nested cache collections successfully!');
    } catch (err) {
        console.error('Failed to calculate analytics:', err);
        throw err;
    }
};

export const getAnalytics = async (): Promise<SchoolAnalytics | null> => {
    // Falls back to direct getAnalyticsFromCache to make it fully centralized
    return getAnalyticsFromCache();
};

export const getAnalyticsFromCache = async (): Promise<SchoolAnalytics | null> => {
    try {
        const generatedAtSnap = await getDoc(doc(db, 'analyticsCache', 'generatedAt'));
        if (!generatedAtSnap.exists()) return null;

        const generatedAt = generatedAtSnap.data()?.value || '';
        const [
            schoolOverviewSnap,
            topStudentsSnap,
            topStudentsByGradeSnap,
            genderAnalysisSnap,
            gradeAnalysisSnap,
            performanceDistributionSnap,
            chartsSnap,
            scoreRangesUsedSnap
        ] = await Promise.all([
            getDoc(doc(db, 'analyticsCache', 'schoolOverview')),
            getDoc(doc(db, 'analyticsCache', 'topStudents')),
            getDoc(doc(db, 'analyticsCache', 'topStudentsByGrade')),
            getDoc(doc(db, 'analyticsCache', 'genderAnalysis')),
            getDoc(doc(db, 'analyticsCache', 'gradeAnalysis')),
            getDoc(doc(db, 'analyticsCache', 'performanceDistribution')),
            getDoc(doc(db, 'analyticsCache', 'charts')),
            getDoc(doc(db, 'analyticsCache', 'scoreRangesUsed'))
        ]);

        const schoolOverview = schoolOverviewSnap.exists() ? schoolOverviewSnap.data() : null;
        const topStudents = topStudentsSnap.exists() ? topStudentsSnap.data() : null;
        const topStudentsByGrade = topStudentsByGradeSnap.exists() ? topStudentsByGradeSnap.data() : null;
        const genderAnalysis = genderAnalysisSnap.exists() ? genderAnalysisSnap.data() : null;
        const gradeAnalysis = gradeAnalysisSnap.exists() ? gradeAnalysisSnap.data() : null;
        const performanceDistribution = performanceDistributionSnap.exists() ? performanceDistributionSnap.data() : null;
        const charts = chartsSnap.exists() ? chartsSnap.data() : null;
        const scoreRangesUsed = scoreRangesUsedSnap.exists() ? scoreRangesUsedSnap.data()?.ranges : [];

        // Build fully compliant nested model
        const assembled: SchoolAnalytics = {
            id: 'main',
            updatedAt: generatedAt,
            data: {
                schoolWideStats: schoolOverview?.schoolWideStats || {
                    totalStudents: 0, totalMale: 0, totalFemale: 0, totalTeachers: 0, totalGrades: 0, totalSections: 0, publishedGradesCount: 0, passRate: 0, failRate: 0, malePassRate: 0, femalePassRate: 0, passedTotal: 0, failedTotal: 0
                },
                gradeComparison: gradeAnalysis?.gradeComparison || {},
                genderPerformance: genderAnalysis?.genderPerformance || { grades: {}, subjects: {} },
                decisionReports: topStudentsByGrade?.decisionReports || {
                    bestPerformingSubjects: [], lowestPerformingSubjects: [], bestPerformingGrades: [], lowestPerformingGrades: [], passRateByGrade: [], failRateByGrade: [], dropoutStatsByGrade: [], dropoutStatsBySection: []
                },
                dropoutAnalysis: schoolOverview?.dropoutAnalysis || { schoolTotal: { total: 0, male: 0, female: 0 }, byGrade: {}, bySection: {} },
                allStudentsRankData: topStudents?.allStudentsRankData || [],
                performanceDistribution: performanceDistribution?.dynamicDistData || [],
                charts: charts || {},
                scoreRangesUsed: scoreRangesUsed || []
            }
        };
        return assembled;
    } catch (err) {
        console.error('Failed to load analytics from cache:', err);
        return null;
    }
};
