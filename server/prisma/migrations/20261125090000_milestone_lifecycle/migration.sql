-- F-08 (#81): additive, nullable lifecycle columns. Existing rows stay valid.
ALTER TABLE "milestones" ADD COLUMN "late_until" TIMESTAMP(3),
ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "closed_by" INTEGER;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
