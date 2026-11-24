-- F-09 (#82): additive. Existing submissions are on-time version 1, so false is correct.
ALTER TABLE "submissions" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;
