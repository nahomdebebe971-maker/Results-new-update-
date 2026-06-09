# Security Specification - School Result Management System

## Data Invariants
1. A `publishedResult` must correspond to a valid `student` and reflect the finalized marks at the time of publication.
2. A `mark` entry must strictly belong to a valid `studentId` and `subjectId`.
3. `adminAccounts` are the root of trust for system configuration.
4. `teachers` can only modify marks for their assigned `assignedSubjects` or `assignedClasses`.
5. Students can only read their own data via the `publishedResults` collection using a secure verification ID or their student ID (if published).

## The "Dirty Dozen" Payloads (Anti-Patterns)
1. **Admin Escalation**: A non-admin user attempts to create a document in `adminAccounts` with their own UID.
2. **Result Tampering**: A student attempts to update their own `publishedResults` document to change their grade.
3. **Ghost Subject**: A teacher attempts to create a `subject` with a fake passkey.
4. **ID Poisoning**: A user attempts to create a student with a 1MB string as `studentId`.
5. **Unauthorized Mark Entry**: Teacher A attempts to record marks for Teacher B's class.
6. **Bulk Data Scraping**: A student attempts to `list` all documents in the `students` collection.
7. **Predictable Verification Bypass**: A user guesses a `verificationId` using a simple pattern (e.g., TRX-ST1-2016).
8. **PII Leak**: An unauthenticated user attempts to `get` a student's private profile.
9. **Role Bypass**: A teacher attempts to access the `/config/school` document.
10. **Shadow Update**: A user attempts to add a `isVerified: true` field to a student record that isn't supposed to have it.
11. **Orphaned Write**: Creating a mark for a student that does not exist.
12. **State Overwrite**: Changing a result after the academic year has been "locked" or "published".

## Test Runner (Conceptual firestore.rules.test.ts)
The tests will verify:
- `adminAccounts/{uid}`: Only accessible by existing admins or initialized by the owner.
- `publishedResults/{id}`: `get` is public IF the ID is a secure UUID. `list` is always denied.
- `students/{id}`: `read` restricted to Admin/Staff.
- `marks/{id}`: `write` restricted to assigned Teachers or Admins.
- `auditLogs`: `create` allowed for all authenticated users, `read` only for Admins.
