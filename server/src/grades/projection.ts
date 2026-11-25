export type StudentGrade = { released: false } | { released: true; score: number };

export function studentGrade(_row: { releasedScore: number | null } | null): StudentGrade {
  throw new Error("F-10 Student grade projection is not implemented yet");
}
