import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { authRouter } from "./auth/routes.js";
import { CLIENT_DIST_DIR, CLIENT_ORIGINS, IS_PRODUCTION } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import { prisma } from "./prisma.js";
import { teamsRouter } from "./teams/routes.js";
import { milestonesRouter, teamMilestonesRouter } from "./milestones/routes.js";

export interface AppOptions {
  /** Test-only clock injection, shared with F-05. Production uses server time. */
  now?: () => Date;
  /** Resolves when the database answers a trivial query; rejects otherwise. */
  checkDatabase?: () => Promise<unknown>;
  /** Directory of the built client to serve, or null to serve API only. */
  clientDistDir?: string | null;
}

const defaultCheckDatabase = () => prisma().$queryRaw`SELECT 1`;

export function createApp(options: AppOptions = {}) {
  const checkDatabase = options.checkDatabase ?? defaultCheckDatabase;
  const clientDistDir = options.clientDistDir !== undefined ? options.clientDistDir : IS_PRODUCTION ? CLIENT_DIST_DIR : null;

  const app = express();
  app.locals.now = options.now ?? (() => new Date());
  app.disable("x-powered-by");
  app.use(cors({ origin: CLIENT_ORIGINS }));

  // Liveness: the process is up. Never touches the database, so a DB outage
  // does not make the platform restart a healthy container.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Readiness: the app can serve real requests. Used by the deploy smoke test.
  app.get("/api/ready", async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ready", db: "connected" });
    } catch {
      res.status(503).json({ status: "not ready", db: "disconnected" });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/teams/:teamId/milestones", teamMilestonesRouter);
  app.use("/api/milestones", milestonesRouter);
  app.use("/api/teams", teamsRouter);

  // Unknown API routes answer JSON, never the SPA's index.html.
  app.use("/api", notFound);

  // Production: one container serves the API and the built SPA on the same port.
  if (clientDistDir && existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    // Client-side routes (e.g. /milestones/3) fall back to index.html.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDistDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
