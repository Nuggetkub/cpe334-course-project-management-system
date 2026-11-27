// Prepares the database for the Playwright run (`npm run e2e:server`): drops and
// recreates the E2E schema, applies the committed migrations and creates
// synthetic journey accounts. Never touches the "public" schema.
//
// The E2E password comes from E2E_PASSWORD (set by playwright.config.ts). It
// only ever exists in a throw-away schema on a developer or CI database.

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const E2E_SCHEMA = "cpms_e2e";

const url = process.env.DATABASE_URL;
const password = process.env.E2E_PASSWORD;
if (!url || !password) throw new Error("e2e-prepare needs DATABASE_URL and E2E_PASSWORD");

const schema = new URL(url).searchParams.get("schema");
if (schema !== E2E_SCHEMA) {
  throw new Error(`Refusing to reset schema "${schema}" — e2e-prepare only resets "${E2E_SCHEMA}".`);
}

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${E2E_SCHEMA}" CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${E2E_SCHEMA}"`);
  execSync("npx prisma migrate deploy", { stdio: "pipe" });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.createMany({
    data: [
      { email: "student@e2e.test", name: "E2E Student", role: "STUDENT", passwordHash },
      { email: "supervisor@e2e.test", name: "E2E Supervisor", role: "SUPERVISOR", passwordHash },
    ],
  });
  // F-04: dedicated synthetic teams; no milestones so empty/create are real DB states.
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@e2e.test" } });
  const supervisor = await prisma.user.findUniqueOrThrow({ where: { email: "supervisor@e2e.test" } });
  const course = await prisma.course.create({ data: { code: "E2E-F04", name: "E2E course" } });
  const team = await prisma.team.create({ data: { courseId: course.id, name: "E2E Journey Team" } });
  const emptyTeam = await prisma.team.create({ data: { courseId: course.id, name: "E2E Validation Team" } });
  await prisma.teamMember.create({ data: { studentId: student.id, teamId: team.id } });
  await prisma.supervisorTeam.createMany({ data: [team, emptyTeam].map((t) => ({ supervisorId: supervisor.id, teamId: t.id })) });
  // F-05: its own team and Student, so F-04's empty-list journey above stays empty. One milestone
  // is open for a week; one is already past due (created directly, as F-04's API refuses past dates).
  const student2 = await prisma.user.create({ data: { email: "student2@e2e.test", name: "E2E Student 2", role: "STUDENT", passwordHash } });
  const submissionTeam = await prisma.team.create({ data: { courseId: course.id, name: "E2E Submission Team" } });
  await prisma.teamMember.create({ data: { studentId: student2.id, teamId: submissionTeam.id } });
  await prisma.supervisorTeam.create({ data: { supervisorId: supervisor.id, teamId: submissionTeam.id } });
  const day = 24 * 60 * 60 * 1000;
  await prisma.milestone.createMany({ data: [
    { teamId: submissionTeam.id, createdBy: supervisor.id, title: "F05 open milestone", dueAt: new Date(Date.now() + 7 * day) },
    { teamId: submissionTeam.id, createdBy: supervisor.id, title: "F05 past milestone", dueAt: new Date(Date.now() - day) },
  ] });
  // F-06: a milestone that Student 2 has already submitted, ready for feedback.
  const reviewed = await prisma.milestone.create({ data: { teamId: submissionTeam.id, createdBy: supervisor.id, title: "F06 submitted milestone", dueAt: new Date(Date.now() + 7 * day) } });
  await prisma.submission.create({ data: { milestoneId: reviewed.id, title: "F06 work", link: "https://example.com/f06-work", submittedBy: student2.id, submittedAt: new Date() } });
  // F-08: its own team and Student, so the lifecycle journey never adds rows to F-04's empty teams.
  const student3 = await prisma.user.create({ data: { email: "student3@e2e.test", name: "E2E Student 3", role: "STUDENT", passwordHash } });
  const lifecycleTeam = await prisma.team.create({ data: { courseId: course.id, name: "E2E Lifecycle Team" } });
  await prisma.teamMember.create({ data: { studentId: student3.id, teamId: lifecycleTeam.id } });
  await prisma.supervisorTeam.create({ data: { supervisorId: supervisor.id, teamId: lifecycleTeam.id } });
  await prisma.milestone.create({ data: {
    teamId: lifecycleTeam.id, createdBy: supervisor.id, title: "F08 late milestone",
    dueAt: new Date(Date.now() - day), lateUntil: new Date(Date.now() + day),
  } });
  // F-09: Student 3 has already submitted version 1, so the journey can add version 2.
  const resubmit = await prisma.milestone.create({ data: { teamId: lifecycleTeam.id, createdBy: supervisor.id, title: "F09 resubmission milestone", dueAt: new Date(Date.now() + 7 * day) } });
  await prisma.submission.create({ data: { milestoneId: resubmit.id, version: 1, title: "F09 first version", link: "https://example.com/f09-v1", submittedBy: student3.id, submittedAt: new Date() } });
  // F-11: its own team and Student, so other journeys never add rows to this board. One milestone has
  // version 1 with feedback; one is not submitted yet.
  const student4 = await prisma.user.create({ data: { email: "student4@e2e.test", name: "E2E Student 4", role: "STUDENT", passwordHash } });
  const progressTeam = await prisma.team.create({ data: { courseId: course.id, name: "E2E Progress Team" } });
  await prisma.teamMember.create({ data: { studentId: student4.id, teamId: progressTeam.id } });
  await prisma.supervisorTeam.create({ data: { supervisorId: supervisor.id, teamId: progressTeam.id } });
  const reviewedOnBoard = await prisma.milestone.create({ data: { teamId: progressTeam.id, createdBy: supervisor.id, title: "F11 submitted milestone", dueAt: new Date(Date.now() + 2 * day) } });
  const boardVersion = await prisma.submission.create({ data: { milestoneId: reviewedOnBoard.id, version: 1, title: "F11 work", link: "https://example.com/f11-v1", submittedBy: student4.id, submittedAt: new Date() } });
  await prisma.feedback.create({ data: { submissionId: boardVersion.id, supervisorId: supervisor.id, text: "F11 feedback", createdAt: new Date() } });
  // F-11 phase 2: a released F-10 grade on this milestone; the open milestone has none ("Not released").
  const gradedAt = new Date();
  await prisma.grade.create({ data: {
    milestoneId: reviewedOnBoard.id, draftScore: 88, updatedBy: supervisor.id, updatedAt: gradedAt,
    releasedScore: 88, releasedBy: supervisor.id, releasedAt: gradedAt,
  } });
  await prisma.milestone.create({ data: { teamId: progressTeam.id, createdBy: supervisor.id, title: "F11 open milestone", dueAt: new Date(Date.now() + 5 * day) } });
  // F-07 uses an empty Supervisor account and unassigned Student in the existing course.
  await prisma.user.createMany({ data: [
    { email: "manager-f07@e2e.test", name: "E2E F07 Supervisor", role: "SUPERVISOR", passwordHash },
    { email: "student-f07@e2e.test", name: "E2E F07 Student", role: "STUDENT", passwordHash },
  ] });
  // F-10: its own team and Student, so no other journey changes this grade. Named so the Supervisor's
  // default team (alphabetically first) stays "E2E Journey Team" for the F-04 journeys.
  const student5 = await prisma.user.create({ data: { email: "student5@e2e.test", name: "E2E Student 5", role: "STUDENT", passwordHash } });
  const gradeTeam = await prisma.team.create({ data: { courseId: course.id, name: "E2E Team Grades" } });
  await prisma.teamMember.create({ data: { studentId: student5.id, teamId: gradeTeam.id } });
  await prisma.supervisorTeam.create({ data: { supervisorId: supervisor.id, teamId: gradeTeam.id } });
  await prisma.milestone.create({ data: { teamId: gradeTeam.id, createdBy: supervisor.id, title: "F10 graded milestone", dueAt: new Date(Date.now() + 3 * day) } });
  // F-10 v0.5: a second milestone for the stale-confirmation journey, so it never touches the one above.
  await prisma.milestone.create({ data: { teamId: gradeTeam.id, createdBy: supervisor.id, title: "F10 stale release milestone", dueAt: new Date(Date.now() + 4 * day) } });
  console.log(`[e2e] schema "${E2E_SCHEMA}" reset, migrated and seeded`);
} finally {
  await prisma.$disconnect();
}
