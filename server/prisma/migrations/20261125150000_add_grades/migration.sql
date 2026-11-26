-- F-10: additive only; old images can keep using the existing tables.
CREATE TABLE "grades" (
    "milestone_id" INTEGER NOT NULL,
    "draft_score" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "released_score" INTEGER,
    "released_by" INTEGER,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "grades_pkey" PRIMARY KEY ("milestone_id"),
    CONSTRAINT "grades_draft_score_range" CHECK ("draft_score" BETWEEN 0 AND 100),
    CONSTRAINT "grades_released_score_range" CHECK ("released_score" BETWEEN 0 AND 100),
    CONSTRAINT "grades_release_snapshot_complete" CHECK (
        ("released_score" IS NULL AND "released_by" IS NULL AND "released_at" IS NULL)
        OR ("released_score" IS NOT NULL AND "released_by" IS NOT NULL AND "released_at" IS NOT NULL)
    )
);

ALTER TABLE "grades" ADD CONSTRAINT "grades_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
