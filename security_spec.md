# Security Specification

## Data Invariants
1. Students can only read their own data via `studentId`.
2. Teachers can only edit `marks` if they are authenticated as teachers.
3. Admins have full read/write access.
4. Marks must be numeric and within range (0-100).
5. Student IDs must be correctly formatted.

## The Dirty Dozen (Threat Models)
1. A student attempting to write to their own `marks`.
2. A student attempting to read another student's marks.
3. A teacher attempting to delete a `student` record.
4. An unauthenticated user attempting to read `subjects` passkeys.
5. A user attempting to update `SchoolConfig` without admin status.
6. A teacher trying to modify a student's `name` or `age`.
7. Someone trying to inject a 1MB string into a `subjectId`.
8. Updating results after they are finalized/locked (if applicable).
9. Spoofing `admin` status by modifying their own user doc (if users can edit).
10. Creating a `mark` without a valid `studentId`.
11. Reading `total` or `rank` before results are published.
12. Bulk deleting `grades` as a teacher.

## Test Runner
(Will be implemented in `firestore.rules`)
