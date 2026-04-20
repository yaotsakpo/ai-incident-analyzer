import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export function errorHandler(
  err: (Error & { statusCode?: number }) | unknown,
  req: Request,
  res: Response,
  // _next must be declared for Express to recognize this as an error handler
  _next: NextFunction
): void {
  const isError = err instanceof Error;
  const status = (isError && (err as any).statusCode) ? (err as any).statusCode : 500;
  const rawMessage = isError ? err.message : String(err);

  logger.error(
    `[${req.method ?? 'UNKNOWN'} ${req.path ?? '/'}] ${rawMessage}`,
    isError ? err.stack : undefined
  );

  const isSensitive = status >= 500;
  const message =
    process.env.NODE_ENV === 'production' && isSensitive
      ? 'Internal server error'
      : rawMessage;

  res.status(status).json({ error: message });
}
