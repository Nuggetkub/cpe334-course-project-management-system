import type { Prisma } from "@prisma/client";
import { notFoundError } from "../errors.js";

/** Shared by removal and submission; submission must lock its milestone before calling this. */
export async function lockTeamMembership(tx: Prisma.TransactionClient, teamId: number, studentId: number): Promise<void> {
  const rows = await tx.$queryRaw<{ student_id: number }[]>`
    SELECT student_id FROM team_members
    WHERE student_id = ${studentId} AND team_id = ${teamId}
    FOR UPDATE
  `;
  if (rows.length === 0) throw notFoundError();
}
