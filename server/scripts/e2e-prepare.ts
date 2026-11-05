// Prepares the database for the Playwright run (`npm run e2e:server`): drops and
// recreates the E2E schema, applies the committed migrations and creates one
// Student and one Supervisor. Never touches the "public" schema.
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
  console.log(`[e2e] schema "${E2E_SCHEMA}" reset, migrated and seeded`);
} finally {
  await prisma.$disconnect();
}
