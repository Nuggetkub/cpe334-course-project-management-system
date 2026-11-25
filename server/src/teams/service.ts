import { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { lockTeamMembership } from "./membership.js";

export const teamSummary = { id: true, name: true } as const;
const pageSize = 25;

function isUniqueViolation(error: unknown, columns: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) && target.length === columns.length && columns.every((key) => target.includes(key));
}

export async function createTeam(supervisorId: number, name: string) {
  const db = prisma();
  const courses = await db.course.findMany({ select: { id: true }, take: 2 });
  if (courses.length !== 1) throw new HttpError(409, "COURSE_UNAVAILABLE", "A single course must be configured before creating teams.");
  try {
    return await db.team.create({
      data: { name, courseId: courses[0].id, supervisors: { create: { supervisorId } } },
      select: teamSummary,
    });
  } catch (error) {
    if (isUniqueViolation(error, ["course_id", "name"])) {
      const message = "This team name is already in use.";
      throw new HttpError(409, "TEAM_NAME_UNAVAILABLE", message, { name: message });
    }
    throw error;
  }
}

export async function listCandidates(q: string, page: number) {
  const skip = (page - 1) * pageSize;
  if (skip >= 2_147_483_647) return { students: [], page, hasMore: false };
  // Prisma contains uses ILIKE for PostgreSQL; the search is a literal substring.
  const literal = q.replace(/[\\%_]/g, "\\$&");
  const rows = await prisma().user.findMany({
    where: { role: "STUDENT", teamMembership: null, ...(q ? { name: { contains: literal, mode: "insensitive" } } : {}) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip, take: pageSize + 1, select: teamSummary,
  });
  return { students: rows.slice(0, pageSize), page, hasMore: rows.length > pageSize };
}

const studentUnavailable = () => new HttpError(409, "STUDENT_UNAVAILABLE", "This student is no longer available. Refresh the candidate list.");

export async function addMember(teamId: number, studentId: number) {
  const db = prisma();
  const student = await db.user.findFirst({ where: { id: studentId, role: "STUDENT", teamMembership: null }, select: teamSummary });
  if (!student) throw studentUnavailable();
  try {
    await db.teamMember.create({ data: { teamId, studentId } });
  } catch (error) {
    if (isUniqueViolation(error, ["student_id"])) throw studentUnavailable();
    throw error;
  }
  return student;
}

export async function removeMember(teamId: number, studentId: number): Promise<void> {
  await prisma().$transaction(async (tx) => {
    // Deliberately do not lock a milestone here; submissions take milestone → membership.
    await lockTeamMembership(tx, teamId, studentId);
    const work = await tx.submission.findFirst({ where: { submittedBy: studentId, milestone: { teamId } }, select: { id: true } });
    if (work) throw new HttpError(409, "MEMBER_HAS_SUBMISSIONS", "This student has submitted work for this team.");
    await tx.teamMember.delete({ where: { studentId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
