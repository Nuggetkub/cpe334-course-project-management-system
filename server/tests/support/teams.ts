import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../src/prisma.js";
import { createUser } from "./users.js";

// F-02 fixture (contract §4): teams A and B; student sA in A, sB in B, s0 in no team;
// supervisors pA and pA2 assigned to A, pB assigned to B only.

export async function cleanDatabase(): Promise<void> {
  const db = prisma();
  await db.$transaction([
    db.feedback.deleteMany(),
    db.submission.deleteMany(),
    db.milestone.deleteMany(),
    db.supervisorTeam.deleteMany(),
    db.teamMember.deleteMany(),
    db.team.deleteMany(),
    db.course.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
}

/** Inserts a live session directly, so the fixture does not depend on the login route. */
export async function signIn(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma().session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

export async function createTeamsFixture() {
  const db = prisma();
  const course = await db.course.create({ data: { code: `CPE334-${Date.now()}`, name: "Software Engineering" } });
  const teamA = await db.team.create({ data: { courseId: course.id, name: "Team A" } });
  const teamB = await db.team.create({ data: { courseId: course.id, name: "Team B" } });

  const [sA, sB, s0, pA, pA2, pB] = [
    await createUser("STUDENT"),
    await createUser("STUDENT"),
    await createUser("STUDENT"),
    await createUser("SUPERVISOR"),
    await createUser("SUPERVISOR"),
    await createUser("SUPERVISOR"),
  ];
  await db.teamMember.createMany({
    data: [
      { studentId: sA.id, teamId: teamA.id },
      { studentId: sB.id, teamId: teamB.id },
    ],
  });
  await db.supervisorTeam.createMany({
    data: [
      { supervisorId: pA.id, teamId: teamA.id },
      { supervisorId: pA2.id, teamId: teamA.id },
      { supervisorId: pB.id, teamId: teamB.id },
    ],
  });

  return { course, teamA, teamB, users: { sA, sB, s0, pA, pA2, pB } };
}
