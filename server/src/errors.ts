import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

// NFR-05 / SR-01: every error response is { error: { code, message, fields? } }.
// Messages are written for the user; stack traces and SQL never leave the server.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function sendError(res: Response, error: HttpError): void {
  const body: { code: string; message: string; fields?: Record<string, string> } = {
    code: error.code,
    message: error.message,
  };
  if (error.fields) body.fields = error.fields;
  res.status(error.status).json({ error: body });
}

/** Express 4 does not catch rejected promises; route them to the error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** One 404 for unknown routes, missing records and other teams' records (DEC-10). */
export function notFoundError(): HttpError {
  return new HttpError(404, "NOT_FOUND", "Not found");
}

export const notFound: RequestHandler = (_req, res) => {
  sendError(res, notFoundError());
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    sendError(res, error);
    return;
  }
  // body-parser: malformed JSON or a body that is too large.
  if (error?.type === "entity.parse.failed") {
    sendError(res, new HttpError(400, "BAD_REQUEST", "Request body is not valid JSON"));
    return;
  }
  if (typeof error?.status === "number" && error.status >= 400 && error.status < 500) {
    sendError(res, new HttpError(error.status, "BAD_REQUEST", "Bad request"));
    return;
  }
  console.error(error);
  sendError(res, new HttpError(500, "INTERNAL", "Internal server error"));
};
