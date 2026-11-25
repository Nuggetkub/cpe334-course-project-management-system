import type { Grade } from "@prisma/client";

export async function saveGrade(_milestoneId: number, _supervisorId: number, _score: number, _now: Date): Promise<Grade> {
  throw new Error("F-10 save is not implemented yet");
}

export async function releaseGrade(_milestoneId: number, _supervisorId: number, _now: Date): Promise<Grade> {
  throw new Error("F-10 release is not implemented yet");
}
