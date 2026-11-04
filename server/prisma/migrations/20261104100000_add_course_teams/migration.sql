BEGIN;

CREATE TABLE "courses" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL
);
CREATE TABLE "teams" (
    "id" SERIAL PRIMARY KEY,
    "course_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL
);
CREATE TABLE "team_members" (
    "student_id" INTEGER PRIMARY KEY,
    "team_id" INTEGER NOT NULL
);
CREATE TABLE "supervisor_teams" (
    "supervisor_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    CONSTRAINT "supervisor_teams_pkey" PRIMARY KEY ("supervisor_id", "team_id")
);
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");
CREATE UNIQUE INDEX "teams_course_id_name_key" ON "teams"("course_id", "name");
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");
CREATE INDEX "supervisor_teams_team_id_idx" ON "supervisor_teams"("team_id");

ALTER TABLE "teams" ADD CONSTRAINT "teams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supervisor_teams" ADD CONSTRAINT "supervisor_teams_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supervisor_teams" ADD CONSTRAINT "supervisor_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
