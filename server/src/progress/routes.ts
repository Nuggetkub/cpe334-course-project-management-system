import { Router } from "express";
import { requireTeamAccess } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../errors.js";
import { parsePage } from "../milestones/routes.js";
import { readProgress } from "./service.js";

// F-11: mounted at /api/teams/:teamId/progress. Guards 401 → 404 (fixed F-02 body) → 400 page, read only.
export const progressRouter = Router({ mergeParams: true });

progressRouter.get("/", requireAuth, requireTeamAccess, asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  res.json(await readProgress(req.user!, req.team!.id, page, req.app.locals.now()));
}));
