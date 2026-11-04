import type { RequestHandler } from "express";

// SKELETON for the second red run: does nothing; app.ts still parses JSON globally.
export const jsonBody: RequestHandler = (_req, _res, next) => next();
