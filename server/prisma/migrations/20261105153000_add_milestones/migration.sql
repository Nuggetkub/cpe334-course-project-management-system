CREATE TABLE "milestones" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "milestones_team_id_due_at_id_idx" ON "milestones"("team_id", "due_at", "id");
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
