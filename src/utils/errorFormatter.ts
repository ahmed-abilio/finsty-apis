import { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from './appError';

// ─── Error Shape Interfaces ───────────────────────────────────────────────────

interface FirebaseError {
  errorInfo: {
    code?: string;
    message?: string;
  };
}

interface AjvValidationIssue {
  message?: string;
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

interface FastifyValidationError {
  validation: AjvValidationIssue[];
  validationContext?: string;
  statusCode?: number;
}

interface NormalizedValidationDetail {
  field: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

interface HttpError {
  statusCode: number;
  code?: string;
  message?: string;
}

type KnownError =
  | AppError
  | FirebaseError
  | FastifyValidationError
  | HttpError
  | Error;

// ─── Response Body Type ───────────────────────────────────────────────────────

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

const isValidationError = (err: unknown): err is FastifyValidationError =>
  typeof err === 'object' && err !== null && Array.isArray((err as FastifyValidationError).validation);

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Derive a friendly field path for a single AJV issue.
 *
 * - For `required` issues, AJV reports the parent object's path; the missing
 *   property lives in `params.missingProperty`, so we append it.
 * - For all other issues, `instancePath` already points at the offending field
 *   (e.g. "/phone"), which we strip the leading slash from.
 * - Falls back to the validation context ("body" / "querystring" / "params")
 *   when AJV can't locate a specific field.
 */
const resolveFieldPath = (issue: AjvValidationIssue, context?: string): string => {
  const missing = (issue.params as { missingProperty?: string } | undefined)?.missingProperty;
  const instance = issue.instancePath?.replace(/^\//, '').replace(/\//g, '.') ?? '';

  if (issue.keyword === 'required' && missing) {
    return instance ? `${instance}.${missing}` : missing;
  }

  return instance || context || 'body';
};

const normalizeValidationIssues = (
  issues: AjvValidationIssue[],
  context?: string,
): NormalizedValidationDetail[] =>
  issues.map((issue) => ({
    field: resolveFieldPath(issue, context),
    message: issue.message ?? 'Invalid value',
    ...(issue.keyword && { keyword: issue.keyword }),
    ...(issue.params && Object.keys(issue.params).length > 0 && { params: issue.params }),
  }));

const buildValidationMessage = (details: NormalizedValidationDetail[]): string => {
  if (details.length === 0) return 'Request validation failed';
  const parts = details.map((d) => `${d.field} ${d.message}`);
  return `Validation failed: ${parts.join('; ')}`;
};

const isFirebaseError = (err: unknown): err is FirebaseError =>
  typeof err === 'object' &&
  err !== null &&
  'errorInfo' in err &&
  typeof (err as FirebaseError).errorInfo === 'object';

const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError || !!(err as AppError)?.isOperational;

const isHttpError = (err: unknown): err is HttpError =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as HttpError).statusCode === 'number';

// ─── Main Formatter ───────────────────────────────────────────────────────────

/**
 * Global Fastify error handler.
 *
 * Normalises every thrown value into a consistent envelope:
 * {
 *   success: false,
 *   error: { code, message, statusCode, details?, stack? }
 * }
 *
 * Must return reply.send() so Fastify receives the resolved Promise.
 * Omitting the return would cause Fastify to see `undefined` and potentially
 * emit a blank response before the discarded promise resolves.
 */
export const formatError = (
  error: KnownError,
  request: FastifyRequest,
  reply: FastifyReply,
): void => {
  const isDev = process.env.NODE_ENV !== 'production';

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown;

  // ── 1. Fastify / AJV schema validation failure ────────────────────────────
  if (isValidationError(error)) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const normalized = normalizeValidationIssues(error.validation, error.validationContext);
    message = buildValidationMessage(normalized);
    details = normalized;
  }

  // ── 2. Our own AppError (operational / expected errors) ───────────────────
  else if (isAppError(error)) {
    const appErr = error as AppError;
    statusCode = appErr.statusCode ?? 400;
    code = appErr.code ?? code;
    message = appErr.message ?? message;
    if (appErr.details !== undefined) {
      details = appErr.details;
    }
  }

  // ── 3. Firebase Admin SDK errors ──────────────────────────────────────────
  else if (isFirebaseError(error)) {
    const { code: fbCode, message: fbMessage } = error.errorInfo;
    code = fbCode ?? 'EXTERNAL_SERVICE_ERROR';
    message = fbMessage ?? message;

    if (code.includes('auth/')) {
      statusCode = 401;
    } else if (code.includes('permission-denied')) {
      statusCode = 403;
    } else {
      statusCode = 502; // treat all other Firebase failures as upstream errors
    }
  }

  // ── 4. Fastify built-in HTTP errors (e.g. 404 Not Found, 429 Too Many) ───
  else if (isHttpError(error)) {
    statusCode = error.statusCode;
    code = error.code ?? 'HTTP_ERROR';
    message = error.message ?? message;
  }

  // ── Log all 5xx errors with full detail for diagnostics ──────────────────
  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Unhandled server error');
  }

  const body: ErrorResponseBody = {
    success: false,
    error: {
      code,
      // Never expose internal error details to clients in production
      message: !isDev && statusCode >= 500 ? 'Internal server error' : message,
      statusCode,
      ...(details !== undefined && { details }),
      ...(isDev && { stack: (error as Error).stack }),
    },
  };

  return void reply.status(statusCode).send(body);
};
