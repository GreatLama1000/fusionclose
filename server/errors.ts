export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);

/**
 * Maps Postgres constraint violations onto API errors; AppErrors pass through, anything else is rethrown
 * as an AppError-less Error (the HTTP layer turns that into a 500 without leaking SQL).
 */
export function translateDbError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const code = (e as { code?: string } | null)?.code;
  if (code === '23505') return conflict('That record already exists');
  if (code === '23503') return conflict('That record is referenced by, or references, another record');
  if (code === '23514' || code === '22P02') return badRequest('A value violates a data rule');
  throw e;
}
