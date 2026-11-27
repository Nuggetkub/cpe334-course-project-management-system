import { Router } from "express";
import { requireRole } from "../auth/authorize.js";
import { requireAuth } from "../auth/middleware.js";
import { asyncHandler } from "../errors.js";
import { parseOverviewQuery } from "./filters.js";
import { readOverview } from "./service.js";

// F-12: mounted at /api/overview. 401 → 403 (Supervisors only) → 400 state/page → fixed 404 team. Read only.
export const overviewRouter = Router();

overviewRouter.get("/", requireAuth, requireRole("SUPERVISOR"), asyncHandler(async (req, res) => {
  const query = parseOverviewQuery(req.query as Record<string, unknown>);
  res.json(await readOverview(req.user!, query, req.app.locals.now()));
}));
