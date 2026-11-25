import { Prisma, type Grade } from "@prisma/client";
import { teamScope } from "../auth/authorize.js";
import type { AuthUser } from "../auth/middleware.js";
import { HttpError, notFoundError } from "../errors.js";
import { lockMilestone } from "../milestones/service.js";
import { prisma } from "../prisma.js";
import { studentGrade, supervisorGrade } from "./projection.js";

export async function readGrade(milestoneId: number, user: AuthUser) {
  const where = { id: milestoneId, team: teamScope(user) };
  // Bind the ownership check and projection source to one snapshot. The Student query
  // selects only the release score, so it cannot accidentally serialize a draft or actor ID.
  return prisma().$transaction(async (tx) => {
    if (user.role === "STUDENT") {
      const result = await tx.milestone.findFirst({ where, select: { grade: { select: { releasedScore: true } } } });
      if (!result) throw notFoundError();
      return studentGrade(result.grade);
    }
    const result = await tx.milestone.findFirst({
      where, select: { grade: { select: { draftScore: true, releasedScore: true, releasedAt: true } } },
    });
    if (!result) throw notFoundError();
    return supervisorGrade(result.grade);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

async function withGradeLock<T>(milestoneId: number, supervisorId: number, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma().$transaction(async (tx) => {
    const milestone = await lockMilestone(tx, milestoneId).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw notFoundError();
      throw error;
    });
    const teamId = milestone.teamId;
    const allowed = await tx.supervisorTeam.findUnique({
      where: { supervisorId_teamId: { supervisorId, teamId } }, select: { teamId: true },
    });
    if (!allowed) throw notFoundError();
    // No window/status check: an assigned Supervisor may grade missing or closed work.
    return write(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function saveGrade(milestoneId: number, supervisorId: number, score: number, now: Date): Promise<Grade> {
  const draft = { draftScore: score, updatedBy: supervisorId, updatedAt: now };
  return withGradeLock(milestoneId, supervisorId, (tx) => tx.grade.upsert({
    where: { milestoneId }, create: { milestoneId, ...draft }, update: draft,
  }));
}

export async function releaseGrade(milestoneId: number, supervisorId: number, now: Date): Promise<Grade> {
  return withGradeLock(milestoneId, supervisorId, async (tx) => {
    const grade = await tx.grade.findUnique({ where: { milestoneId } });
    if (!grade) throw new HttpError(409, "GRADE_NOT_RECORDED", "Save a draft grade before releasing it.");
    if (grade.releasedScore === grade.draftScore) return grade;
    return tx.grade.update({
      where: { milestoneId }, data: { releasedScore: grade.draftScore, releasedBy: supervisorId, releasedAt: now },
    });
  });
}
