export type StudentGrade = { released: false } | { released: true; score: number };

/** Does not authorize access. After scoping, use only the published snapshot, never the draft. */
export function studentGrade(row: { releasedScore: number | null } | null): StudentGrade {
  return row?.releasedScore == null ? { released: false } : { released: true, score: row.releasedScore };
}

type GradeView =
  | { draftScore: number | null; released: false }
  | { draftScore: number; released: true; score: number; releasedAt: Date };

export function supervisorGrade(row: { draftScore: number; releasedScore: number | null; releasedAt: Date | null } | null): GradeView {
  if (!row || row.releasedScore === null || row.releasedAt === null) {
    return { draftScore: row?.draftScore ?? null, released: false };
  }
  return { draftScore: row.draftScore, released: true, score: row.releasedScore, releasedAt: row.releasedAt };
}
