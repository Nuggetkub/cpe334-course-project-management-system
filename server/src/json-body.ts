import express from "express";

// F-02 contract §1.2: JSON is parsed per route, after requireAuth, requireRole and the
// ownership check, so a malformed body can never answer before 401, 403 or 404.
// Routes without a body (e.g. logout) do not parse it at all.
export const jsonBody = express.json();
